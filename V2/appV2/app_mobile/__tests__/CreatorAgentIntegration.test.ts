import { useRecordingStore } from '../src/ring/store/useRecordingStore';
import { submitRecordingToPersonalAgent } from '../src/services/automaticReplies';
import {
  newCreatorAgentRequestId,
  runCreatorAgentTask,
} from '../src/services/creatorAgentApi';

jest.mock('../src/services/creatorAgentApi', () => ({
  newCreatorAgentRequestId: jest.fn(() => 'test-request-id'),
  runCreatorAgentTask: jest.fn(),
}));

const recording = {
  uri: 'file:///voice-recordings/agent-test.m4a',
  name: 'agent-test.m4a',
  timestamp: 100,
  size: 1234,
  transcript: '请搜索 Example Domain 并告诉我页面标题。',
};

beforeEach(() => {
  jest.clearAllMocks();
  useRecordingStore.setState({ files: [recording], deletedUris: [] });
});

test('explicitly sends only the selected recording transcript and saves Agent progress and result', async () => {
  (runCreatorAgentTask as jest.Mock).mockImplementation(async input => {
    input.onProgress?.({ status: 'running', progress: '正在搜索公开资料' });
    return {
      requestId: 'test-request-id',
      response: '页面标题是 Example Domain。',
      sources: [{ title: 'Example Domain', url: 'https://example.com/' }],
      artifacts: [],
    };
  });

  await submitRecordingToPersonalAgent(recording.uri);

  expect(newCreatorAgentRequestId).toHaveBeenCalledTimes(1);
  expect(runCreatorAgentTask).toHaveBeenCalledWith(
    expect.objectContaining({
      requestId: 'test-request-id',
      message: expect.stringContaining(recording.transcript),
      signal: expect.any(AbortSignal),
      onProgress: expect.any(Function),
    }),
  );
  expect(useRecordingStore.getState().files[0]).toMatchObject({
    personalAgentState: 'done',
    personalAgentProgress: '任务完成',
    personalAgentReply: '页面标题是 Example Domain。',
    personalAgentSources: [
      { title: 'Example Domain', url: 'https://example.com/' },
    ],
  });
});

test('does not send a recording before local transcription is ready', async () => {
  useRecordingStore.setState({
    files: [{ ...recording, transcript: undefined }],
    deletedUris: [],
  });

  await expect(submitRecordingToPersonalAgent(recording.uri)).rejects.toThrow(
    '请先完成录音文字识别',
  );
  expect(runCreatorAgentTask).not.toHaveBeenCalled();
});
