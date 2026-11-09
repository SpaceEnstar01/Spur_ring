import { useRecordingStore } from '../src/ring/store/useRecordingStore';
import { useNotesStore } from '../src/notes/useNotesStore';
import { transcribe } from '../src/services/transcriptionApi';
import { phoneAudio } from '../src/services/phoneAudio';
jest.mock('../src/services/phoneAudio', () => ({
  phoneAudio: {
    transcribeRecording: jest.fn(),
    cancelTranscription: jest.fn(),
  },
}));

const file = {
  name: 'phone.m4a',
  uri: 'file:///private/voice-recordings/phone.m4a',
  size: 1024,
  timestamp: 1,
  source: 'phone' as const,
};
beforeEach(() => {
  jest.clearAllMocks();
  useRecordingStore.setState({ files: [] });
  useNotesStore.setState({ notes: [] });
});
test('a quick speech-service interruption retries once locally and then stops', async () => {
  jest.useFakeTimers();
  try {
    const unavailable = Object.assign(new Error('系统听写暂不可用'), {
      code: 'SPEECH_SERVICE',
    });
    (phoneAudio.transcribeRecording as jest.Mock)
      .mockRejectedValueOnce(unavailable)
      .mockResolvedValueOnce('恢复后的文字');
    const task = transcribe(file, new AbortController().signal);
    for (let i = 0; i < 15; i++) await Promise.resolve();
    jest.advanceTimersByTime(600);
    await expect(task).resolves.toBe('恢复后的文字');
    expect(phoneAudio.transcribeRecording).toHaveBeenCalledTimes(2);
    expect(
      (phoneAudio.transcribeRecording as jest.Mock).mock.calls[0][1],
    ).not.toBe((phoneAudio.transcribeRecording as jest.Mock).mock.calls[1][1]);
  } finally {
    jest.useRealTimers();
  }
});
test('permission, decode and no-speech failures do not trigger repeated recognition', async () => {
  for (const code of ['SPEECH_PERMISSION', 'SPEECH_AUDIO', 'SPEECH_EMPTY']) {
    (phoneAudio.transcribeRecording as jest.Mock)
      .mockReset()
      .mockRejectedValue(Object.assign(new Error(code), { code }));
    await expect(
      transcribe(file, new AbortController().signal),
    ).rejects.toThrow(code);
    expect(phoneAudio.transcribeRecording).toHaveBeenCalledTimes(1);
  }
});
test('cancelling the recovery delay never starts another native task', async () => {
  jest.useFakeTimers();
  try {
    (phoneAudio.transcribeRecording as jest.Mock).mockRejectedValue(
      Object.assign(new Error('系统听写暂不可用'), { code: 'SPEECH_SERVICE' }),
    );
    const controller = new AbortController();
    const task = transcribe(file, controller.signal);
    const rejection = task.then(
      () => {
        throw new Error('Cancelled recognition must reject');
      },
      error => {
        expect(error).toMatchObject({ name: 'AbortError' });
      },
    );
    for (let i = 0; i < 15; i++) await Promise.resolve();
    controller.abort();
    jest.advanceTimersByTime(1000);
    await rejection;
    expect(phoneAudio.transcribeRecording).toHaveBeenCalledTimes(1);
  } finally {
    jest.useRealTimers();
  }
});
test('sync deduplicates files and preserves existing transcript', () => {
  useRecordingStore.getState().merge([file]);
  useRecordingStore.getState().setTranscript(file.uri, '会议记录');
  useRecordingStore.getState().merge([file]);
  expect(useRecordingStore.getState().files).toHaveLength(1);
  expect(useRecordingStore.getState().files[0].transcript).toBe('会议记录');
});
test('saving the same recording note replaces instead of duplicates', () => {
  const note = {
    id: `recording:${file.uri}`,
    recordingUri: file.uri,
    title: '录音笔记',
    text: '第一次识别',
    createdAt: 1,
  };
  useNotesStore.getState().save(note);
  useNotesStore.getState().save({ ...note, text: '修正后的文字' });
  expect(useNotesStore.getState().notes).toHaveLength(1);
  expect(useNotesStore.getState().notes[0].text).toBe('修正后的文字');
});
test('transcription uses only the phone speech module and never uploads audio', async () => {
  const fetchMock = jest.spyOn(globalThis, 'fetch');
  try {
    (phoneAudio.transcribeRecording as jest.Mock).mockResolvedValue(
      ' 本机返回的文字 ',
    );
    const controller = new AbortController();
    expect(await transcribe(file, controller.signal)).toBe('本机返回的文字');
    expect(phoneAudio.transcribeRecording).toHaveBeenCalledWith(
      file.uri,
      expect.any(String),
    );
    (phoneAudio.transcribeRecording as jest.Mock).mockRejectedValue(
      new Error('本机识别不可用'),
    );
    await expect(transcribe(file, controller.signal)).rejects.toThrow(
      '本机识别不可用',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  } finally {
    fetchMock.mockRestore();
  }
});
test('cancellation aborts the matching native request and ignores a late result', async () => {
  let finish!: (text: string) => void;
  (phoneAudio.transcribeRecording as jest.Mock).mockImplementation(
    () =>
      new Promise<string>(resolve => {
        finish = resolve;
      }),
  );
  const controller = new AbortController();
  const task = transcribe(file, controller.signal);
  const assertion = task.then(
    () => {
      throw new Error('Cancelled transcription must reject');
    },
    error => {
      expect(error).toMatchObject({ name: 'AbortError' });
    },
  );
  await new Promise<void>(resolve => setImmediate(resolve));
  controller.abort();
  expect(phoneAudio.cancelTranscription).toHaveBeenCalledWith(
    expect.stringContaining('speech-'),
  );
  finish('不应返回的迟到文字');
  await assertion;
});
