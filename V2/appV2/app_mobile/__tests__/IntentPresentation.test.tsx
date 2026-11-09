import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { IntentUpdateCard } from '../src/components/IntentUpdateCard';
import { presentations, presentationFor } from '../src/intent/presentation';
import { IntentItem, parseEnvelope } from '../src/intent/model';
import { legacyPresentation } from '../src/intent/legacyPresentation';
const base: IntentItem = {
  id: 'real-item',
  matterId: 'matter',
  sourceKey: 'source',
  kind: 'instruction',
  frame: 'report',
  title: 'My report',
  summary: 'A real prepared report',
  sourceSpan: 'Research creator tools',
  confidence: 0.9,
  actor: '',
  counterparty: '',
  deliverable: '',
  direction: 'unknown',
  dateText: '',
  sections: [],
  questions: [],
  checklist: [],
  email: null,
  change: 'update',
  revision: 1,
  state: 'ready',
  reason: '',
  createdAt: 1,
  updatedAt: 1,
  read: false,
  pinned: false,
  archived: false,
  history: [],
};
test('ten presentation types remain separate from semantic intent and authority', () => {
  expect(new Set(presentations).size).toBe(10);
  const item = {
    ...base,
    kind: 'idea' as const,
    frame: 'idea' as const,
    presentation: 'partnership' as const,
  };
  expect(presentationFor(item)).toBe('idea');
  expect(presentationFor({ ...base, presentation: 'email' })).toBe('report');
  expect(presentationFor({ ...base, kind: 'correction' })).toBe(
    'clarification',
  );
});
test('task-specific missing information does not turn every topic into the same card', () => {
  expect(
    presentationFor({
      ...base,
      frame: 'email',
      questions: ['Who receives this?'],
    }),
  ).toBe('email');
  expect(
    presentationFor({
      ...base,
      title: '品牌合作提案',
      frame: 'email',
      questions: ['Which brand?'],
    }),
  ).toBe('partnership');
  expect(presentationFor({ ...base, title: '视频数据分析' })).toBe('analytics');
});
test('metrics require literal source evidence and unsupported numbers never produce a chart', () => {
  const source = '播放量从10000次增至12000次。';
  const payload = {
    reply: 'Report',
    intents: [
      {
        ...base,
        presentation: 'analytics',
        sourceSpan: source,
        metrics: [
          {
            label: '播放量',
            value: 12000,
            baseline: 10000,
            unit: '次',
            sourceSpan: source,
          },
          { label: 'Invented', value: 999999, unit: '次', sourceSpan: source },
        ],
      },
    ],
  };
  const parsed = parseEnvelope(JSON.stringify(payload), source);
  expect(parsed.intents[0].metrics).toHaveLength(1);
  expect(parsed.intents[0].metrics?.[0].value).toBe(12000);
  const wrongMagnitude = {
    ...payload,
    intents: [
      {
        ...payload.intents[0],
        metrics: [
          { label: 'Wrong', value: 1200, unit: '次', sourceSpan: source },
        ],
      },
    ],
  };
  expect(
    parseEnvelope(JSON.stringify(wrongMagnitude), source).intents[0].metrics,
  ).toEqual([]);
});
test('legacy presentation changes no stored analysis or task classification', () => {
  const entry = {
    id: 'old',
    title: '拍摄脚本',
    text: '写一份拍摄脚本',
    time: 1,
    file: {
      uri: 'file:///voice-recordings/a.m4a',
      name: 'a',
      timestamp: 1,
      size: 1,
      aiReply:
        'Opening hook: ' +
        'A complete scene with voiceover and a shot list. '.repeat(8),
      transcript: '写一份拍摄脚本',
    },
  };
  const before = JSON.stringify(entry);
  const card = legacyPresentation(entry);
  expect(presentationFor(card)).toBe('script');
  expect(card.kind).toBe('question');
  expect(card.state).toBe('ready');
  expect(JSON.stringify(entry)).toBe(before);
});
test('card previews preserve the original open action and never execute an email', async () => {
  let renderer!: TestRenderer.ReactTestRenderer;
  const open = jest.fn();
  const item = {
    ...base,
    frame: 'email' as const,
    email: { to: 'someone@example.com', subject: 'Follow up', body: 'Hello' },
  };
  await act(() => {
    renderer = TestRenderer.create(
      <IntentUpdateCard item={item} onOpen={open} />,
    );
  });
  const button = renderer.root.findAll(
    n =>
      n.props.accessibilityLabel === 'Review Email Draft: My report' &&
      typeof n.type !== 'string',
  )[0];
  await act(() => button.props.onPress());
  expect(open).toHaveBeenCalledWith(item);
  const tree = JSON.stringify(renderer.toJSON());
  expect(tree).toContain('No email sent');
  expect(tree).not.toContain('Email sent successfully');
  await act(() => renderer.unmount());
});

test('incoming commitments show who owes the delivery rather than the recipient', async () => {
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(() => {
    renderer = TestRenderer.create(
      <IntentUpdateCard
        item={{
          ...base,
          kind: 'commitment',
          frame: 'commitment',
          actor: 'Jack',
          counterparty: 'You',
          direction: 'other_owes',
          deliverable: 'Footage',
          state: 'waiting',
        }}
        onOpen={jest.fn()}
      />,
    );
  });
  const tree = JSON.stringify(renderer.toJSON());
  expect(tree).toContain('WAITING ON');
  expect(tree).toContain('Jack');
  await act(() => renderer.unmount());
});
