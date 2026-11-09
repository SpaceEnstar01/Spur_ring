import { generateRecordingReply } from '../src/services/automaticReplies';
jest.mock('../src/services/automaticReplies', () => ({
  generateRecordingReply: jest.fn().mockResolvedValue(undefined),
  cancelRecordingReply: jest.fn(),
}));
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Alert } from 'react-native';
import { NoteScreen } from '../src/screens/NoteScreen';
import { PrimaryButton } from '../src/components/PrimaryButton';
import { deleteRecording } from '../src/services/deleteRecording';
import { phoneAudio } from '../src/services/phoneAudio';
import { transcribe } from '../src/services/transcriptionApi';
import { useNotesStore } from '../src/notes/useNotesStore';
import { useRecordingStore } from '../src/ring/store/useRecordingStore';
import { useRingStore } from '../src/ring/store/useRingStore';

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: 'SafeAreaView',
}));
jest.mock('../src/services/transcriptionApi', () => ({
  transcribe: jest.fn(),
}));
jest.mock('../src/services/phoneAudio', () => ({
  phoneAudio: {
    deleteRecording: jest.fn(),
    stopPlayback: jest.fn(),
  },
}));
jest.mock('../src/ring/native', () => ({
  vendorModule: () => ({ stopRecordingPlayback: jest.fn() }),
}));
const file = {
  uri: 'file:///voice-recordings/ring.m4a',
  name: 'ring.m4a',
  timestamp: 1,
  size: 1024,
};
const note = {
  id: 'linked',
  title: '已保存录音',
  text: '原始文字',
  recordingUri: file.uri,
  createdAt: 1,
};
const navigation = { navigate: jest.fn(), goBack: jest.fn() };
let renderer: TestRenderer.ReactTestRenderer | undefined;
beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  useRingStore.setState({ status: 'idle' });
  useRecordingStore.setState({ files: [file], deletedUris: [] });
  useNotesStore.setState({ notes: [] });
  (phoneAudio.deleteRecording as jest.Mock).mockResolvedValue(undefined);
});
afterEach(async () => {
  await act(() => renderer?.unmount());
  renderer = undefined;
  jest.restoreAllMocks();
});
async function mount() {
  await act(() => {
    renderer = TestRenderer.create(
      <NoteScreen
        navigation={navigation as never}
        route={{
          key: 'note',
          name: 'Note',
          params: { recordingUri: file.uri },
        }}
      />,
    );
  });
}
function reply() {
  return renderer!.root
    .findAllByType(PrimaryButton)
    .find(button => button.props.title === '✦ 重新分析录音')!;
}
function confirm() {
  return (Alert.alert as jest.Mock).mock.calls
    .at(-1)[2]
    .find(
      (item: { text: string }) =>
        item.text === '确认并回复' || item.text === '删除',
    );
}
test('deleting removes only this local recording and linked notes, suppressing resync', async () => {
  useNotesStore.setState({
    notes: [note, { ...note, id: 'other', recordingUri: 'file:///other.m4a' }],
  });
  await deleteRecording(file);
  expect(phoneAudio.deleteRecording).toHaveBeenCalledWith(file.uri);
  expect(useRecordingStore.getState().files).toEqual([]);
  expect(useNotesStore.getState().notes.map(item => item.id)).toEqual([
    'other',
  ]);
  useRecordingStore.getState().merge([file]);
  expect(useRecordingStore.getState().files).toEqual([]);
});
test('native deletion failure preserves recording, text and resync eligibility', async () => {
  useNotesStore.setState({ notes: [note] });
  (phoneAudio.deleteRecording as jest.Mock).mockRejectedValue(
    new Error('删除失败'),
  );
  await expect(deleteRecording(file)).rejects.toThrow('删除失败');
  expect(useRecordingStore.getState().files).toEqual([file]);
  expect(useRecordingStore.getState().deletedUris).toEqual([]);
  expect(useNotesStore.getState().notes).toEqual([note]);
});

