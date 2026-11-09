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

type DurationCacheEntry = {
  size: number;
  modifiedAt: number;
  durationMs: number;
  category: 'recording' | 'agent';
  /** Once true, list refreshes never re-probe AV duration unless file identity changes. */
  sealed: boolean;
};

const RECORDING_DIR = `${FileSystem.documentDirectory}voice-recordings/`;
const ANALYSIS_PATH = `${FileSystem.documentDirectory}recording-analysis.json`;
const AGENT_CARDS_PATH = `${FileSystem.documentDirectory}agent-cards.json`;
const DELETED_AUDIO_NAMES_PATH = `${FileSystem.documentDirectory}deleted-audio-names.json`;
const DURATION_CACHE_PATH = `${FileSystem.documentDirectory}audio-duration-cache.json`;
export const AGENT_THRESHOLD_MS = 30_000;

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

/**
 * List local audio. Classified files are sealed in cache — no AV duration scan on later visits.
 * Pass `{ remasure: true }` to force re-probe (e.g. debug / user refresh).
 */
export async function listLocalAudioFiles(opts?: {
  remasure?: boolean;
}): Promise<LocalAudioFile[]> {
  const dir = await FileSystem.getInfoAsync(RECORDING_DIR);
  if (!dir.exists) return [];

  const deleted = await readDeletedAudioNames();
  const names = (await FileSystem.readDirectoryAsync(RECORDING_DIR)).filter((name) => {
    const lower = name.toLowerCase();
    if (!(lower.endsWith('.ogg') || lower.endsWith('.m4a'))) return false;
    return !deleted.has(name);
  });
  const cache = await readDurationCache();
  let dirty = false;
  const files: LocalAudioFile[] = [];
  for (const name of names) {
    const result = await loadFile(name, cache, Boolean(opts?.remasure));
    files.push(result.file);
    if (result.dirty) dirty = true;
  }
  if (dirty) await writeDurationCache(cache);
  return files.sort((a, b) => compareDemoFirst(a.name, b.name, b.modifiedAt - a.modifiedAt));
}

/** Force AV duration + category refresh for every on-disk file. */
export async function remasureLocalAudioLibrary(): Promise<LocalAudioFile[]> {
  return listLocalAudioFiles({ remasure: true });
}

export async function deleteLocalAudioFile(uri: string) {
  const name = uri.split('/').pop();
  if (name) {
    await rememberDeletedAudioNames([name]);
    const cache = await readDurationCache();
    if (cache[name]) {
      delete cache[name];
      await writeDurationCache(cache);
    }
  }
  await FileSystem.deleteAsync(uri, { idempotent: true });
}

export async function clearLocalAudioFiles() {
  const existingNames = await listAudioNamesOnDisk();
  if (existingNames.length > 0) await rememberDeletedAudioNames(existingNames);

  await FileSystem.deleteAsync(RECORDING_DIR, { idempotent: true });
  await FileSystem.makeDirectoryAsync(RECORDING_DIR, { intermediates: true });
  await FileSystem.deleteAsync(ANALYSIS_PATH, { idempotent: true });
  await FileSystem.deleteAsync(AGENT_CARDS_PATH, { idempotent: true });
  await FileSystem.deleteAsync(DURATION_CACHE_PATH, { idempotent: true });
}

export async function isDeletedAudioName(name: string): Promise<boolean> {
  const deleted = await readDeletedAudioNames();
  return deleted.has(name);
}

/**
 * After ring sync, permanently drop any files the user already deleted on phone.
 * Sync may still download them from the ring; we remove them again and keep the tombstone.
 */
export async function purgeReimportedDeletedAudio(): Promise<void> {
  const names = await readDeletedAudioNames();
  if (names.size === 0) return;
  await Promise.all(
    [...names].map((name) =>
      FileSystem.deleteAsync(`${RECORDING_DIR}${name}`, { idempotent: true })
    )
  );
}

async function listAudioNamesOnDisk(): Promise<string[]> {
  const dir = await FileSystem.getInfoAsync(RECORDING_DIR);
  if (!dir.exists) return [];
  return (await FileSystem.readDirectoryAsync(RECORDING_DIR)).filter((name) => {
    const lower = name.toLowerCase();
    return lower.endsWith('.ogg') || lower.endsWith('.m4a');
  });
}

