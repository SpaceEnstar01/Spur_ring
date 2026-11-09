import { AppState } from 'react-native';
import { create } from 'zustand';
import { useRecordingStore } from '../ring/store/useRecordingStore';
import { phoneAudio } from './phoneAudio';
import { transcribe } from './transcriptionApi';

export const useRecognitionRuntime = create<{ issue: string }>(() => ({
  issue: '',
}));
const refreshListeners = new Set<() => void>();
export function refreshAutomaticRecognition() {
  refreshListeners.forEach(refresh => refresh());
}
// Explicit local retry only: never changes AI consent or retries model requests.
export function retryLocalRecognition() {
  useRecordingStore
    .getState()
    .files.filter(
      file => !file.transcript?.trim() && file.recognitionState === 'failed',
    )
    .forEach(file =>
      useRecordingStore.getState().setRecognition(file.uri, {
        recognitionState: undefined,
        recognitionError: undefined,
        recognitionErrorCode: undefined,
      }),
    );
  refreshAutomaticRecognition();
}

// One local recognition task at a time. Audio is never uploaded.
export function startAutomaticRecognition() {
  const recover = () =>
    useRecordingStore
      .getState()
      .files.filter(file => file.recognitionState === 'working')
      .forEach(file =>
        useRecordingStore
          .getState()
          .setRecognition(file.uri, { recognitionState: undefined }),
      );
  let stopped = false;
  let running = false;
  let active = AppState.currentState === 'active';
  let controller: AbortController | undefined;
  async function pump() {
    if (stopped || running || !active || !phoneAudio?.getPermissions) {
      return;
    }
    running = true;
    try {
      const permission = await phoneAudio.getPermissions();
      if (stopped) return;
      if (!permission.speech || !permission.onDeviceAvailable) {
        useRecognitionRuntime.setState({
          issue: !permission.speech
            ? '语音识别未授权，录音还没有转成文字，AI 暂时无法分析。'
            : '中文本机识别尚不可用，请在系统设置中启用中文听写并准备语言资源。音频不会上传。',
        });
        return;
      }
      useRecognitionRuntime.setState({ issue: '' });
      while (!stopped && active) {
        const file = useRecordingStore
          .getState()
          .files.find(
            item =>
              !item.transcript?.trim() &&
              item.recognitionState !== 'failed' &&
              item.recognitionState !== 'working',
          );
        if (!file) {
          break;
        }
        controller = new AbortController();
        const current = controller;
        useRecordingStore.getState().setRecognition(file.uri, {
          recognitionState: 'working',
          recognitionError: undefined,
          recognitionErrorCode: undefined,
        });
        const timeout = setTimeout(() => current.abort(), 120000);
        try {
          const result = await transcribe(file, current.signal);
          if (!stopped && !current.signal.aborted) {
            useRecordingStore.getState().setTranscript(file.uri, result);
          } else {
            useRecordingStore.getState().setRecognition(file.uri, {
              recognitionState: undefined,
            });
          }
        } catch (error) {
          useRecordingStore.getState().setRecognition(file.uri, {
            recognitionState: stopped || !active ? undefined : 'failed',
            recognitionError:
              stopped || !active ? undefined : (error as Error).message,
            recognitionErrorCode:
              stopped || !active
                ? undefined
                : (error as { code?: string }).code,
          });
        } finally {
          clearTimeout(timeout);
          controller = undefined;
        }
      }
    } catch {
      if (!stopped)
        useRecognitionRuntime.setState({
          issue: '暂时无法检查本机识别，请重试或到设置检查权限。',
        });
    } finally {
      running = false;
    }
  }
  const unsubscribe = useRecordingStore.subscribe(() => {
    pump();
  });
  const app = AppState.addEventListener('change', state => {
    active = state === 'active';
    if (!active) {
      controller?.abort();
    } else {
      pump();
    }
  });
  const refresh = () => {
    pump();
  };
  refreshListeners.add(refresh);
  const hydrated = useRecordingStore.persist.onFinishHydration(() => {
    recover();
    pump();
  });
  recover();
  pump();
  return () => {
    stopped = true;
    unsubscribe();
    hydrated();
    refreshListeners.delete(refresh);
    app.remove();
    controller?.abort();
  };
}
