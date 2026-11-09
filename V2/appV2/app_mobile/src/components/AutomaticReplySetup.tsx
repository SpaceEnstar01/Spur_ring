import { startIntentSync } from '../intent/runtime';
import { useEffect, useRef, useState } from 'react';
import { useRecordingStore } from '../ring/store/useRecordingStore';
import {
  confirmEnableAutomaticReplies,
  startAutomaticReplies,
  useReplySettings,
} from '../services/automaticReplies';

export function AutomaticReplySetup() {
  useEffect(() => startIntentSync(), []);
  const choice = useReplySettings(state => state.choice);
  const [hydrated, setHydrated] = useState(
    useReplySettings.persist.hasHydrated() &&
      useRecordingStore.persist.hasHydrated(),
  );
  const prompted = useRef(false);
  useEffect(() => {
    const refresh = () =>
      setHydrated(
        useReplySettings.persist.hasHydrated() &&
          useRecordingStore.persist.hasHydrated(),
      );
    const settings = useReplySettings.persist.onFinishHydration(refresh);
    const recordings = useRecordingStore.persist.onFinishHydration(refresh);
    refresh();
    return () => {
      settings();
      recordings();
    };
  }, []);
  useEffect(() => {
    if (hydrated && choice === 'undecided' && !prompted.current) {
      prompted.current = true;
      confirmEnableAutomaticReplies();
    }
  }, [choice, hydrated]);
  useEffect(() => (hydrated ? startAutomaticReplies() : undefined), [hydrated]);
  return null;
}
