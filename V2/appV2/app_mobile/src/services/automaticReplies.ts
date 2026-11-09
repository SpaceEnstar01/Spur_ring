import { Alert, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { useRecordingStore } from '../ring/store/useRecordingStore';
import {
  newCreatorAgentRequestId,
  runCreatorAgentTask,
} from './creatorAgentApi';
import { recordingKey, sameRecording } from '../ring/recordingIdentity';
import { parseEnvelope } from '../intent/model';
import { CAPTURE_PROTOCOL } from '../intent/prompt';
import { recordingSource, beginInterpretation } from '../intent/runtime';
import { useIntentStore } from '../intent/store';

type ReplySettings = {
  choice: 'undecided' | 'enabled' | 'disabled';
  excludedUris: string[];
  choose: (enabled: boolean) => void;
};
export const useReplySettings = create<ReplySettings>()(
  persist(
    set => ({
      choice: 'undecided',
      excludedUris: [],
      choose: enabled => {
        // Include the latest existing recording, not a surprise batch of old notes.
        const files = [...useRecordingStore.getState().files].sort(
          (a, b) => b.timestamp - a.timestamp,
        );
        set({
          choice: enabled ? 'enabled' : 'disabled',
          excludedUris: files.slice(1).map(file => file.uri),
        });
      },
    }),
    {
      name: 'spur-automatic-reply-v1',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

export function confirmEnableAutomaticReplies() {
  Alert.alert(
    '开启录音自动理解？',
    '将最新一条已有及后续新增录音的文字发送至已配置的 Personal Agent，自动整理想法、提取待办；明确的公开网页研究请求会自动执行。其他外部操作仍需确认。音频不上传，不批量处理其他历史录音，可随时关闭。',
    [
      {
        text: '仅本机识别',
        style: 'cancel',
        onPress: () => useReplySettings.getState().choose(false),
      },
      {
        text: '开启自动理解',
        onPress: () => useReplySettings.getState().choose(true),
      },
    ],
    { cancelable: false },
  );
}

const inFlight = new Map<
  string,
  { controller: AbortController; task: Promise<void> }
>();
const personalAgentInFlight = new Map<string, Promise<void>>();

/** Send only this recording's on-device transcript to the cloud Personal Agent. */
export function submitRecordingToPersonalAgent(
  uri: string,
  researchRequests?: string[],
  signal?: AbortSignal,
): Promise<void> {
  const key = recordingKey(uri);
  const existing = personalAgentInFlight.get(key);
  if (existing) return existing;
  const file = useRecordingStore
    .getState()
    .files.find(item => sameRecording(item.uri, uri));
  if (!file?.transcript?.trim())
    return Promise.reject(new Error('请先完成录音文字识别'));
  const transcript = file.transcript.trim();
  const requestId = newCreatorAgentRequestId();
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort);
  if (signal?.aborted) controller.abort();
  const task = Promise.resolve().then(async () => {
    useRecordingStore.getState().setReply(uri, {
      personalAgentRunId: requestId,
      personalAgentState: 'running',
      personalAgentProgress: '正在连接云端 Personal Agent',
      personalAgentReply: undefined,
      personalAgentSources: undefined,
      personalAgentArtifacts: undefined,
      personalAgentError: undefined,
    });
    try {
      const result = await runCreatorAgentTask({
        requestId,
        signal: controller.signal,
        message: [
          '以下是用户刚刚在 Spur App 录音后由手机本机识别出的语音内容。请把它当作用户本轮的原始请求，按其真实意图执行，并用中文回复。',
          '若请求要求研究公开资料，请实际调用可用的网页工具并依据结果回答。涉及发送、购买、删除等外部或不可逆操作时，先向用户请求确认。',
          researchRequests
            ? '本次只执行以下已从录音提取的公开网页只读研究请求。不要登录、发送、发布、删除、交易或修改外部数据；遇到需要此类操作时停止并询问。'
            : '',
          `录音转写：\n${
            researchRequests ? researchRequests.join('\n') : transcript
          }`,
        ].join('\n\n'),
        onProgress: progress => {
          const current = useRecordingStore
            .getState()
            .files.find(item => sameRecording(item.uri, uri));
          if (
            current?.transcript === file.transcript &&
            !controller.signal.aborted
          )
            useRecordingStore.getState().setReply(uri, {
              personalAgentState: 'running',
              personalAgentProgress: progress.progress,
              personalAgentRunId: requestId,
            });
        },
      });
      const current = useRecordingStore
        .getState()
        .files.find(item => sameRecording(item.uri, uri));
      if (controller.signal.aborted || current?.transcript !== file.transcript)
        throw new Error('录音文字已更新或请求已停止，请核对后重试');
      useRecordingStore.getState().setReply(uri, {
        personalAgentRunId: result.requestId,
        personalAgentState: 'done',
        personalAgentProgress: '任务完成',
        personalAgentReply: result.response,
        personalAgentSources: result.sources,
        personalAgentArtifacts: result.artifacts,
        personalAgentError: undefined,
      });
    } catch (error) {
      const current = useRecordingStore
        .getState()
        .files.find(item => sameRecording(item.uri, uri));
      if (current?.transcript === file.transcript)
        useRecordingStore.getState().setReply(uri, {
          personalAgentState: 'failed',
          personalAgentProgress: undefined,
          personalAgentError: (error as Error).message,
        });
      throw error;
    } finally {
      signal?.removeEventListener('abort', abort);
      personalAgentInFlight.delete(key);
    }
  });
  personalAgentInFlight.set(key, task);
  return task;
}

export function cancelRecordingReply(uri: string) {
  inFlight.get(recordingKey(uri))?.controller.abort();
}

export function generateRecordingReply(uri: string): Promise<void> {
  const key = recordingKey(uri);
  const existing = inFlight.get(key);
  if (existing) return existing.task;
  const file = useRecordingStore
    .getState()
    .files.find(item => sameRecording(item.uri, uri));
  if (!file?.transcript?.trim())
    return Promise.reject(new Error('请先完成录音文字识别'));
  const transcript = file.transcript;
  if (transcript.length > 8000)
    return Promise.reject(
      new Error('录音文字超过 8000 字，请在笔记中分段后发送 AI'),
    );
  const controller = new AbortController();
  // Queue the work by one microtask so the registry is populated before store events.
  const task = Promise.resolve().then(async () => {
    const source = recordingSource(file);
    let intentRevision: number | undefined;
    useRecordingStore.getState().setReply(uri, {
      aiReply: undefined,
      aiReplyState: 'working',
      aiReplyError: undefined,
    });
    try {
      if (controller.signal.aborted) throw new Error('AI 回复已取消');
      {
        intentRevision = await beginInterpretation(source);
        const result = await runCreatorAgentTask({
          requestId: newCreatorAgentRequestId(),
          signal: controller.signal,
          message: CAPTURE_PROTOCOL + '\n本条录音原文：\n' + transcript,
        });
        const parsed = parseEnvelope(result.response, transcript);
        const current = useRecordingStore
          .getState()
          .files.find(item => sameRecording(item.uri, uri));
        if (controller.signal.aborted || current?.transcript !== transcript)
          throw new Error('录音已更新或分析已取消');
        useIntentStore
          .getState()
          .finish(source, intentRevision, parsed.intents);
        useRecordingStore.getState().setReply(uri, {
          aiReply: parsed.reply,
          aiReplyState: 'done',
          aiReplyError: undefined,
        });
        const requests = parsed.intents
          .filter(item => item.execution === 'research')
          .map(item => item.sourceSpan);
        // Classification is settled before execution. Tool failures have their own retry state.
        if (requests.length)
          await submitRecordingToPersonalAgent(
            uri,
            requests,
            controller.signal,
          ).catch(() => undefined);
        return;
      }
    } catch (error) {
      if (intentRevision !== undefined)
        useIntentStore
          .getState()
          .fail(source.key, intentRevision, (error as Error).message);
      const message = controller.signal.aborted
        ? 'AI 回复已暂停，已生成内容已保留，可点击重试'
        : (error as Error).message;
      const current = useRecordingStore
        .getState()
        .files.find(item => sameRecording(item.uri, uri));
      if (current?.transcript === transcript)
        useRecordingStore
          .getState()
          .setReply(uri, { aiReplyState: 'failed', aiReplyError: message });
      throw new Error(message);
    } finally {
      inFlight.delete(key);
    }
  });
  inFlight.set(key, { controller, task });
  return task;
}

export function startAutomaticReplies() {
  let stopped = false;
  let running = false;
  let active = AppState.currentState === 'active';
  let currentUri: string | undefined;
  // An interrupted request may already have reached the provider. Require manual retry.
  useRecordingStore
    .getState()
    .files.filter(
      file =>
        file.aiReplyState === 'working' &&
        !inFlight.has(recordingKey(file.uri)),
    )
    .forEach(file =>
      useRecordingStore.getState().setReply(file.uri, {
        aiReplyState: 'failed',
        aiReplyError: '上次 AI 回复未完成，请点击重试',
      }),
    );
  useRecordingStore
    .getState()
    .files.filter(
      file =>
        file.personalAgentState === 'running' &&
        !personalAgentInFlight.has(recordingKey(file.uri)),
    )
    .forEach(file =>
      useRecordingStore.getState().setReply(file.uri, {
        personalAgentState: 'failed',
        personalAgentProgress: undefined,
        personalAgentError: '上次任务连接已中断，请先核对结果后重试。',
      }),
    );
  const enabled = () => useReplySettings.getState().choice === 'enabled';
  const pump = async () => {
    if (stopped || running || !active || !enabled()) return;
    running = true;
    try {
      while (!stopped && active && enabled()) {
        const file = useRecordingStore
          .getState()
          .files.find(
            item =>
              item.transcript?.trim() &&
              !item.aiReply &&
              !item.aiReplyState &&
              !useReplySettings
                .getState()
                .excludedUris.some(uri => sameRecording(uri, item.uri)),
          );
        if (!file) break;
        currentUri = file.uri;
        try {
          await generateRecordingReply(file.uri);
        } catch (error) {
          // Validation failures must also settle; otherwise the queue would retry forever.
          const current = useRecordingStore
            .getState()
            .files.find(item => sameRecording(item.uri, file.uri));
          if (current?.transcript === file.transcript)
            useRecordingStore.getState().setReply(file.uri, {
              aiReplyState: 'failed',
              aiReplyError: (error as Error).message,
            });
        } finally {
          currentUri = undefined;
        }
      }
    } finally {
      running = false;
    }
  };
  const unsubscribe = useRecordingStore.subscribe(state => {
    if (
      currentUri &&
      !state.files.some(file => sameRecording(file.uri, currentUri))
    )
      cancelRecordingReply(currentUri);
    pump();
  });
  const settings = useReplySettings.subscribe(() => {
    if (!enabled() && currentUri) cancelRecordingReply(currentUri);
    pump();
  });
  const app = AppState.addEventListener('change', state => {
    active = state === 'active';
    if (!active && currentUri) cancelRecordingReply(currentUri);
    else pump();
  });
  pump();
  return () => {
    stopped = true;
    unsubscribe();
    settings();
    app.remove();
    if (currentUri) cancelRecordingReply(currentUri);
  };
}
