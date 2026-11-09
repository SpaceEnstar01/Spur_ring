import { Platform } from 'react-native';
import type { RingRecording } from '../ring/types';
import { phoneAudio } from './phoneAudio';

let sequence = 0;
let queue: Promise<unknown> = Promise.resolve();
function cancelled() {
  return Object.assign(new Error('本机识别已取消'), { name: 'AbortError' });
}
async function recoverableRecognition(
  file: RingRecording,
  signal: AbortSignal,
) {
  const started = Date.now();
  try {
    return await perform(file, signal);
  } catch (error) {
    // A quick local engine interruption is safe to retry once. Never retry a
    // denied permission, unreadable file, empty speech or a long partial job.
    if (signal.aborted) throw cancelled();
    if (
      (error as { code?: string }).code !== 'SPEECH_SERVICE' ||
      Date.now() - started > 15000
    )
      throw error;
    await new Promise<void>((resolve, reject) => {
      const abort = () => {
        clearTimeout(timer);
        signal.removeEventListener('abort', abort);
        reject(cancelled());
      };
      const timer = setTimeout(() => {
        signal.removeEventListener('abort', abort);
        resolve();
      }, 600);
      signal.addEventListener('abort', abort);
      if (signal.aborted) abort();
    });
    return perform(file, signal);
  }
}

// No network request or cloud fallback: speech stays on the phone.
async function perform(
  file: RingRecording,
  signal: AbortSignal,
): Promise<string> {
  if (signal.aborted) {
    throw cancelled();
  }
  if (Platform.OS !== 'ios' || !phoneAudio?.transcribeRecording) {
    throw new Error(
      '当前版本仅支持 iPhone 本地录音识别；此设备暂不可用，录音不会上传云端。',
    );
  }
  const requestId = `speech-${Date.now()}-${++sequence}`;
  const abort = () => phoneAudio.cancelTranscription?.(requestId);
  signal.addEventListener('abort', abort);
  try {
    const text = await phoneAudio.transcribeRecording(file.uri, requestId);
    if (signal.aborted) {
      throw cancelled();
    }
    if (!text?.trim()) {
      throw new Error('未识别到语音，请检查录音内容');
    }
    return text.trim();
  } catch (error) {
    if (signal.aborted) {
      throw cancelled();
    }
    throw error;
  } finally {
    signal.removeEventListener('abort', abort);
  }
}

export function transcribe(
  file: RingRecording,
  signal: AbortSignal,
): Promise<string> {
  if (signal.aborted) {
    return Promise.reject(cancelled());
  }
  const task = queue.then(() => recoverableRecognition(file, signal));
  queue = task.catch(() => undefined);
  return new Promise((resolve, reject) => {
    const abort = () => reject(cancelled());
    signal.addEventListener('abort', abort);
    task.then(
      value => {
        signal.removeEventListener('abort', abort);
        resolve(value);
      },
      error => {
        signal.removeEventListener('abort', abort);
        reject(error);
      },
    );
  });
}
