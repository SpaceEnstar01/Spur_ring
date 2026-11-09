import { AppState } from 'react-native';
import { useRecordingStore } from '../src/ring/store/useRecordingStore';
import { useIntentStore } from '../src/intent/store';
import { recordingSource } from '../src/intent/runtime';
import {
  generateRecordingReply,
  startAutomaticReplies,
  useReplySettings,
  cancelRecordingReply,
} from '../src/services/automaticReplies';
import { runCreatorAgentTask } from '../src/services/creatorAgentApi';
jest.mock('../src/services/creatorAgentApi', () => ({
  newCreatorAgentRequestId: jest.fn(() => 'request'),
  runCreatorAgentTask: jest.fn(),
}));
const file = {
  uri: 'file:///voice-recordings/test.m4a',
  name: 'test.m4a',
  timestamp: 100,
  size: 100,
  transcript: '我觉得可以做一期AI眼镜的视频。',
};
const item = (patch = {}) => ({
  kind: 'idea',
  frame: 'idea',
  title: '视频灵感',
  summary: 'AI眼镜',
  sourceSpan: file.transcript,
  confidence: 0.95,
  sections: [],
  questions: [],
  checklist: [],
  ...patch,
});
const answer = (intents: unknown[] = [], reply = '录音摘要') => ({
  requestId: 'request',
  response: JSON.stringify({ reply, intents }),
  sources: [],
  artifacts: [],
});
let stop: (() => void) | undefined;
const flush = async () => {
  for (let n = 0; n < 60; n++) await Promise.resolve();
};
beforeEach(async () => {
  await flush();
  jest.clearAllMocks();
  useRecordingStore.setState({ files: [file], deletedUris: [] });
  useIntentStore.setState({ captures: {}, loadError: '' });
  useReplySettings.setState({ choice: 'undecided', excludedUris: [] });
  AppState.currentState = 'active';
  jest
    .spyOn(AppState, 'addEventListener')
    .mockReturnValue({ remove: jest.fn() });
  (runCreatorAgentTask as jest.Mock).mockResolvedValue(answer());
});
afterEach(async () => {
  stop?.();
  stop = undefined;
  await flush();
  jest.restoreAllMocks();
});
test('does not upload text before automation consent', async () => {
  stop = startAutomaticReplies();
  await flush();
  expect(runCreatorAgentTask).not.toHaveBeenCalled();
});
test('new transcription automatically uses Personal Agent once and resync does not duplicate', async () => {
  useRecordingStore.setState({ files: [{ ...file, transcript: undefined }] });
  useReplySettings.getState().choose(true);
  stop = startAutomaticReplies();
  useRecordingStore.getState().setTranscript(file.uri, file.transcript);
  await flush();
  expect(runCreatorAgentTask).toHaveBeenCalledTimes(1);
  expect(runCreatorAgentTask).toHaveBeenCalledWith(
    expect.objectContaining({
      message: expect.stringContaining(file.transcript),
    }),
  );
  useRecordingStore.getState().merge([file]);
  await flush();
  expect(runCreatorAgentTask).toHaveBeenCalledTimes(1);
});
test('an idea enters the existing workspace ledger without tool execution', async () => {
  (runCreatorAgentTask as jest.Mock).mockResolvedValue(answer([item()]));
  await generateRecordingReply(file.uri);
  expect(
    useIntentStore.getState().captures[recordingSource(file).key].items[0],
  ).toMatchObject({ kind: 'idea', state: 'recorded' });
  expect(runCreatorAgentTask).toHaveBeenCalledTimes(1);
});
test('ordinary conversation keeps a summary with no forced task', async () => {
  await generateRecordingReply(file.uri);
  expect(
    useIntentStore.getState().captures[recordingSource(file).key].items,
  ).toEqual([]);
  expect(useRecordingStore.getState().files[0]).toMatchObject({
    aiReply: '录音摘要',
    aiReplyState: 'done',
  });
});
test('only an explicit validated research instruction starts a second tool-backed request', async () => {
  const transcript = '帮我用浏览器打开YouTube读取标题';
  useRecordingStore.setState({ files: [{ ...file, transcript }] });
  (runCreatorAgentTask as jest.Mock)
    .mockResolvedValueOnce(
      answer([
        item({
          kind: 'instruction',
          frame: 'report',
          sourceSpan: transcript,
          execution: 'research',
        }),
      ]),
    )
    .mockResolvedValueOnce({
      requestId: 'run',
      response: 'YouTube',
      sources: [{ title: 'YouTube', url: 'https://www.youtube.com/' }],
      artifacts: [],
    });
  await generateRecordingReply(file.uri);
  expect(runCreatorAgentTask).toHaveBeenCalledTimes(2);
  expect(useRecordingStore.getState().files[0]).toMatchObject({
    personalAgentState: 'done',
    personalAgentReply: 'YouTube',
  });
});
test('model cannot turn an idea or a low confidence instruction into research execution', async () => {
  (runCreatorAgentTask as jest.Mock).mockResolvedValue(
    answer([
      item({ execution: 'research' }),
      item({
        kind: 'instruction',
        frame: 'report',
        confidence: 0.7,
        execution: 'research',
      }),
    ]),
  );
  await generateRecordingReply(file.uri);
  expect(runCreatorAgentTask).toHaveBeenCalledTimes(1);
});
test('invalid classification fails without inventing workspace items or executing tools', async () => {
  (runCreatorAgentTask as jest.Mock).mockResolvedValue({
    response: 'not JSON',
  });
  await expect(generateRecordingReply(file.uri)).rejects.toThrow();
  expect(useRecordingStore.getState().files[0].aiReplyState).toBe('failed');
  expect(runCreatorAgentTask).toHaveBeenCalledTimes(1);
});
test('failure does not loop on resync, manual retry remains available', async () => {
  (runCreatorAgentTask as jest.Mock).mockRejectedValueOnce(new Error('401'));
  useReplySettings.getState().choose(true);
  stop = startAutomaticReplies();
  await flush();
  useRecordingStore.getState().merge([file]);
  await flush();
  expect(runCreatorAgentTask).toHaveBeenCalledTimes(1);
  await generateRecordingReply(file.uri);
  expect(useRecordingStore.getState().files[0].aiReplyState).toBe('done');
});
test('duplicate requests are shared; cancellation and changed transcript reject stale results', async () => {
  let resolve!: (v: unknown) => void;
  (runCreatorAgentTask as jest.Mock).mockImplementation(
    () =>
      new Promise(r => {
        resolve = r;
      }),
  );
  const first = generateRecordingReply(file.uri);
  const outcome = first.catch(() => undefined);
  expect(generateRecordingReply(file.uri)).toBe(first);
  await flush();
  cancelRecordingReply(file.uri);
  useRecordingStore.getState().setTranscript(file.uri, '新的原文');
  resolve(answer([item()]));
  await outcome;
  expect(useRecordingStore.getState().files[0].aiReply).toBeUndefined();
  expect(
    useIntentStore.getState().captures[recordingSource(file).key].items,
  ).toEqual([]);
});
test('oversized transcripts fail without sending truncated content', async () => {
  useRecordingStore.setState({
    files: [{ ...file, transcript: '字'.repeat(8001) }],
  });
  await expect(generateRecordingReply(file.uri)).rejects.toThrow('8000');
  expect(runCreatorAgentTask).not.toHaveBeenCalled();
});
