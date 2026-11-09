import { AppState } from 'react-native';
import { useRecordingStore } from '../src/ring/store/useRecordingStore';
import {
  useReplySettings,
  startAutomaticReplies,
} from '../src/services/automaticReplies';
import { startAutomaticRecognition } from '../src/services/automaticRecognition';
import { useAgentSettings } from '../src/agent/settings';
import { useAlarmStore } from '../src/services/agentAlarms';
import { runCreatorAgentTask } from '../src/services/creatorAgentApi';
import { transcribe } from '../src/services/transcriptionApi';

jest.mock('../src/services/creatorAgentApi', () => ({
  newCreatorAgentRequestId: () => 'request',
  runCreatorAgentTask: jest.fn(),
}));
jest.mock('../src/services/transcriptionApi', () => ({
  transcribe: jest.fn(),
}));
jest.mock('../src/services/phoneAudio', () => ({
  phoneAudio: {
    getPermissions: jest.fn(async () => ({
      speech: true,
      onDeviceAvailable: true,
    })),
  },
}));
const file = {
  uri: 'file:///voice-recordings/pipeline.m4a',
  name: 'pipeline.m4a',
  timestamp: 100,
  size: 100,
};
let stopRecognition: () => void, stopReplies: () => void;
const flush = async () => {
  for (let i = 0; i < 60; i++) await Promise.resolve();
};
beforeEach(() => {
  jest.clearAllMocks();
  AppState.currentState = 'active';
  jest
    .spyOn(AppState, 'addEventListener')
    .mockReturnValue({ remove: jest.fn() });
  useAgentSettings.setState({
    loaded: true,
    enabledAt: null,
    bindings: [],
    base: '',
  });
  useAlarmStore.setState({
    loaded: true,
    enabledAt: null,
    actions: [],
    error: '',
  });
  useRecordingStore.setState({ files: [], deletedUris: [] });
  useReplySettings.setState({ choice: 'disabled', excludedUris: [] });
  (transcribe as jest.Mock).mockResolvedValue('怎么让旅行视频更有吸引力？');
  (runCreatorAgentTask as jest.Mock).mockResolvedValue({
    response: JSON.stringify({
      reply: '先确定观众和主题，再设计前三秒的开场。',
      intents: [],
    }),
  });
});
afterEach(async () => {
  stopRecognition?.();
  stopReplies?.();
  await flush();
  jest.restoreAllMocks();
});
test('new recording flows through local transcription into a saved AI reply automatically after consent', async () => {
  useReplySettings.getState().choose(true);
  stopReplies = startAutomaticReplies();
  stopRecognition = startAutomaticRecognition();
  useRecordingStore.getState().merge([file]);
  await flush();
  expect(useRecordingStore.getState().files[0]).toMatchObject({
    recognitionState: 'done',
    aiReplyState: 'done',
    aiReply: expect.stringContaining('前三秒'),
  });
  expect(runCreatorAgentTask).toHaveBeenCalledTimes(1);
  useRecordingStore.getState().merge([file]);
  await flush();
  expect(transcribe).toHaveBeenCalledTimes(1);
  expect(runCreatorAgentTask).toHaveBeenCalledTimes(1);
});
test('without AI consent a recording still transcribes locally but never sends text to model', async () => {
  stopReplies = startAutomaticReplies();
  stopRecognition = startAutomaticRecognition();
  useRecordingStore.getState().merge([file]);
  await flush();
  expect(useRecordingStore.getState().files[0].transcript).toContain(
    '旅行视频',
  );
  expect(runCreatorAgentTask).not.toHaveBeenCalled();
});
