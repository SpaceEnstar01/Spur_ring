export type RingConnectionStatus =
  | 'idle'
  | 'disconnected'
  | 'scanning'
  | 'connecting'
  | 'authenticating'
  | 'connected'
  | 'recording'
  | 'syncing'
  | 'failed';

export type RingDevice = {
  id: string;
  name: string;
  rssi?: number;
  batteryLevel?: number;
};

export type RingRecording = {
  /** Trusted start observed live by this app; file modification time is not recording time. */
  commandRecordedAt?: number;
  previousAiReplies?: string[];
  previousTranscripts?: string[];
  aiReply?: string;
  aiReplyState?: 'working' | 'done' | 'failed';
  aiReplyError?: string;
  aiReplyCompletedAt?: number;
  personalAgentRunId?: string;
  personalAgentState?: 'running' | 'done' | 'failed';
  personalAgentProgress?: string;
  personalAgentReply?: string;
  personalAgentSources?: { title: string; url: string }[];
  personalAgentArtifacts?: { title: string; url: string }[];
  personalAgentError?: string;
  displayTitle?: string;
  recognitionState?: 'working' | 'failed' | 'done';
  recognitionError?: string;
  recognitionErrorCode?: string;
  source?: 'phone' | 'ring';
  transcript?: string;
  name: string;
  uri: string;
  timestamp: number;
  size: number;
};

export interface RingTransport {
  scan(onDeviceFound: (device: RingDevice) => void): Promise<void>;
  stopScan(): void;
  connect(deviceId: string): Promise<void>;
  disconnect(): Promise<void>;
}
