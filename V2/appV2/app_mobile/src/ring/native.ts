import { NativeEventEmitter, NativeModules } from 'react-native';
import type { RingRecording } from './types';
type VendorModule = {
  initSdk(): Promise<boolean>;
  startScan(): Promise<boolean>;
  stopScan(): void;
  connect(address: string): Promise<boolean>;
  disconnect(): Promise<boolean>;
  queryVoiceRecordingSummary(): Promise<{
    files: RingRecording[];
    fileCount: number;
  }>;
  syncVoiceRecordings(): Promise<{ files: RingRecording[] }>;
  playRecording(uri: string): Promise<boolean>;
  stopRecordingPlayback(): void;
};
export function vendorModule(): VendorModule {
  const native = NativeModules.YanqiangVoiceModule as VendorModule | undefined;
  if (!native) {
    throw new Error('戒指组件尚未加载，请安装最新的原生构建版本。');
  }
  return native;
}
export function vendorEvents() {
  vendorModule();
  return new NativeEventEmitter(NativeModules.YanqiangVoiceModule);
}
