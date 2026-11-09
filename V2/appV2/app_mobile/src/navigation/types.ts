import type { RingDevice } from '../ring/types';

export type RootStackParamList = {
  Home: undefined;
  ConnectApps: undefined;
  AgentMailbox: { messageId?: string } | undefined;
  PairingGuide: undefined;
  RingSearch: undefined;
  PairingResult: { device: RingDevice };
  Device: undefined;
  Chat:
    | {
        initialText?: string;
        autoSend?: boolean;
        requestId?: string;
        recordingUri?: string;
      }
    | undefined;
  Note: { id?: string; recordingUri?: string } | undefined;
  Settings: undefined;
  Recorder: undefined;
};
