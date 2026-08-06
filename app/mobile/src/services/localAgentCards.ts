import * as FileSystem from 'expo-file-system';

import { processAudioWithAi } from '@/services/audioAgentApi';
import { deleteLocalAudioFile, listLocalAudioFiles, type LocalAudioFile } from '@/services/localAudioLibrary';

export type AgentCardStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type AgentCardCategory = 'idea' | 'report' | 'action' | 'note';

export type LocalAgentCard = {
  id: string;
  fileUri: string;
  fileName: string;
  durationMs: number;
  modifiedAt: number;
  status: AgentCardStatus;
  favorite: boolean;
  title: string;
  category: AgentCardCategory;
  transcript?: string;
  output?: string;
  summary?: string;
  remoteId?: string;
  error?: string;
  updatedAt: number;
};

const INDEX_PATH = `${FileSystem.documentDirectory}agent-cards.json`;

export async function syncLocalAgentCards(): Promise<LocalAgentCard[]> {
  const [files, saved] = await Promise.all([listLocalAudioFiles(), readCards()]);
  const shortFiles = files.filter((file) => file.category === 'agent');
  const cards = shortFiles.map((file) => saved[file.id] ?? createPendingCard(file));
  await writeCards(Object.fromEntries(cards.map((card) => [card.id, card])));
  return sortCards(cards);
}

export async function getLocalAgentCard(id: string): Promise<LocalAgentCard | null> {
  const cards = await readCards();
  return cards[id] ?? null;
}

export async function processAgentCard(card: LocalAgentCard): Promise<LocalAgentCard> {
  const processing = { ...card, status: 'processing' as const, error: undefined, updatedAt: Date.now() };
  await saveCard(processing);

  try {
    const result = await processAudioWithAi({ uri: card.fileUri, name: card.fileName, taskType: 'agent_command' });
    const output = result.agent.output.trim();
    const completed: LocalAgentCard = {
      ...processing,
      status: 'completed',
      title: deriveTitle(output, result.transcript),
      category: inferCategory(result.transcript, output),
      transcript: result.transcript,
      output,
      summary: summarize(output || result.transcript),
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

export async function deleteAgentCard(card: LocalAgentCard) {
  await deleteLocalAudioFile(card.fileUri);
  const cards = await readCards();
  delete cards[card.id];
  await writeCards(cards);
}

function createPendingCard(file: LocalAudioFile): LocalAgentCard {
  return {
    id: file.id,
    fileUri: file.uri,
    fileName: file.name,
    durationMs: file.durationMs,
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
  return [...cards].sort((a, b) => b.modifiedAt - a.modifiedAt);
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
  if (/report|报告|总结/.test(value)) return 'report';
  if (/remind|todo|action|提醒|待办|任务/.test(value)) return 'action';
  if (/idea|想法|灵感|创意/.test(value)) return 'idea';
  return 'note';
}

function formatClock(timestamp: number) {
  if (!timestamp) return '--:--';
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
