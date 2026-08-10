import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';

import { compareDemoFirst } from '@/services/demoContent';

export type LocalAudioFile = {
  id: string;
  name: string;
  uri: string;
  size: number;
  modifiedAt: number;
  durationMs: number;
  category: 'recording' | 'agent';
};

const RECORDING_DIR = `${FileSystem.documentDirectory}voice-recordings/`;
const AGENT_THRESHOLD_MS = 15_000;

/** Playback must ignore the iOS silent switch — opening a recording is intentional. */
export async function preparePlayback(): Promise<void> {
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: false,
    playsInSilentModeIOS: true,
    staysActiveInBackground: false,
    shouldDuckAndroid: true,
    playThroughEarpieceAndroid: false
  });
}

export async function listLocalAudioFiles(): Promise<LocalAudioFile[]> {
  const dir = await FileSystem.getInfoAsync(RECORDING_DIR);
  if (!dir.exists) return [];

  const names = (await FileSystem.readDirectoryAsync(RECORDING_DIR)).filter((name) => {
    const lower = name.toLowerCase();
    return lower.endsWith('.ogg') || lower.endsWith('.m4a');
  });
  const files = await Promise.all(names.map(loadFile));
  return files.sort((a, b) => compareDemoFirst(a.name, b.name, b.modifiedAt - a.modifiedAt));
}

export async function deleteLocalAudioFile(uri: string) {
  await FileSystem.deleteAsync(uri, { idempotent: true });
}

export async function clearLocalAudioFiles() {
  await FileSystem.deleteAsync(RECORDING_DIR, { idempotent: true });
  await FileSystem.makeDirectoryAsync(RECORDING_DIR, { intermediates: true });
}

async function loadFile(name: string): Promise<LocalAudioFile> {
  // Keep a raw file:// path for AVPlayback — encoding the filename breaks expo-av on iOS.
  const uri = `${RECORDING_DIR}${name}`;
  const info = await FileSystem.getInfoAsync(uri, { size: true });
  const durationMs = await readDuration(uri);
  return {
    id: uri,
    name,
    uri,
    size: info.exists && 'size' in info ? Number(info.size || 0) : 0,
    modifiedAt: info.exists && 'modificationTime' in info ? Number(info.modificationTime || 0) * 1000 : 0,
    durationMs,
    // If duration cannot be decoded, retain the file in the recording library instead of
    // accidentally sending it to the agent flow.
    category: durationMs > 0 && durationMs < AGENT_THRESHOLD_MS ? 'agent' : 'recording'
  };
}

async function readDuration(uri: string) {
  let sound: Audio.Sound | null = null;
  try {
    const created = await Audio.Sound.createAsync({ uri }, { shouldPlay: false });
    sound = created.sound;
    return created.status.isLoaded ? Number(created.status.durationMillis || 0) : 0;
  } catch {
    return 0;
  } finally {
    if (sound) await sound.unloadAsync().catch(() => undefined);
  }
}