async function rememberDeletedAudioNames(toAdd: string[]) {
  const names = await readDeletedAudioNames();
  for (const name of toAdd) names.add(name);
  await FileSystem.writeAsStringAsync(DELETED_AUDIO_NAMES_PATH, JSON.stringify([...names]));
}

async function readDeletedAudioNames(): Promise<Set<string>> {
  try {
    const raw = await FileSystem.readAsStringAsync(DELETED_AUDIO_NAMES_PATH);
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : []);
  } catch {
    return new Set();
  }
}

async function loadFile(
  name: string,
  cache: Record<string, DurationCacheEntry>,
  remasure: boolean
): Promise<{ file: LocalAudioFile; dirty: boolean }> {
  // Keep a raw file:// path for AVPlayback — encoding the filename breaks expo-av on iOS.
  const uri = `${RECORDING_DIR}${name}`;
  const info = await FileSystem.getInfoAsync(uri, { size: true });
  const size = info.exists && 'size' in info ? Number(info.size || 0) : 0;
  const modifiedAt =
    info.exists && 'modificationTime' in info ? Number(info.modificationTime || 0) * 1000 : 0;

  const cached = cache[name];
  const sameIdentity = Boolean(cached && cached.size === size && cached.modifiedAt === modifiedAt);
  const sealedHit = Boolean(sameIdentity && cached && (cached.sealed || cached.durationMs > 0));

  // ABCD already classified: never open AV again unless remasure or file bytes changed.
  if (!remasure && sealedHit && cached) {
    if (!cached.sealed) {
      cache[name] = { ...cached, sealed: true };
      return {
        file: toLocalFile(name, uri, size, modifiedAt, cached.durationMs, cached.category),
        dirty: true
      };
    }
    return {
      file: toLocalFile(name, uri, size, modifiedAt, cached.durationMs, cached.category),
      dirty: false
    };
  }

  const durationMs = await readDuration(uri);
  let category: 'recording' | 'agent';
  let sealed: boolean;
  let finalDuration = durationMs;

  if (durationMs > 0) {
    category = categorize(durationMs);
    sealed = true;
  } else if (sameIdentity && cached && cached.durationMs > 0) {
    finalDuration = cached.durationMs;
    category = cached.category || categorize(finalDuration);
    sealed = true;
  } else if (sameIdentity && cached?.sealed) {
    finalDuration = cached.durationMs;
    category = cached.category;
    sealed = true;
  } else {
    // First-time decode failed: park in Recordings, leave unsealed so one later remasure can fix.
    category = 'recording';
    sealed = false;
    finalDuration = 0;
  }

  cache[name] = { size, modifiedAt, durationMs: finalDuration, category, sealed };
  return {
    file: toLocalFile(name, uri, size, modifiedAt, finalDuration, category),
    dirty: true
  };
}

function toLocalFile(
  name: string,
  uri: string,
  size: number,
  modifiedAt: number,
  durationMs: number,
  category: 'recording' | 'agent'
): LocalAudioFile {
  return { id: uri, name, uri, size, modifiedAt, durationMs, category };
}

function categorize(durationMs: number): 'recording' | 'agent' {
  return durationMs > 0 && durationMs < AGENT_THRESHOLD_MS ? 'agent' : 'recording';
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

async function readDurationCache(): Promise<Record<string, DurationCacheEntry>> {
  try {
    const parsed = JSON.parse(await FileSystem.readAsStringAsync(DURATION_CACHE_PATH));
    if (!parsed || typeof parsed !== 'object') return {};
    // Migrate older cache entries without `sealed`.
    for (const key of Object.keys(parsed)) {
      const entry = parsed[key];
      if (entry && typeof entry === 'object' && entry.sealed == null) {
        entry.sealed = Number(entry.durationMs || 0) > 0;
      }
    }
    return parsed;
  } catch {
    return {};
  }
}

async function writeDurationCache(cache: Record<string, DurationCacheEntry>) {
  await FileSystem.writeAsStringAsync(DURATION_CACHE_PATH, JSON.stringify(cache));
}
