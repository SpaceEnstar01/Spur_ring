import { JAVA_AGENT_ENABLED } from '../config/backend';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import type { RingRecording } from '../ring/types';
import { recordingKey } from '../ring/recordingIdentity';

export type Binding = {
  key: string;
  clientId: string;
  revision: number;
  transcript: string;
};
type Settings = {
  base: string;
  enabledAt: number | null;
  excluded: string[];
  bindings: Binding[];
  explicitActions: string[];
};
export const AGENT_SETTINGS_KEY = 'spur-cloud-agent-v1';
export const useAgentSettings = create<Settings & { loaded: boolean }>(() => ({
  base: '',
  enabledAt: null,
  excluded: [],
  bindings: [],
  explicitActions: [],
  loaded: false,
}));
let loading: Promise<void> | undefined;
export function loadAgentSettings() {
  if (useAgentSettings.getState().loaded) return Promise.resolve();
  if (!loading)
    loading = (async () => {
      const raw = await AsyncStorage.getItem(AGENT_SETTINGS_KEY);
      if (raw) {
        const s = JSON.parse(raw) as Settings;
        if (
          typeof s.base !== 'string' ||
          !(s.enabledAt === null || Number.isFinite(s.enabledAt)) ||
          !Array.isArray(s.bindings) ||
          !Array.isArray(s.excluded) ||
          !Array.isArray(s.explicitActions) ||
          s.bindings.some(
            b =>
              !b ||
              typeof b.key !== 'string' ||
              !/^[0-9a-f-]{36}$/i.test(b.clientId) ||
              !Number.isInteger(b.revision) ||
              typeof b.transcript !== 'string',
          )
        )
          throw new Error('Agent 本机状态异常，已停止自动处理，不会覆盖原记录');
        useAgentSettings.setState(s);
      }
      useAgentSettings.setState({ loaded: true });
    })().finally(() => {
      loading = undefined;
    });
  return loading;
}
export async function saveAgentSettings(change: Partial<Settings>) {
  const { base, enabledAt, excluded, bindings, explicitActions } =
    useAgentSettings.getState();
  const next = {
    base,
    enabledAt,
    excluded,
    bindings,
    explicitActions,
    ...change,
  };
  await AsyncStorage.setItem(AGENT_SETTINGS_KEY, JSON.stringify(next));
  useAgentSettings.setState(next);
}
// A cloud-owned source never silently falls back to local alarm automation, even when paused.
export function cloudOwnsRecording(file: RingRecording) {
  if (!JAVA_AGENT_ENABLED) return false;
  const s = useAgentSettings.getState();
  const key = recordingKey(file.uri);
  if (s.bindings.some(b => b.key === key)) return true;
  // While cloud agent is enabled, the legacy executor must not compete for any source.
  if (s.enabledAt !== null) return true;
  const at = file.source === 'phone' ? file.timestamp : file.commandRecordedAt;
  return (
    s.enabledAt !== null &&
    !s.excluded.includes(key) &&
    at !== undefined &&
    at >= s.enabledAt
  );
}
export function eligibleForAutomaticUpload(file: RingRecording) {
  const s = useAgentSettings.getState();
  const at = file.source === 'phone' ? file.timestamp : file.commandRecordedAt;
  return (
    s.enabledAt !== null &&
    at !== undefined &&
    at >= s.enabledAt &&
    !s.excluded.includes(recordingKey(file.uri))
  );
}
