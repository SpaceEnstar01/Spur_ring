import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { AgentEntry } from '../components/AgentDashboard';

export function completedUpdates(entries: AgentEntry[]) {
  return entries
    .filter(
      entry =>
        entry.file?.aiReplyState === 'done' && entry.file.aiReply?.trim(),
    )
    .sort(
      (a, b) =>
        (b.file?.aiReplyCompletedAt ?? b.time) -
        (a.file?.aiReplyCompletedAt ?? a.time),
    );
}

export const useTodayDemoState = create<{
  decision: 'pending' | 'postponed' | 'simulated';
  setDecision: (value: 'pending' | 'postponed' | 'simulated') => void;
}>()(
  persist(
    set => ({
      decision: 'pending',
      setDecision: decision => set({ decision }),
    }),
    {
      name: 'spur-today-demo-v1',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
