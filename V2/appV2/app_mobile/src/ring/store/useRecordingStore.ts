import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { RingRecording } from '../types';
import { titleFromTranscript } from '../recordingTitle';
import { mergeRecordingFiles, sameRecording } from '../recordingIdentity';
type RecordingState = {
  files: RingRecording[];
  deletedUris: string[];
  remove: (uri: string) => void;
  merge: (files: RingRecording[]) => void;
  setTranscript: (uri: string, text: string) => void;
  setReply: (
    uri: string,
    patch: Partial<
      Pick<
        RingRecording,
        | 'aiReply'
        | 'aiReplyState'
        | 'aiReplyError'
        | 'aiReplyCompletedAt'
        | 'personalAgentRunId'
        | 'personalAgentState'
        | 'personalAgentProgress'
        | 'personalAgentReply'
        | 'personalAgentSources'
        | 'personalAgentArtifacts'
        | 'personalAgentError'
      >
    >,
  ) => void;
  setRecognition: (
    uri: string,
    state: Partial<
      Pick<
        RingRecording,
        'recognitionState' | 'recognitionError' | 'recognitionErrorCode'
      >
    >,
  ) => void;
};
export const useRecordingStore = create<RecordingState>()(
  persist(
    set => ({
      files: [],
      deletedUris: [],
      setReply: (uri, patch) =>
        set(state => ({
          files: state.files.map(file =>
            sameRecording(file.uri, uri)
              ? {
                  ...file,
                  ...patch,
                  ...(patch.aiReplyState === 'done'
                    ? { aiReplyCompletedAt: Date.now() }
                    : {}),
                }
              : file,
          ),
        })),
      setRecognition: (uri, patch) =>
        set(state => ({
          files: state.files.map(file =>
            sameRecording(file.uri, uri) ? { ...file, ...patch } : file,
          ),
        })),
      remove: uri =>
        set(state => ({
          files: state.files.filter(file => !sameRecording(file.uri, uri)),
          deletedUris: [...new Set([...state.deletedUris, uri])],
        })),
      setTranscript: (uri, text) =>
        set(state => ({
          files: state.files.map(file =>
            sameRecording(file.uri, uri)
              ? {
                  ...file,
                  transcript: text,
                  ...(file.transcript !== text
                    ? {
                        aiReply: undefined,
                        aiReplyState: undefined,
                        aiReplyError: undefined,
                        aiReplyCompletedAt: undefined,
                        personalAgentRunId: undefined,
                        personalAgentState: undefined,
                        personalAgentProgress: undefined,
                        personalAgentReply: undefined,
                        personalAgentSources: undefined,
                        personalAgentArtifacts: undefined,
                        personalAgentError: undefined,
                      }
                    : {}),
                  displayTitle: file.displayTitle || titleFromTranscript(text),
                  recognitionState: 'done',
                  recognitionError: undefined,
                  recognitionErrorCode: undefined,
                }
              : file,
          ),
        })),
      merge: files =>
        set(state => ({
          files: mergeRecordingFiles(state.files, files, state.deletedUris),
        })),
    }),
    {
      name: 'supr-recordings-v1',
      version: 1,
      migrate: persisted => {
        const saved = persisted as RecordingState;
        return {
          ...saved,
          files: mergeRecordingFiles(
            saved.files || [],
            [],
            saved.deletedUris || [],
          ),
        };
      },
      storage: createJSONStorage(() => AsyncStorage),
      merge: (persisted, current) => {
        const saved = persisted as Partial<RecordingState> | undefined;
        const deletedUris = saved?.deletedUris || [];
        return {
          ...current,
          ...saved,
          deletedUris,
          files: mergeRecordingFiles(
            saved?.files || [],
            current.files,
            deletedUris,
          ),
        };
      },
    },
  ),
);
