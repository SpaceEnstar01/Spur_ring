import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { sameRecording } from '../ring/recordingIdentity';
export type Note = {
  intentParentId?: string;
  intentParentRevision?: number;
  recordingUri?: string;
  id: string;
  title: string;
  text: string;
  createdAt: number;
};
export const useNotesStore = create<{
  notes: Note[];
  save: (note: Note) => void;
  remove: (id: string) => void;
  removeByRecording: (uri: string) => void;
}>()(
  persist(
    set => ({
      notes: [],
      remove: id =>
        set(state => ({ notes: state.notes.filter(note => note.id !== id) })),
      removeByRecording: uri =>
        set(state => ({
          notes: state.notes.filter(
            note => !sameRecording(note.recordingUri, uri),
          ),
        })),
      save: note =>
        set(state => ({
          notes: [
            note,
            ...state.notes.filter(
              item =>
                item.id !== note.id &&
                !sameRecording(item.recordingUri, note.recordingUri),
            ),
          ],
        })),
    }),
    { name: 'supr-notes-v1', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
