import { URL } from 'react-native-url-polyfill';
import type { RingRecording } from './types';

// iOS may relocate the data container on every overwrite install. The relative
// filename in our one managed recording directory is stable; the sandbox is not.
export function recordingKey(uri: string): string {
  try {
    const url = new URL(uri);
    if (url.protocol !== 'file:' || url.host || url.search || url.hash)
      return uri;
    const match = url.pathname.match(/\/voice-recordings\/([^/]+)$/);
    if (!match) return uri;
    const name = decodeURIComponent(match[1]);
    if (!name || name === '.' || name === '..' || /[/\\]/.test(name))
      return uri;
    return `recording:${name}`;
  } catch {
    return uri;
  }
}

export function sameRecording(a?: string, b?: string) {
  return !!a && !!b && recordingKey(a) === recordingKey(b);
}

function richness(file: RingRecording) {
  return (
    (file.transcript?.trim() ? 100 : 0) +
    (file.aiReply ? (file.aiReplyState === 'done' ? 20 : 10) : 0) +
    (file.displayTitle ? 1 : 0)
  );
}

export function mergeRecordingFiles(
  existing: RingRecording[],
  incoming: RingRecording[],
  deletedUris: string[],
) {
  const deleted = new Set(deletedUris.map(recordingKey));
  const all = new Map<string, RingRecording>();
  for (const file of [...existing, ...incoming]) {
    const key = recordingKey(file.uri);
    if (deleted.has(key)) continue;
    const previous = all.get(key);
    if (!previous) {
      all.set(key, file);
      continue;
    }
    const preferred = richness(file) > richness(previous) ? file : previous;
    const replies = [
      ...new Set(
        [
          ...(previous.previousAiReplies || []),
          ...(file.previousAiReplies || []),
          previous.aiReplyState === 'done' ? previous.aiReply : undefined,
          file.aiReplyState === 'done' ? file.aiReply : undefined,
        ].filter(
          (value): value is string => !!value && value !== preferred.aiReply,
        ),
      ),
    ];
    const transcripts = [
      ...new Set(
        [
          ...(previous.previousTranscripts || []),
          ...(file.previousTranscripts || []),
          previous.transcript,
          file.transcript,
        ].filter(
          (value): value is string => !!value && value !== preferred.transcript,
        ),
      ),
    ];
    all.set(key, {
      ...file,
      ...previous,
      ...preferred,
      // Keep existing references and in-flight requests valid. Native code
      // resolves this relative recording into the current sandbox at access time.
      uri: previous.uri,
      timestamp: previous.timestamp,
      transcript: preferred.transcript,
      recognitionState: preferred.recognitionState,
      recognitionError: preferred.recognitionError,
      aiReply: preferred.aiReply,
      aiReplyState: preferred.aiReplyState,
      aiReplyError: preferred.aiReplyError,
      aiReplyCompletedAt: preferred.aiReplyCompletedAt,
      displayTitle: previous.displayTitle || file.displayTitle,
      ...(replies.length ? { previousAiReplies: replies } : {}),
      ...(transcripts.length ? { previousTranscripts: transcripts } : {}),
    });
  }
  return [...all.values()].sort((a, b) => b.timestamp - a.timestamp);
}
