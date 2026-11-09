import { AppState } from 'react-native';
import {
  recordingTitle,
  titleFromTranscript,
} from '../src/ring/recordingTitle';
import { useRecordingStore } from '../src/ring/store/useRecordingStore';
import {
  startAutomaticRecognition,
  refreshAutomaticRecognition,
  retryLocalRecognition,
  useRecognitionRuntime,
} from '../src/services/automaticRecognition';
import { transcribe } from '../src/services/transcriptionApi';
import { phoneAudio } from '../src/services/phoneAudio';
import { recordingDeleteMessage } from '../src/services/confirmDeleteEntry';

jest.mock('../src/services/phoneAudio', () => ({
  phoneAudio: { getPermissions: jest.fn() },
}));
jest.mock('../src/services/transcriptionApi', () => ({
  transcribe: jest.fn(),
}));
const file = {
  uri: 'file:///voice-recordings/ring.m4a',
  name: 'ring.m4a',
  timestamp: 100,
  size: 20,
};
let stop: (() => void) | undefined;
const flush = async () => {
  for (let i = 0; i < 12; i++) {
    await Promise.resolve();
  }
};
beforeEach(() => {
  jest.clearAllMocks();
  AppState.currentState = 'active';
  jest
    .spyOn(AppState, 'addEventListener')
    .mockReturnValue({ remove: jest.fn() });
  useRecordingStore.setState({ files: [], deletedUris: [] });
  (phoneAudio.getPermissions as jest.Mock).mockResolvedValue({
    speech: true,
    onDeviceAvailable: true,
  });
});
afterEach(() => {
  stop?.();
  stop = undefined;
  jest.restoreAllMocks();
});

test('natural titles use the first meaningful sentence and preserve explicit names', () => {
  expect(titleFromTranscript('  明天整理产品思路。然后开会。')).toBe(
    '明天整理产品思路',
  );
  expect(titleFromTranscript('第一行\n第二行')).toBe('第一行');
  expect(titleFromTranscript('！  一个新想法。')).toBe('一个新想法');
  expect(titleFromTranscript('。')).toBe('语音灵感');
  expect(
    titleFromTranscript('这是一个非常非常非常非常非常非常非常非常长的想法'),
  ).toHaveLength(22);
  expect(recordingTitle(file)).not.toContain('.m4a');
  expect(recordingTitle({ ...file, transcript: '新的产品点子。' })).toBe(
    '新的产品点子',
  );
  expect(
    recordingTitle({ ...file, transcript: '新内容', displayTitle: '我的名字' }),
  ).toBe('我的名字');
});
test('automatic recognition processes saved audio serially and persists transcript/title', async () => {
  useRecordingStore.setState({
    files: [file, { ...file, uri: 'file:///voice-recordings/second.m4a' }],
  });
  (transcribe as jest.Mock).mockResolvedValue('周末的旅行计划。去看海。');
  stop = startAutomaticRecognition();
  await flush();
  expect(transcribe).toHaveBeenCalledTimes(2);
  expect(
    useRecordingStore
      .getState()
      .files.every(item => item.recognitionState === 'done'),
  ).toBe(true);
  expect(useRecordingStore.getState().files[0].displayTitle).toBe(
    '周末的旅行计划',
  );
});
test('no permission means no automatic recognition or late permission request', async () => {
  (phoneAudio.getPermissions as jest.Mock).mockResolvedValue({
    speech: false,
    onDeviceAvailable: true,
  });
  useRecordingStore.setState({ files: [file] });
  stop = startAutomaticRecognition();
  await flush();
  expect(transcribe).not.toHaveBeenCalled();
});
test('failure preserves audio and does not loop; a later recording is still processed', async () => {
  (transcribe as jest.Mock)
    .mockRejectedValueOnce(new Error('中文资源尚未就绪'))
    .mockResolvedValue('下一条内容');
  useRecordingStore.setState({ files: [file] });
  stop = startAutomaticRecognition();
  await flush();
  expect(useRecordingStore.getState().files[0]).toMatchObject({
    uri: file.uri,
    recognitionState: 'failed',
    recognitionError: '中文资源尚未就绪',
  });
  useRecordingStore
    .getState()
    .merge([{ ...file, uri: 'file:///voice-recordings/second.m4a' }]);
  await flush();
  expect(transcribe).toHaveBeenCalledTimes(2);
});
test('deletion scope never claims to delete ring originals', () => {
  expect(recordingDeleteMessage(file)).toContain('不会释放戒指空间');
  expect(recordingDeleteMessage({ ...file, source: 'phone' })).not.toContain(
    '戒指',
  );
});

test('blocked recognition explains why AI cannot start and permission refresh resumes without restarting app', async () => {
  (phoneAudio.getPermissions as jest.Mock).mockResolvedValue({
    speech: false,
    onDeviceAvailable: true,
  });
  useRecordingStore.setState({ files: [file] });
  stop = startAutomaticRecognition();
  await flush();
  expect(useRecognitionRuntime.getState().issue).toContain('未授权');
  expect(transcribe).not.toHaveBeenCalled();
  (phoneAudio.getPermissions as jest.Mock).mockResolvedValue({
    speech: true,
    onDeviceAvailable: true,
  });
  (transcribe as jest.Mock).mockResolvedValue('新的想法');
  refreshAutomaticRecognition();
  await flush();
  expect(useRecordingStore.getState().files[0].transcript).toBe('新的想法');
  expect(useRecognitionRuntime.getState().issue).toBe('');
});

test('late store hydration recovers interrupted recognition rather than leaving it working forever', async () => {
  let onHydrated!: () => void;
  jest
    .spyOn(useRecordingStore.persist, 'onFinishHydration')
    .mockImplementation(callback => {
      onHydrated = () => callback(useRecordingStore.getState());
      return jest.fn();
    });
  (transcribe as jest.Mock).mockResolvedValue('恢复后的转写');
  stop = startAutomaticRecognition();
  await flush();
  useRecordingStore.setState({
    files: [{ ...file, recognitionState: 'working' }],
  });
  onHydrated();
  await flush();
  expect(transcribe).toHaveBeenCalledTimes(1);
  expect(useRecordingStore.getState().files[0]).toMatchObject({
    recognitionState: 'done',
    transcript: '恢复后的转写',
  });
});

test('explicit local retry processes failed audio once and preserves completed transcripts', async () => {
  useRecordingStore.setState({
    files: [
      { ...file, recognitionState: 'failed', recognitionError: '资源未就绪' },
      {
        ...file,
        uri: 'file:///voice-recordings/done.m4a',
        transcript: '原文',
        recognitionState: 'done',
      },
    ],
  });
  (transcribe as jest.Mock).mockResolvedValue('重试转写');
  stop = startAutomaticRecognition();
  await flush();
  expect(transcribe).not.toHaveBeenCalled();
  retryLocalRecognition();
  await flush();
  expect(transcribe).toHaveBeenCalledTimes(1);
  expect(useRecordingStore.getState().files[0].transcript).toBe('重试转写');
  expect(useRecordingStore.getState().files[1].transcript).toBe('原文');
});
