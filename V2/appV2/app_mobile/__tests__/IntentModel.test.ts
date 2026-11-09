import {
  initialState,
  Interpretation,
  needsAttention,
  parseEnvelope,
  parseLocalTime,
  Source,
} from '../src/intent/model';
import { allItems, useIntentStore } from '../src/intent/store';
import {
  beginInterpretation,
  organizeNote,
  readableReply,
  reconcileIntentSources,
  settleInterpretation,
  startIntentSync,
} from '../src/intent/runtime';
import { useNotesStore } from '../src/notes/useNotesStore';
import { useRecordingStore } from '../src/ring/store/useRecordingStore';
import { chat } from '../src/services/chatApi';
jest.mock('../src/services/chatApi', () => ({ chat: jest.fn() }));
const text = '我决定拍AI眼镜。提醒我明天写脚本。我答应摄影师周五给脚本。';
function proposal(patch: Partial<Interpretation> = {}): Interpretation {
  return {
    kind: 'idea',
    frame: 'idea',
    title: 'AI glasses',
    summary: 'Explore an idea',
    sourceSpan: 'AI眼镜',
    confidence: 0.95,
    actor: '',
    counterparty: '',
    deliverable: '',
    direction: 'unknown',
    dateText: '',
    sections: [{ heading: 'Idea', body: 'An idea, not a commitment.' }],
    checklist: [],
    questions: [],
    email: null,
    change: 'update',
    ...patch,
  };
}
function prepare(source: Source, intents: Interpretation[]) {
  const revision = useIntentStore.getState().begin(source);
  useIntentStore.getState().finish(source, revision, intents);
  return useIntentStore
    .getState()
    .captures[source.key].items.filter(i => i.state !== 'superseded');
}
beforeEach(async () => {
  await Promise.resolve();
  useIntentStore.setState({ captures: {}, loadError: '' });
  useNotesStore.setState({ notes: [] });
  useRecordingStore.setState({ files: [] });
  jest.clearAllMocks();
});
test('multi-intent extraction preserves evidence and a decision is not a reminder', () => {
  const parsed = parseEnvelope(
    JSON.stringify({
      reply: 'Recorded',
      intents: [
        proposal({ kind: 'decision', frame: 'decision' }),
        proposal({
          kind: 'instruction',
          frame: 'reminder',
          sourceSpan: '提醒我明天写脚本',
          dateText: '明天',
        }),
      ],
    }),
    text,
  );
  expect(parsed.intents).toHaveLength(2);
  expect(initialState(parsed.intents[0])).toBe('recorded');
  expect(initialState(parsed.intents[1])).toBe('needs_clarification');
});
test('ideas never become attention tasks or keep manufactured questions', () => {
  const parsed = parseEnvelope(
    JSON.stringify({
      reply: 'Idea',
      intents: [proposal({ questions: ['When should this be done?'] })],
    }),
    text,
  );
  expect(parsed.intents[0].questions).toEqual([]);
  const [item] = prepare(
    { key: 'note:1', text, title: 'Idea', capturedAt: 1 },
    parsed.intents,
  );
  expect(needsAttention(item)).toBe(false);
  expect(item.state).toBe('recorded');
  expect(() =>
    useIntentStore
      .getState()
      .change(item.id, item.revision, { dueAt: Date.now() + 10000 }, 'Invalid'),
  ).toThrow();
});
test('invalid evidence, invented dates, unsupported frames and low confidence are handled explicitly', () => {
  expect(() =>
    parseEnvelope(
      JSON.stringify({
        reply: 'x',
        intents: [proposal({ sourceSpan: 'not in source' })],
      }),
      text,
    ),
  ).toThrow();
  expect(() =>
    parseEnvelope(
      JSON.stringify({
        reply: 'x',
        intents: [proposal({ kind: 'idea', frame: 'email' })],
      }),
      text,
    ),
  ).toThrow();
  const parsed = parseEnvelope(
    JSON.stringify({
      reply: 'x',
      intents: [
        proposal({
          kind: 'instruction',
          frame: 'reminder',
          dateText: '2030-01-01',
          confidence: 0.4,
        }),
      ],
    }),
    text,
  );
  expect(parsed.intents[0]).toMatchObject({
    kind: 'unknown',
    frame: 'clarification',
    dateText: '',
  });
  expect(parsed.intents[0].questions.length).toBeGreaterThan(0);
});
test('commitment direction distinguishes obligations and missing people trigger clarification', () => {
  expect(
    initialState(
      proposal({
        kind: 'commitment',
        frame: 'commitment',
        direction: 'other_owes',
      }),
    ),
  ).toBe('waiting');
  expect(
    initialState(
      proposal({
        kind: 'commitment',
        frame: 'commitment',
        direction: 'user_owes',
      }),
    ),
  ).toBe('pending');
  const parsed = parseEnvelope(
    JSON.stringify({
      reply: 'x',
      intents: [proposal({ kind: 'commitment', frame: 'commitment' })],
    }),
    text,
  );
  expect(initialState(parsed.intents[0])).toBe('needs_clarification');
});
test('email recipient cannot be invented and no state action sends an email', () => {
  const parsed = parseEnvelope(
    JSON.stringify({
      reply: 'Draft',
      intents: [
        proposal({
          kind: 'instruction',
          frame: 'email',
          email: {
            to: 'invented@example.com',
            subject: 'Hello',
            body: 'Draft only',
          },
        }),
      ],
    }),
    text,
  );
  expect(parsed.intents[0].email?.to).toBe('');
  const [item] = prepare(
    { key: 'note:1', text, title: 'Email', capturedAt: 1 },
    [proposal({ kind: 'instruction', frame: 'email' })],
  );
  expect(item.state).toBe('needs_confirmation');
  expect(() =>
    useIntentStore.getState().transition(item.id, item.revision, 'completed'),
  ).toThrow();
  expect(() =>
    useIntentStore.getState().transition(item.id, item.revision, 'working'),
  ).toThrow();
});
test('source revision and deletion invalidate an in-flight response', () => {
  const source = { key: 'note:1', text, title: 'x', capturedAt: 1 };
  const revision = useIntentStore.getState().begin(source);
  useIntentStore.getState().reconcile([{ ...source, text: 'Changed' }]);
  useIntentStore.getState().finish(source, revision, [proposal()]);
  expect(allItems()).toEqual([]);
  useIntentStore.getState().reconcile([]);
  useIntentStore.getState().finish(source, revision, [proposal()]);
  expect(allItems()).toEqual([]);
});
test('stale edits fail and user changes keep an audit trail', () => {
  const [item] = prepare({ key: 'note:1', text, title: 'x', capturedAt: 1 }, [
    proposal(),
  ]);
  useIntentStore
    .getState()
    .change(item.id, item.revision, { pinned: true }, 'User pinned');
  expect(() =>
    useIntentStore
      .getState()
      .change(item.id, item.revision, { title: 'stale' }, 'Old editor'),
  ).toThrow();
  expect(allItems()[0].history.at(-1)?.reason).toBe('User pinned');
});
test('reordered reclassification keeps identities and never reopens a completed obligation', () => {
  const source = { key: 'note:1', text, title: 'x', capturedAt: 1 };
  const obligation = proposal({
    kind: 'commitment',
    frame: 'commitment',
    actor: '我',
    counterparty: '摄影师',
    deliverable: '脚本',
    direction: 'user_owes',
    sourceSpan: '我答应摄影师周五给脚本',
  });
  const [idea, task] = prepare(source, [proposal(), obligation]);
  useIntentStore.getState().transition(task.id, task.revision, 'completed');
  const reordered = prepare(source, [obligation, proposal()]);
  expect(reordered[0].id).toBe(task.id);
  expect(reordered[0].state).toBe('completed');
  expect(reordered[1].id).toBe(idea.id);
});
test('correction requires the chosen target, pauses it, and links evidence without executing anything', () => {
  const [target] = prepare(
    { key: 'note:1', text, title: 'task', capturedAt: 1 },
    [proposal({ kind: 'instruction', frame: 'script' })],
  );
  const [update] = prepare(
    { key: 'note:2', text: '先暂停', title: 'update', capturedAt: 2 },
    [
      proposal({
        kind: 'correction',
        frame: 'clarification',
        sourceSpan: '先暂停',
        change: 'pause',
      }),
    ],
  );
  expect(update.state).toBe('needs_clarification');
  expect(() =>
    useIntentStore
      .getState()
      .apply(update.id, update.revision, update.id, update.revision),
  ).toThrow();
  useIntentStore
    .getState()
    .apply(update.id, update.revision, target.id, target.revision);
  expect(allItems().find(i => i.id === target.id)?.state).toBe('paused');
  expect(allItems().find(i => i.id === update.id)?.targetId).toBe(target.id);
});
test('a prepared follow-up changes the original only after explicit adoption', () => {
  const [target] = prepare(
    { key: 'note:1', text, title: 'task', capturedAt: 1 },
    [
      proposal({
        kind: 'instruction',
        frame: 'report',
        questions: ['Which audience?'],
      }),
    ],
  );
  const [replacement] = prepare(
    {
      key: 'note:2',
      parentItemId: target.id,
      parentRevision: target.revision,
      text: 'For creators',
      title: 'update',
      capturedAt: 2,
    },
    [
      proposal({
        kind: 'instruction',
        frame: 'report',
        sourceSpan: 'For creators',
        summary: 'New report',
        sections: [{ heading: 'Report', body: 'Full report for creators.' }],
      }),
    ],
  );
  expect(allItems().find(i => i.id === target.id)?.state).toBe(
    'needs_clarification',
  );
  useIntentStore
    .getState()
    .adopt(replacement.id, replacement.revision, target.id, target.revision);
  expect(allItems().find(i => i.id === target.id)).toMatchObject({
    state: 'ready',
    summary: 'New report',
  });
  expect(allItems().find(i => i.id === replacement.id)?.archived).toBe(true);
});
test('invalid calendar dates and rollover are rejected', () => {
  expect(() => parseLocalTime('2026-02-30 09:00')).toThrow();
  expect(() => parseLocalTime('tomorrow')).toThrow();
  expect(() => parseLocalTime('2026-10-29 25:00')).toThrow();
  expect(Number.isFinite(parseLocalTime('2026-10-29 09:00'))).toBe(true);
});
test('malformed classification preserves readable reply and records a manual retry state', async () => {
  const note = { id: '1', text, title: 'x', createdAt: 1 };
  useNotesStore.getState().save(note);
  const source = { key: 'note:1', text, title: 'x', capturedAt: 1 };
  const revision = await beginInterpretation(source);
  expect(
    settleInterpretation(source, revision, 'A plain readable answer'),
  ).toBe('A plain readable answer');
  expect(useIntentStore.getState().captures[source.key].state).toBe('failed');
  expect(readableReply('{"reply":')).toBe('');
});
test('note requests deduplicate and do not include unrelated records', async () => {
  const note = { id: '1', text, title: 'x', createdAt: 1 };
  useNotesStore.getState().save(note);
  useNotesStore.getState().save({
    id: 'secret',
    text: 'UNRELATED_PRIVATE_TEXT',
    title: 'private',
    createdAt: 0,
  });
  (chat as jest.Mock).mockResolvedValue(
    JSON.stringify({ reply: 'Idea', intents: [proposal()] }),
  );
  const first = organizeNote(note),
    second = organizeNote(note);
  expect(first).toBe(second);
  await first;
  expect(chat).toHaveBeenCalledTimes(1);
  expect(JSON.stringify((chat as jest.Mock).mock.calls)).not.toContain(
    'UNRELATED_PRIVATE_TEXT',
  );
  expect(allItems()).toHaveLength(1);
  useNotesStore.getState().remove('1');
  reconcileIntentSources();
  expect(allItems()).toEqual([]);
});
test('interrupted classification becomes a manual retry instead of issuing a model request', () => {
  const note = { id: '1', text, title: 'x', createdAt: 1 };
  useNotesStore.getState().save(note);
  useIntentStore
    .getState()
    .begin({ key: 'note:1', text, title: 'x', capturedAt: 1 });
  const stop = startIntentSync();
  expect(useIntentStore.getState().captures['note:1'].state).toBe('failed');
  expect(chat).not.toHaveBeenCalled();
  stop();
});

