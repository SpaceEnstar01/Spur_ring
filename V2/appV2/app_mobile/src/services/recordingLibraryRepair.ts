import { useNotesStore } from '../notes/useNotesStore';
import { useRecordingStore } from '../ring/store/useRecordingStore';
import { sameRecording } from '../ring/recordingIdentity';

// Earlier deletes matched absolute URLs, leaving linked notes under older
// container aliases. Honor the existing explicit deletion, not a new bulk erase.
export function repairDeletedRecordingNotes() {
  for (const uri of useRecordingStore.getState().deletedUris) {
    if (
      useNotesStore
        .getState()
        .notes.some(note => sameRecording(note.recordingUri, uri))
    )
      useNotesStore.getState().removeByRecording(uri);
  }
}

export function startRecordingLibraryRepair() {
  const repair = () => {
    if (
      useRecordingStore.persist.hasHydrated() &&
      useNotesStore.persist.hasHydrated()
    )
      repairDeletedRecordingNotes();
  };
  const recordings = useRecordingStore.persist.onFinishHydration(repair);
  const notes = useNotesStore.persist.onFinishHydration(repair);
  repair();
  return () => {
    recordings();
    notes();
  };
}
