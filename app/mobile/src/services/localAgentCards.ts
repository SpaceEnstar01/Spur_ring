import * as FileSystem from 'expo-file-system';

import { parseAlarmIntent, type AlarmSchedule } from '@/services/alarmIntent';
import { processAudioWithAi } from '@/services/audioAgentApi';
import { listRecordingAnalyses, processLocalRecording, deleteRecordingAnalysis } from '@/services/localRecordingAnalysis';
import { compareDemoFirst } from '@/services/demoContent';
import { deleteLocalAudioFile, listLocalAudioFiles, type LocalAudioFile } from '@/services/localAudioLibrary';
import { isVoiceAgentOwnedFile } from '@/voice-agent/voiceAgentRuntime';

export type AgentCardStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type AgentCardCategory = 'idea' | 'report' | 'action' | 'note' | 'alarm';

export type AgentOfficeStatus = 'generating' | 'ready' | 'failed' | 'cancelled';

export type AgentOfficeState = {
  kind: 'pdf' | 'pptx';
  status: AgentOfficeStatus;
  trajectory: string[];
  prompt?: string;
  fileName?: string;
  localUri?: string;
  remoteUrl?: string;
  error?: string;
  startedAt?: number;
};

export type LocalAgentCard = {
  id: string;
  fileUri: string;
  fileName: string;
  durationMs: number;
  size?: number;
  processingKind?: 'recording_summary' | 'agent_command';
  modifiedAt: number;
  status: AgentCardStatus;
  favorite: boolean;
  title: string;
  category: AgentCardCategory;
  transcript?: string;
  output?: string;
  imageUrl?: string;
  summary?: string;
  remoteId?: string;
  error?: string;
  office?: AgentOfficeState;
  /** Phone-clock timer; ring vibrates when phone fires the command. */
  alarm?: AlarmSchedule;
  updatedAt: number;
};

const INDEX_PATH = `${FileSystem.documentDirectory}agent-cards.json`;

export async function syncLocalAgentCards(): Promise<LocalAgentCard[]> {
  const [files, saved, analyses] = await Promise.all([listLocalAudioFiles(), readCards(), listRecordingAnalyses()]);
  const visibleFiles = files.filter((file) => !isVoiceAgentOwnedFile(file.id));
  const cards = visibleFiles.map((file) => {
    const existing = saved[file.id];
    if (!existing) {
      const card = createPendingCard(file);
      const analysis = analyses[file.id];
      if (file.category === 'recording' && analysis) {
        return { ...card, status: analysis.status, title: deriveTitle(analysis.meetingNotes || '', analysis.transcript || ''),
          transcript: analysis.transcript, output: analysis.meetingNotes, summary: summarize(analysis.meetingNotes || analysis.transcript || ''),
          remoteId: analysis.remoteId, error: analysis.error, updatedAt: analysis.updatedAt };
      }
      return card;
    }
    // Keep completed demo payload, but always refresh playable uri/duration from disk.
    return {
      ...existing,
      id: file.id,
      fileUri: file.uri,
      fileName: file.name,
      size: file.size,
      processingKind: existing.processingKind || (file.category === 'recording' ? 'recording_summary' as const : 'agent_command' as const),
      durationMs: file.durationMs || existing.durationMs,
      modifiedAt: file.modifiedAt || existing.modifiedAt
    };
  });

  const latestSaved = await readCards();
  for (const card of cards) {
    const live = latestSaved[card.id];
    if (live?.office && (live.updatedAt || 0) >= (card.updatedAt || 0)) {
      card.office = live.office;
      card.updatedAt = live.updatedAt;
    }
  }

  await writeCards(Object.fromEntries(cards.map((card) => [card.id, card])));
  const { markStaleOfficeJobs } = await import('@/services/officeJob');
  return sortCards(await markStaleOfficeJobs(cards));
}

export async function getLocalAgentCard(id: string): Promise<LocalAgentCard | null> {
  const cards = await readCards();
  return cards[id] ?? null;
}

export async function processAgentCard(card: LocalAgentCard): Promise<LocalAgentCard> {
  const processing = { ...card, status: 'processing' as const, error: undefined, updatedAt: Date.now() };
  await saveCard(processing);

  try {
    if (card.processingKind === 'recording_summary') {
      const result = await processLocalRecording({ id: card.id, uri: card.fileUri, name: card.fileName,
        size: card.size || 0, durationMs: card.durationMs, modifiedAt: card.modifiedAt, category: 'recording' });
      const output = result.meetingNotes || '';
      const completed: LocalAgentCard = { ...processing, status: 'completed', category: 'report',
        title: deriveTitle(output, result.transcript || ''), transcript: result.transcript, output,
        summary: summarize(output || result.transcript || ''), remoteId: result.remoteId, updatedAt: Date.now() };
      await saveCard(completed);
      return completed;
    }
    const result = await processAudioWithAi({ uri: card.fileUri, name: card.fileName, taskType: 'agent_command' });
    const output = result.agent.output.trim();
    const imageUrl = await cacheGeneratedImage(card.id, result.agent.imageUrl);
    const alarm = parseAlarmIntent(`${result.transcript}\n${output}`);
    const category = alarm ? 'alarm' : inferCategory(result.transcript, output);
    const title = alarm
      ? `闹钟 · ${alarm.label}`
      : deriveTitle(output, result.transcript);
    const summary = alarm
      ? `${alarm.label} · 到点连震 ${alarm.buzzTimes} 次`
      : summarize(output || result.transcript);
    const completed: LocalAgentCard = {
      ...processing,
      status: 'completed',
      title,
      category,
      transcript: result.transcript,
      output,
      imageUrl,
      summary,
      alarm: alarm ?? undefined,
      remoteId: result.id,
      updatedAt: Date.now()
    };
    await saveCard(completed);
    return completed;
  } catch (error) {
    const failed: LocalAgentCard = {
      ...processing,
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
      updatedAt: Date.now()
    };
    await saveCard(failed);
    throw error;
  }
}

