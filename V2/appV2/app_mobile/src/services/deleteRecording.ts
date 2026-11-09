import { useNotesStore } from '../notes/useNotesStore';
import { vendorModule } from '../ring/native';
import { useRecordingStore } from '../ring/store/useRecordingStore';
import { useRingStore } from '../ring/store/useRingStore';
import type { RingRecording } from '../ring/types';
import { phoneAudio } from './phoneAudio';
import { cancelRecordingReply } from './automaticReplies';

export async function deleteRecording(file: RingRecording) {
  if (useRingStore.getState().status === 'syncing') {
    throw new Error('请等待戒指录音同步结束后再删除');
  }
  if (!phoneAudio?.deleteRecording) {
    throw new Error('请安装包含录音删除功能的新版本 APP');
  }
  if (file.source === 'phone') {
    phoneAudio.stopPlayback();
  } else {
    vendorModule().stopRecordingPlayback();
  }
  // Only remove metadata after native deletion succeeds; no remote ring erase command.
  await phoneAudio.deleteRecording(file.uri);
  cancelRecordingReply(file.uri);
  useRecordingStore.getState().remove(file.uri);
  useNotesStore.getState().removeByRecording(file.uri);
}
