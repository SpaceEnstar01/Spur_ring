import type { RingRecording } from './types';

export function titleFromTranscript(text: string) {
  const sentence = text
    .trim()
    .split(/[。！？!?\n]/)
    .map(part => part.trim())
    .find(Boolean)
    ?.replace(/\s+/g, ' ');
  return sentence?.slice(0, 22) || '语音灵感';
}
export function recordingTitle(file: RingRecording) {
  if (file.displayTitle) {
    return file.displayTitle;
  }
  if (file.transcript?.trim()) {
    return titleFromTranscript(file.transcript);
  }
  if (!isAudioFilename(file.name) && /[\u4e00-\u9fff]/.test(file.name)) {
    return file.name;
  }
  const date = new Date(file.timestamp || Date.now());
  return `${file.source === 'phone' ? '语音灵感' : '戒指录音'} · ${
    date.getMonth() + 1
  }月${date.getDate()}日 ${String(date.getHours()).padStart(2, '0')}:${String(
    date.getMinutes(),
  ).padStart(2, '0')}`;
}
export function isAudioFilename(title: string) {
  return /\.(m4a|ogg|opus|wav|mp3|aac)$/i.test(title.trim());
}
