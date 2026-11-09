import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { AgentDashboard, AgentEntry } from '../src/components/AgentDashboard';
import { useIntentStore } from '../src/intent/store';
import { useRecordingStore } from '../src/ring/store/useRecordingStore';
import { recordingSource } from '../src/intent/runtime';
import { parseEnvelope } from '../src/intent/model';
const file = {
  uri: 'file:///voice-recordings/test.m4a',
  name: 'test.m4a',
  timestamp: 100,
  size: 100,
  transcript: '我觉得AI眼镜值得拍',
};
let renderer: TestRenderer.ReactTestRenderer;
async function mount(entries: AgentEntry[] = []) {
  await act(async () => {
    renderer = TestRenderer.create(
      <AgentDashboard
        entries={entries}
        onOpen={jest.fn()}
        onDelete={jest.fn()}
        onRecord={jest.fn()}
        onDevice={jest.fn()}
        onSettings={jest.fn()}
      />,
    );
  });
}
const entry = (): AgentEntry => ({
  id: file.uri,
  title: '录音',
  text: file.transcript,
  time: 100,
  uri: file.uri,
  file: useRecordingStore.getState().files[0],
});
const tree = () => JSON.stringify(renderer.toJSON());
beforeEach(() => {
  useIntentStore.setState({ captures: {}, loadError: '' });
  useRecordingStore.setState({ files: [file], deletedUris: [] });
});
afterEach(async () => {
  await act(async () => renderer?.unmount());
});
test('empty workspace explains automatic organization without demo deliveries', async () => {
  await mount();
  expect(tree()).toContain('从一段录音开始');
  expect(tree()).not.toContain('Travel Video Performance Analysis');
});
test('ideas remain source-backed cards in the same workspace', async () => {
  const source = recordingSource(file);
  const revision = useIntentStore.getState().begin(source);
  const parsed = parseEnvelope(
    JSON.stringify({
      reply: '记录',
      intents: [
        {
          kind: 'idea',
          frame: 'idea',
          title: 'AI眼镜选题',
          summary: '视频灵感',
          sourceSpan: file.transcript,
          confidence: 0.95,
        },
      ],
    }),
    file.transcript,
  );
  useIntentStore.getState().finish(source, revision, parsed.intents);
  await mount([entry()]);
  expect(tree()).toContain('想法、灵感与知识');
  expect(tree()).toContain('AI眼镜选题');
});
test('ordinary conversation with no intent stays out of workspace tasks', async () => {
  const source = recordingSource(file);
  const revision = useIntentStore.getState().begin(source);
  useIntentStore.getState().finish(source, revision, []);
  useRecordingStore
    .getState()
    .setReply(file.uri, { aiReply: '普通对话摘要', aiReplyState: 'done' });
  await mount([entry()]);
  expect(tree()).not.toContain('普通对话摘要');
});
test('actual execution results and sources are shown in workspace', async () => {
  useRecordingStore.getState().setReply(file.uri, {
    personalAgentState: 'done',
    personalAgentReply: '实际研究结果',
    personalAgentSources: [
      { title: 'YouTube', url: 'https://www.youtube.com/' },
    ],
  });
  await mount([entry()]);
  expect(tree()).toContain('实际研究结果');
  expect(tree()).not.toContain('YouTube');
  const viewResult = renderer.root.findAll(
    node =>
      node.props.accessibilityLabel === 'View Agent result' &&
      typeof node.props.onPress === 'function',
  )[0];
  await act(async () => viewResult.props.onPress());
  expect(tree()).toContain('YouTube');
  expect(tree()).toContain('来源录音');
});
