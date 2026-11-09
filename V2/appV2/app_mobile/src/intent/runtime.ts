import { chat } from '../services/chatApi';
import { useRecordingStore } from '../ring/store/useRecordingStore';
import { recordingTitle } from '../ring/recordingTitle';
import { recordingKey } from '../ring/recordingIdentity';
import { Note, useNotesStore } from '../notes/useNotesStore';
import type { RingRecording } from '../ring/types';
import { INTENT_PROTOCOL } from './prompt';
import { Source, parseEnvelope } from './model';
import { intentStorageReady, useIntentStore } from './store';
export function recordingSource(file: RingRecording): Source {
  return {
    timeTrusted:
      file.source === 'phone' || file.commandRecordedAt !== undefined,
    key: recordingKey(file.uri),
    text: file.transcript?.trim() || '',
    title: recordingTitle(file),
    capturedAt: file.commandRecordedAt ?? file.timestamp,
    uri: file.uri,
  };
}
export function noteSource(note: Note): Source {
  return {
    timeTrusted: true,
    parentItemId: note.intentParentId,
    parentRevision: note.intentParentRevision,
    key: `note:${note.id}`,
    text: note.text.trim(),
    title: note.title,
    capturedAt: note.createdAt,
    noteId: note.id,
  };
}
export function currentSource(key: string): Source | undefined {
  if (key.startsWith('note:')) {
    const note = useNotesStore
      .getState()
      .notes.find(n => `note:${n.id}` === key && !n.recordingUri);
    return note ? noteSource(note) : undefined;
  }
  const file = useRecordingStore
    .getState()
    .files.find(f => recordingKey(f.uri) === key);
  return file ? recordingSource(file) : undefined;
}
export async function beginInterpretation(source: Source) {
  await intentStorageReady();
  return useIntentStore.getState().begin(source);
}
export function readableReply(raw: string) {
  const trimmed = raw.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('```')) {
    try {
      const data = JSON.parse(
        trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''),
      );
      return typeof data.reply === 'string' ? data.reply : '';
    } catch {
      return '';
    }
  }
  return raw;
}
export function settleInterpretation(
  source: Source,
  revision: number | undefined,
  raw: string,
  selectedContext = '',
) {
  try {
    const parsed = parseEnvelope(raw, source.text, selectedContext);
    if (
      revision !== undefined &&
      currentSource(source.key)?.text === source.text
    )
      useIntentStore.getState().finish(source, revision, parsed.intents);
    return parsed.reply;
  } catch {
    if (revision !== undefined)
      useIntentStore
        .getState()
        .fail(
          source.key,
          revision,
          'Classification was not returned in the expected format. Original text is safe; retry organizing this capture.',
        );
    const readable = readableReply(raw);
    return (
      readable ||
      '本次意图分类响应格式异常，原录音与文字已保留。请在 Agent 页重试整理。'
    );
  }
}
const active = new Map<
  string,
  { task: Promise<void>; controller: AbortController }
>();
export function organizeNote(
  note: Note,
  context?: { title: string; text: string },
) {
  const source = noteSource(note);
  const running = active.get(source.key);
  if (running) return running.task;
  if (!source.text || source.text.length > 8000)
    return Promise.reject(
      new Error('Please use 1–8,000 characters. Original note is saved.'),
    );
  const controller = new AbortController();
  const task = Promise.resolve()
    .then(async () => {
      const revision = await beginInterpretation(source);
      try {
        const prompt =
          INTENT_PROTOCOL +
          (context
            ? `\n用户明确选择此项目作为补充上下文，仅解释本条新输入，sourceSpan必须引用新输入，不要把旧原话再分类。选中项目：${JSON.stringify(
                context,
              ).slice(
                0,
                12000,
              )}\n补充后尽量生成该事项可直接使用的完整更新版本，仍不能声称外部动作已执行。`
            : '');
        const response = await chat(
          [
            { role: 'user', content: prompt },
            { role: 'user', content: source.text },
          ],
          '',
          controller.signal,
        );
        if (
          controller.signal.aborted ||
          currentSource(source.key)?.text !== source.text
        )
          throw new Error(
            'Source changed or was removed. No result was applied.',
          );
        settleInterpretation(source, revision, response, context?.text);
      } catch (error) {
        useIntentStore
          .getState()
          .fail(source.key, revision, (error as Error).message);
        throw error;
      }
    })
    .finally(() => active.delete(source.key));
  active.set(source.key, { task, controller });
  return task;
}
export function reconcileIntentSources() {
  if (
    !useIntentStore.persist.hasHydrated() ||
    useIntentStore.getState().loadError ||
    !useRecordingStore.persist.hasHydrated() ||
    !useNotesStore.persist.hasHydrated()
  )
    return;
  const sources = [
    ...useRecordingStore.getState().files.map(recordingSource),
    ...useNotesStore
      .getState()
      .notes.filter(n => !n.recordingUri)
      .map(noteSource),
  ];
  for (const [key, job] of active)
    if (
      !sources.some(
        source =>
          source.key === key &&
          source.text === useIntentStore.getState().captures[key]?.source.text,
      )
    )
      job.controller.abort();
  useIntentStore.getState().reconcile(sources);
}
let recovered = false;
export function startIntentSync() {
  const recover = () => {
    if (recovered) return;
    recovered = true;
    for (const capture of Object.values(useIntentStore.getState().captures))
      if (capture.state === 'working')
        useIntentStore
          .getState()
          .fail(
            capture.source.key,
            capture.revision,
            'Interrupted while organizing. Please retry manually.',
          );
  };
  if (useIntentStore.persist.hasHydrated()) recover();
  const refresh = () => reconcileIntentSources();
  const stops = [
    useRecordingStore.subscribe(refresh),
    useNotesStore.subscribe(refresh),
    useRecordingStore.persist.onFinishHydration(refresh),
    useNotesStore.persist.onFinishHydration(refresh),
    useIntentStore.persist.onFinishHydration(() => {
      recover();
      refresh();
    }),
  ];
  refresh();
  return () => {
    stops.forEach(stop => stop());
    for (const job of active.values()) job.controller.abort();
  };
}
