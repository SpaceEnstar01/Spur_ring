import { Alert } from 'react-native';
import type { RingRecording } from '../ring/types';
import { useNotesStore } from '../notes/useNotesStore';
import { deleteRecording } from './deleteRecording';

export function recordingDeleteMessage(file: RingRecording) {
  return `将永久删除 APP 中的音频、转写和关联笔记，无法撤销。${
    file.source === 'phone'
      ? ''
      : '当前厂商 SDK 未提供单条删除戒指原件的接口，此操作不会释放戒指空间。已删除的 APP 记录不会因再次同步而出现在列表。'
  }`;
}

export function confirmDeleteEntry(entry: {
  file?: RingRecording;
  noteId?: string;
  title: string;
}) {
  Alert.alert(
    '删除这条内容？',
    `“${entry.title}”\n${
      entry.file
        ? recordingDeleteMessage(entry.file)
        : '将永久删除此笔记，此操作无法撤销。'
    }`,
    [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          try {
            if (entry.file) {
              await deleteRecording(entry.file);
            } else if (entry.noteId) {
              useNotesStore.getState().remove(entry.noteId);
            }
          } catch (error) {
            Alert.alert('删除失败', (error as Error).message);
          }
        },
      },
    ],
  );
}