export async function toggleAgentCardFavorite(card: LocalAgentCard): Promise<LocalAgentCard> {
  const updated = { ...card, favorite: !card.favorite, updatedAt: Date.now() };
  await saveCard(updated);
  return updated;
}

export async function updateAgentCardResult(
  card: LocalAgentCard,
  patch: { output: string; imageUrl?: string }
): Promise<LocalAgentCard> {
  const output = patch.output.trim();
  const imageUrl =
    patch.imageUrl === undefined
      ? card.imageUrl
      : patch.imageUrl
        ? await cacheGeneratedImage(card.id, patch.imageUrl)
        : undefined;
  const updated: LocalAgentCard = {
    ...card,
    status: 'completed',
    title: card.alarm ? card.title : deriveTitle(output, card.transcript || ''),
    category: card.alarm ? 'alarm' : inferCategory(card.transcript || '', output),
    output,
    imageUrl,
    summary: card.alarm
      ? card.summary || summarize(output || card.transcript || '')
      : summarize(output || card.transcript || ''),
    alarm: card.alarm,
    error: undefined,
    updatedAt: Date.now()
  };
  await saveCard(updated);
  return updated;
}

export async function saveAgentCard(card: LocalAgentCard) {
  await saveCard(card);
}

export async function deleteAgentCard(card: LocalAgentCard) {
  const { cancelOfficeJob } = await import('@/services/officeJob');
  await cancelOfficeJob(card.id).catch(() => undefined);
  await deleteLocalAudioFile(card.fileUri);
  await deleteRecordingAnalysis(card.id);
  if (card.imageUrl?.startsWith('file')) {
    await FileSystem.deleteAsync(card.imageUrl, { idempotent: true }).catch(() => undefined);
  }
  const cards = await readCards();
  delete cards[card.id];
  await writeCards(cards);
}

async function cacheGeneratedImage(cardId: string, remoteUrl?: string): Promise<string | undefined> {
  if (!remoteUrl) return undefined;
  try {
    const dir = `${FileSystem.documentDirectory}agent-images/`;
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    const ext = remoteUrl.match(/\.(png|jpe?g|webp)(?:\?|$)/i)?.[1] || 'png';
    const dest = `${dir}${cardId}.${ext}`;
    const downloaded = await FileSystem.downloadAsync(remoteUrl, dest);
    if (downloaded.status !== 200) return remoteUrl;
    return downloaded.uri;
  } catch {
    return remoteUrl;
  }
}

function createPendingCard(file: LocalAudioFile): LocalAgentCard {
  return {
    id: file.id,
    fileUri: file.uri,
    fileName: file.name,
    durationMs: file.durationMs,
    size: file.size,
    processingKind: file.category === 'recording' ? 'recording_summary' : 'agent_command',
    modifiedAt: file.modifiedAt,
    status: 'pending',
    favorite: false,
    title: `Voice Command ${formatClock(file.modifiedAt)}`,
    category: 'note',
    updatedAt: Date.now()
  };
}

async function readCards(): Promise<Record<string, LocalAgentCard>> {
  try {
    const parsed = JSON.parse(await FileSystem.readAsStringAsync(INDEX_PATH));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

async function saveCard(card: LocalAgentCard) {
  const cards = await readCards();
  cards[card.id] = card;
  await writeCards(cards);
}

async function writeCards(cards: Record<string, LocalAgentCard>) {
  await FileSystem.writeAsStringAsync(INDEX_PATH, JSON.stringify(cards));
}

function sortCards(cards: LocalAgentCard[]) {
  return [...cards].sort((a, b) =>
    compareDemoFirst(a.fileName, b.fileName, b.modifiedAt - a.modifiedAt)
  );
}

function deriveTitle(output: string, transcript: string) {
  const first = (output || transcript)
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*#+\s*/, '').replace(/[*_`]/g, '').trim())
    .find(Boolean);
  if (!first) return 'Voice Note';
  return first.length > 42 ? `${first.slice(0, 42)}…` : first;
}

function summarize(value: string) {
  const clean = value.replace(/[#*_`]/g, '').replace(/\s+/g, ' ').trim();
  return clean.length > 180 ? `${clean.slice(0, 180)}…` : clean;
}

function inferCategory(transcript: string, output: string): AgentCardCategory {
  const value = `${transcript} ${output}`.toLowerCase();
  if (parseAlarmIntent(`${transcript}\n${output}`)) return 'alarm';
  if (/report|报告|总结/.test(value)) return 'report';
  if (/remind|todo|action|提醒|待办|任务/.test(value)) return 'action';
  if (/idea|想法|灵感|创意/.test(value)) return 'idea';
  return 'note';
}

function formatClock(timestamp: number) {
  if (!timestamp) return '--:--';
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