test('an explicit replacement decision supersedes the old direction and keeps the new one active', () => {
  const [target] = prepare(
    { key: 'note:1', text, title: 'Decision', capturedAt: 1 },
    [proposal({ kind: 'decision', frame: 'decision' })],
  );
  const [update] = prepare(
    { key: 'note:2', text: '改拍相机', title: 'Change', capturedAt: 2 },
    [
      proposal({
        kind: 'correction',
        frame: 'clarification',
        sourceSpan: '改拍相机',
        replacement: '相机',
        change: 'replace',
      }),
    ],
  );
  useIntentStore
    .getState()
    .apply(update.id, update.revision, target.id, target.revision);
  expect(allItems().find(i => i.id === target.id)?.state).toBe('superseded');
  expect(allItems().find(i => i.id === update.id)).toMatchObject({
    kind: 'decision',
    frame: 'decision',
    state: 'recorded',
    summary: '相机',
    matterId: target.matterId,
  });
});

test('prepared revisions cannot overwrite an original that changed during generation', () => {
  const [target] = prepare(
    { key: 'note:1', text, title: 'Report', capturedAt: 1 },
    [proposal({ kind: 'instruction', frame: 'report' })],
  );
  const [draft] = prepare(
    {
      key: 'note:2',
      parentItemId: target.id,
      parentRevision: target.revision,
      text: 'For creators',
      title: 'Update',
      capturedAt: 2,
    },
    [
      proposal({
        kind: 'instruction',
        frame: 'report',
        sourceSpan: 'For creators',
      }),
    ],
  );
  useIntentStore
    .getState()
    .change(
      target.id,
      target.revision,
      { summary: 'A newer edit' },
      'User edit',
    );
  const current = allItems().find(i => i.id === target.id)!;
  expect(() =>
    useIntentStore
      .getState()
      .adopt(draft.id, draft.revision, current.id, current.revision),
  ).toThrow();
  expect(allItems().find(i => i.id === target.id)?.summary).toBe(
    'A newer edit',
  );
});

test('fabricated people and deliverables do not become a confident obligation', () => {
  const parsed = parseEnvelope(
    JSON.stringify({
      reply: 'x',
      intents: [
        proposal({
          kind: 'commitment',
          frame: 'commitment',
          actor: 'user',
          counterparty: 'Invented Person',
          deliverable: 'Invented Contract',
          direction: 'user_owes',
        }),
      ],
    }),
    text,
  );
  expect(parsed.intents[0].counterparty).toBe('');
  expect(parsed.intents[0].deliverable).toBe('');
  expect(initialState(parsed.intents[0])).toBe('needs_clarification');
});
