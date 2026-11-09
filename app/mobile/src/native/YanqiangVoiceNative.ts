import { NativeEventEmitter, NativeModules, Platform } from 'react-native'

type NativeFile = {
  name: string
  uri: string
  timestamp: number
  size: number
  rawFileTime?: number
}

type RecordingSummary = {
  supported: boolean
  code?: number
  message?: string
  function?: number
  fileCount: number
  totalBytes: number
  files: NativeFile[]
}

type VoiceRecordParamResult = {
  code: number
  message?: string
  data?: {
    volume: number
    bitrate: number
    lightBrightness: number
  }
}

type VibrationResult = {
  ok: boolean
  type: number
  times?: number
  mode?: string
  switchSkipped?: boolean
  sentOk?: number
}

type OneMinuteAlarmResult = {
  ok: boolean
  alarmID: number
  hour: number
  minute: number
  fireAt: number
}

type YanqiangVoiceNativeModule = {
  initSdk(): Promise<boolean>
  startScan(): Promise<boolean>
  stopScan(): void
  connect(macAddress: string): Promise<boolean>
  disconnect(): Promise<boolean>
  setTouchEventReporting(enabled: boolean): Promise<{ enabled: boolean; result: number }>
  voiceAgentDebugConfig(): Promise<{ enabled: boolean; siliconFlowApiKey: string; amapWebApiKey: string }>
  openAMapTaxiURI(uri: string): Promise<void>
  queryVoiceRecordingSummary(): Promise<RecordingSummary>
  syncVoiceRecordings(): Promise<{ files: NativeFile[] }>
  getVoiceRecordParam(): Promise<VoiceRecordParamResult>
  setVoiceRecordParam(
    bitrate: number,
    volume: number,
    lightBrightness: number,
  ): Promise<VoiceRecordParamResult>
  sendVibrationWithType(type: number, times?: number): Promise<VibrationResult>
  setOneMinuteAlarm(): Promise<OneMinuteAlarmResult>
}

const native = NativeModules.YanqiangVoiceModule as YanqiangVoiceNativeModule | undefined

export const YanqiangVoiceNative = {
  isAvailable: (Platform.OS === 'android' || Platform.OS === 'ios') && !!native,
  initSdk: () => requireNative().initSdk(),
  startScan: () => requireNative().startScan(),
  stopScan: () => requireNative().stopScan(),
  connect: (macAddress: string) => requireNative().connect(macAddress),
  disconnect: () => requireNative().disconnect(),
  setTouchEventReporting: (enabled: boolean) => requireNative().setTouchEventReporting(enabled),
  voiceAgentDebugConfig: () => requireNative().voiceAgentDebugConfig(),
  openAMapTaxiURI: (uri: string) => requireNative().openAMapTaxiURI(uri),
  queryVoiceRecordingSummary: () => requireNative().queryVoiceRecordingSummary(),
  syncVoiceRecordings: () => requireNative().syncVoiceRecordings(),
  getVoiceRecordParam: () => requireNative().getVoiceRecordParam(),
  setVoiceRecordParam: (bitrate: number, volume: number, lightBrightness: number) =>
    requireNative().setVoiceRecordParam(bitrate, volume, lightBrightness),
  /** Immediate ring vibration. type: 1 System … 3 Alarm … 6 Care. times: buzz count (default 1). */
  sendVibrationWithType: (type: number, times: number = 1) =>
    requireNative().sendVibrationWithType(type, times),
  /** Debug helper: overwrite alarm slot 1 to fire in ~1 minute (wall clock). */
  setOneMinuteAlarm: () => requireNative().setOneMinuteAlarm(),
}

export const YanqiangVoiceEvents = native ? new NativeEventEmitter(native as any) : undefined

export const YanqiangVoiceEventNames = {
  scan: 'yanqiangVoiceScanEvent',
  connection: 'yanqiangVoiceConnectionChanged',
  status: 'yanqiangVoiceStatusUpdate',
  syncState: 'yanqiangVoiceSyncState',
  syncProgress: 'yanqiangVoiceSyncProgress',
  fileReady: 'yanqiangVoiceFileReady',
  error: 'yanqiangVoiceError',
  touch: 'yanqiangSmartTouchEvent',
} as const

function requireNative(): YanqiangVoiceNativeModule {
  if (!native) {
    throw new Error(`YanqiangVoiceModule is unavailable on ${Platform.OS} after native installation`)
  }
  return native
}

export type { NativeFile, RecordingSummary, VoiceRecordParamResult, VibrationResult, OneMinuteAlarmResult }
