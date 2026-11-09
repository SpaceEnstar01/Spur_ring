import { NativeModules, PermissionsAndroid, Platform } from 'react-native';
import type { RingRecording } from '../ring/types';
type PhoneAudio = {
  start(): Promise<void>;
  stop(): Promise<RingRecording>;
  cancel(): Promise<void>;
  play(uri: string): Promise<void>;
  stopPlayback(): void;
  deleteRecording(uri: string): Promise<void>;
  requestPermissions?(): Promise<{
    microphone: boolean;
    speech: boolean;
    onDeviceAvailable: boolean;
    bluetooth?: string;
  }>;
  getPermissions?(): Promise<{
    microphone: boolean;
    speech: boolean;
    onDeviceAvailable: boolean;
    bluetooth?: string;
  }>;
  requestBluetoothPermissions?(): Promise<{
    microphone: boolean;
    speech: boolean;
    onDeviceAvailable: boolean;
    bluetooth?: string;
  }>;
  transcribeRecording?(uri: string, requestId: string): Promise<string>;
  cancelTranscription?(requestId: string): void;
};
export const phoneAudio = NativeModules.PhoneAudio as PhoneAudio;
export async function startPhoneRecording() {
  if (!phoneAudio) {
    throw new Error('请安装包含录音模块的新版本 APP');
  }
  if (Platform.OS === 'android') {
    const permission = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
    );
    if (permission !== PermissionsAndroid.RESULTS.GRANTED) {
      throw new Error('请在系统设置中允许麦克风权限');
    }
  }
  await phoneAudio.start();
}
