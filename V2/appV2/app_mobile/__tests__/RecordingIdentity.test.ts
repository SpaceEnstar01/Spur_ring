import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  recordingKey,
  sameRecording,
  mergeRecordingFiles,
} from '../src/ring/recordingIdentity';
import { useRecordingStore } from '../src/ring/store/useRecordingStore';
import { useNotesStore } from '../src/notes/useNotesStore';
import { repairDeletedRecordingNotes } from '../src/services/recordingLibraryRepair';
const path = (container: string, name = 'ring.m4a') =>
  `file:///var/mobile/Containers/Data/Application/${container}/Documents/voice-recordings/${name}`;
const old = { uri: path('OLD'), name: 'ring.m4a', size: 100, timestamp: 1 };
const fresh = { ...old, uri: path('NEW') };
beforeEach(async () => {
  await AsyncStorage.clear();
  useRecordingStore.setState({ files: [], deletedUris: [] });
  useNotesStore.setState({ notes: [] });
});
test('identity survives container and URL escaping changes but never merges different filenames', () => {
  expect(sameRecording(old.uri, fresh.uri)).toBe(true);
  expect(
    sameRecording(
      path('OLD', '笔记.m4a'),
      path('NEW', '%E7%AC%94%E8%AE%B0.m4a'),
    ),
  ).toBe(true);
  expect(sameRecording(old.uri, path('NEW', 'different.m4a'))).toBe(false);
  expect(
    recordingKey('https://example.com/voice-recordings/ring.m4a'),
  ).not.toBe(recordingKey(old.uri));
  expect(sameRecording(undefined, undefined)).toBe(false);
});
test('syncing an updated installation preserves one recording, recognition and AI', () => {
  useRecordingStore.getState().merge([old]);
  useRecordingStore.getState().setTranscript(old.uri, '原始录音文字');
  useRecordingStore
    .getState()
    .setReply(old.uri, { aiReply: '已完成回复', aiReplyState: 'done' });
  useRecordingStore.getState().merge([fresh, fresh]);
  expect(useRecordingStore.getState().files).toHaveLength(1);
  expect(useRecordingStore.getState().files[0]).toMatchObject({
    transcript: '原始录音文字',
    aiReply: '已完成回复',
    aiReplyState: 'done',
  });
});
test('old persisted duplicates are consolidated before automatic workers start', async () => {
  await AsyncStorage.setItem(
    'supr-recordings-v1',
    JSON.stringify({
      version: 0,
      state: {
        files: [
          fresh,
          { ...old, transcript: '文字', aiReply: '回复', aiReplyState: 'done' },
        ],
        deletedUris: [],
      },
    }),
  );
  await useRecordingStore.persist.rehydrate();
  expect(useRecordingStore.getState().files).toHaveLength(1);
  expect(useRecordingStore.getState().files[0]).toMatchObject({
    transcript: '文字',
    aiReply: '回复',
  });
  const saved = JSON.parse((await AsyncStorage.getItem('supr-recordings-v1'))!);
  expect(saved.version).toBe(1);
  expect(saved.state.files).toHaveLength(1);
});
test('old deletion tombstones suppress all path aliases including persisted duplicates', () => {
  expect(mergeRecordingFiles([old, fresh], [fresh], [old.uri])).toEqual([]);
  useRecordingStore.getState().merge([old]);
  useRecordingStore.getState().remove(fresh.uri);
  useRecordingStore.getState().merge([old, fresh]);
  expect(useRecordingStore.getState().files).toEqual([]);
});
test('linked notes update and delete across relocated paths', () => {
  const note = {
    id: 'old',
    recordingUri: old.uri,
    text: '旧文字',
    title: '会议',
    createdAt: 1,
  };
  useNotesStore.getState().save(note);
  useNotesStore
    .getState()
    .save({ ...note, id: 'new', recordingUri: fresh.uri, text: '新文字' });
  expect(useNotesStore.getState().notes).toHaveLength(1);
  useNotesStore.getState().removeByRecording(old.uri);
  expect(useNotesStore.getState().notes).toEqual([]);
});

test('previously deleted recording notes are removed by identity, ordinary and unrelated notes survive', () => {
  useRecordingStore.setState({ deletedUris: [old.uri] });
  const base = {
    id: 'deleted-note',
    text: '文字',
    title: '笔记',
    createdAt: 1,
  };
  useNotesStore.setState({
    notes: [
      { ...base, recordingUri: fresh.uri },
      { ...base, id: 'ordinary' },
      { ...base, id: 'other', recordingUri: path('NEW', 'other.m4a') },
    ],
  });
  repairDeletedRecordingNotes();
  expect(useNotesStore.getState().notes.map(note => note.id)).toEqual([
    'ordinary',
    'other',
  ]);
});
test('different completed replies and transcripts are retained locally when merging duplicates', () => {
  const files = mergeRecordingFiles(
    [
      {
        ...old,
        transcript: '文字',
        aiReply: '第一份回复',
        aiReplyState: 'done',
      },
    ],
    [
      {
        ...fresh,
        transcript: '文字',
        aiReply: '第二份回复',
        aiReplyState: 'done',
      },
    ],
    [],
  );
  expect(files[0].aiReply).toBe('第一份回复');
  expect(files[0].previousAiReplies).toEqual(['第二份回复']);
});