test('deleting a ring recording also removes notes and suppresses sync under newer sandbox aliases', async () => {
  const movedUri =
    'file:///var/mobile/Containers/Data/Application/NEW/Documents/voice-recordings/ring.m4a';
  useNotesStore.setState({ notes: [{ ...note, recordingUri: movedUri }] });
  await deleteRecording(file);
  expect(useNotesStore.getState().notes).toEqual([]);
  useRecordingStore.getState().merge([{ ...file, uri: movedUri }]);
  expect(useRecordingStore.getState().files).toEqual([]);
});
test('recordings cannot be deleted during active sync', async () => {
  useRingStore.setState({ status: 'syncing' });
  await expect(deleteRecording(file)).rejects.toThrow('同步结束');
  expect(phoneAudio.deleteRecording).not.toHaveBeenCalled();
});
test('detail has no deletion controls; deletion remains on the home cards', async () => {
  await mount();
  expect(
    renderer!.root.findAll(node =>
      node.props.accessibilityLabel?.includes('删除'),
    ),
  ).toHaveLength(0);
  expect(JSON.stringify(renderer!.toJSON())).not.toContain(
    '删除录音及关联笔记',
  );
  expect(JSON.stringify(renderer!.toJSON())).not.toContain(
    '戒指原件删除待厂商',
  );
  expect(phoneAudio.deleteRecording).not.toHaveBeenCalled();
});

test('compact header save still saves transcript and returns without deleting', async () => {
  useRecordingStore.setState({
    files: [{ ...file, transcript: '新的录音文字。' }],
  });
  await mount();
  const save = renderer!.root.findAll(
    node => node.props.accessibilityLabel === '保存笔记',
  )[0];
  await act(() => save.props.onPress());
  expect(useNotesStore.getState().notes[0]).toMatchObject({
    text: '新的录音文字。',
    recordingUri: file.uri,
  });
  expect(navigation.goBack).toHaveBeenCalledTimes(1);
  expect(phoneAudio.deleteRecording).not.toHaveBeenCalled();
});
test('voice reply confirms text sharing then saves local transcript and requests automatic AI reply', async () => {
  (transcribe as jest.Mock).mockResolvedValue('明天去上海需要带什么？');
  await mount();
  await act(() => reply().props.onPress());
  expect(transcribe).not.toHaveBeenCalled();
  await act(async () => {
    await confirm().onPress();
  });
  expect(useRecordingStore.getState().files[0].transcript).toBe(
    '明天去上海需要带什么？',
  );
  expect(useNotesStore.getState().notes[0].text).toBe('明天去上海需要带什么？');
  expect(generateRecordingReply).toHaveBeenCalledWith(file.uri);
  expect(navigation.navigate).not.toHaveBeenCalled();
});
test('existing recording text goes straight to AI without re-uploading audio', async () => {
  useNotesStore.setState({ notes: [note] });
  await mount();
  await act(() => reply().props.onPress());
  expect(transcribe).not.toHaveBeenCalled();
  expect(generateRecordingReply).toHaveBeenCalledWith(file.uri);
  expect(navigation.navigate).not.toHaveBeenCalled();
});
test('failed transcription retains audio and does not start an AI conversation', async () => {
  (transcribe as jest.Mock).mockRejectedValue(new Error('网络不可用'));
  await mount();
  await act(() => reply().props.onPress());
  await act(async () => {
    await confirm().onPress();
  });
  expect(navigation.navigate).not.toHaveBeenCalled();
  expect(useRecordingStore.getState().files).toEqual([
    expect.objectContaining(file),
  ]);
  expect(Alert.alert).toHaveBeenCalledWith('转写失败', '网络不可用');
});
test('speech engine failures offer retry while permission failures offer settings', async () => {
  useRecordingStore.setState({
    files: [
      {
        ...file,
        recognitionState: 'failed',
        recognitionErrorCode: 'SPEECH_SERVICE',
        recognitionError: '系统听写未完成',
      },
    ],
  });
  await mount();
  expect(JSON.stringify(renderer!.toJSON())).toContain('重试本机识别');
  expect(JSON.stringify(renderer!.toJSON())).not.toContain(
    '检查系统权限与中文资源',
  );
  await act(() =>
    useRecordingStore.getState().setRecognition(file.uri, {
      recognitionErrorCode: 'SPEECH_PERMISSION',
    }),
  );
  expect(JSON.stringify(renderer!.toJSON())).toContain(
    '检查系统权限与中文资源',
  );
});
