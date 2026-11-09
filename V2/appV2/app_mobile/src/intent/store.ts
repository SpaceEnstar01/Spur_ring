import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  states,
  kinds,
  frames,
  Capture,
  Frame,
  History,
  IntentItem,
  Interpretation,
  ItemState,
  Source,
  initialState,
} from './model';
let persistenceBlocked = false;
const ledgerStorage = {
  getItem: (name: string) => AsyncStorage.getItem(name),
  setItem: async (name: string, value: string) => {
    if (persistenceBlocked) return;
    try {
      await AsyncStorage.setItem(name, value);
    } catch {
      persistenceBlocked = true;
      useIntentStore.setState({
        loadError:
          'Intent changes could not be saved. Original captures are safe. Restart after checking available storage.',
      });
    }
  },
  removeItem: (name: string) =>
    persistenceBlocked ? Promise.resolve() : AsyncStorage.removeItem(name),
};
const transitions: Partial<Record<ItemState, ItemState[]>> = {
  recorded: ['paused', 'cancelled'],
  needs_clarification: ['paused', 'cancelled'],
  ready: ['completed', 'paused', 'cancelled'],
  needs_confirmation: ['paused', 'cancelled'],
  pending: ['completed', 'paused', 'cancelled'],
  waiting: ['completed', 'paused', 'cancelled'],
  paused: [
    'pending',
    'waiting',
    'recorded',
    'needs_confirmation',
    'needs_clarification',
    'ready',
    'cancelled',
  ],
  failed: ['paused', 'cancelled'],
};
function event(
  item: IntentItem,
  reason: string,
  actor: History['actor'] = 'user',
  sourceKey?: string,
): History {
  return {
    at: Date.now(),
    actor,
    reason,
    sourceKey,
    snapshot: JSON.stringify({ ...item, history: undefined }),
  };
}
type Ledger = {
  captures: Record<string, Capture>;
  loadError: string;
  begin: (source: Source) => number;
  finish: (source: Source, revision: number, intents: Interpretation[]) => void;
  fail: (key: string, revision: number, error: string) => void;
  reconcile: (sources: Source[]) => void;
  change: (
    id: string,
    revision: number,
    patch: Partial<
      Pick<
        IntentItem,
        | 'title'
        | 'summary'
        | 'frame'
        | 'kind'
        | 'read'
        | 'pinned'
        | 'archived'
        | 'dueAt'
        | 'dueTimezone'
      >
    >,
    reason: string,
  ) => void;
  transition: (id: string, revision: number, state: ItemState) => void;
  adopt: (
    replacementId: string,
    revision: number,
    targetId: string,
    targetRevision: number,
  ) => void;
  apply: (
    updateId: string,
    updateRevision: number,
    targetId: string,
    targetRevision: number,
  ) => void;
};
function locate(captures: Ledger['captures'], id: string, revision: number) {
  if (useIntentStore.getState().loadError)
    throw new Error(useIntentStore.getState().loadError);
  const capture = Object.values(captures).find(c =>
    c.items.some(i => i.id === id),
  );
  const item = capture?.items.find(i => i.id === id);
  if (
    !capture ||
    !item ||
    item.revision !== revision ||
    capture.state === 'working' ||
    capture.error === 'Source changed. Reclassify before using these cards.'
  )
    throw new Error('This item changed. Close and reopen it before editing.');
  return { capture, item };
}
export const useIntentStore = create<Ledger>()(
  persist(
    (set, get) => ({
      captures: {},
      loadError: '',
      begin: source => {
        if (get().loadError) throw new Error(get().loadError);
        const previous = get().captures[source.key];
        if (previous?.state === 'working')
          throw new Error('This capture is already being organized.');
        const revision = (previous?.revision || 0) + 1;
        set(state => ({
          captures: {
            ...state.captures,
            [source.key]: {
              source,
              revision,
              state: 'working',
              previousText: previous?.source.text,
              items: previous?.items || [],
            },
          },
        }));
        return revision;
      },
      finish: (source, revision, intents) => {
        const previous = get().captures[source.key];
        if (
          !previous ||
          previous.revision !== revision ||
          previous.source.text !== source.text
        )
          return;
        const now = Date.now();
        const used = new Set<string>();
        const items = intents.map((intent, index): IntentItem => {
          const exact = previous.items.find(
            item =>
              !used.has(item.id) &&
              item.state !== 'superseded' &&
              item.sourceSpan === intent.sourceSpan &&
              item.kind === intent.kind &&
              item.frame === intent.frame,
          );
          const candidates = previous.items.filter(
            item =>
              !used.has(item.id) &&
              item.state !== 'superseded' &&
              item.kind === intent.kind &&
              item.frame === intent.frame,
          );
          const old =
            exact ||
            (previous.previousText === source.text &&
            candidates.length === 1 &&
            intents.filter(
              i => i.kind === intent.kind && i.frame === intent.frame,
            ).length === 1
              ? candidates[0]
              : undefined);
          if (old) used.add(old.id);
          const id = old?.id || `${source.key}#${revision}:${index}`;
          const parent = Object.values(get().captures)
            .flatMap(c => c.items)
            .find(i => i.id === source.parentItemId);
          const item: IntentItem = {
            ...intent,
            id,
            sourceKey: source.key,
            matterId: parent?.matterId || old?.matterId || id,
            revision: (old?.revision || 0) + 1,
            state:
              old && ['completed', 'cancelled', 'paused'].includes(old.state)
                ? old.state
                : initialState(intent),
            dueAt: old?.dateText === intent.dateText ? old?.dueAt : undefined,
            dueTimezone:
              old?.dateText === intent.dateText ? old?.dueTimezone : undefined,
            reason:
              'Prepared from this capture. No external action was performed.',
            createdAt: old?.createdAt || now,
            updatedAt: now,
            read: false,
            archived: old?.archived || false,
            pinned: old?.pinned || false,
            history: old
              ? [
                  ...old.history,
                  event(old, 'Reinterpreted from source', 'model', source.key),
                ]
              : [],
          };
          return {
            ...item,
            history: [
              ...item.history,
              event(item, 'Interpretation prepared', 'model', source.key),
            ],
          };
        });
        // Preserve removed classifications as superseded history, never continue them.
        const removed = previous.items
          .filter(item => !used.has(item.id))
          .map(old => ({
            ...old,
            state: 'superseded' as const,
            archived: true,
            revision: old.revision + 1,
            updatedAt: now,
            history: [
              ...old.history,
              event(
                old,
                'Replaced by new interpretation',
                'system',
                source.key,
              ),
            ],
          }));
        set(state => ({
          captures: {
            ...state.captures,
            [source.key]: {
              source,
              revision,
              state: 'done',
              items: [...items, ...removed],
            },
          },
        }));
      },
      fail: (key, revision, error) => {
        const previous = get().captures[key];
        if (previous?.revision === revision)
          set(state => ({
            captures: {
              ...state.captures,
              [key]: { ...previous, state: 'failed', error },
            },
          }));
      },
      reconcile: sources => {
        const known = new Map(sources.map(source => [source.key, source]));
        let changed = false;
        const captures = Object.fromEntries(
          Object.entries(get().captures)
            .filter(([key]) => {
              if (!known.has(key)) {
                changed = true;
                return false;
              }
              return true;
            })
            .map(([key, capture]) => {
              if (
                known.get(key)?.text !== capture.source.text &&
                capture.error !==
                  'Source changed. Reclassify before using these cards.'
              ) {
                changed = true;
                return [
                  key,
                  {
                    ...capture,
                    revision: capture.revision + 1,
                    state: 'failed',
                    error:
                      'Source changed. Reclassify before using these cards.',
                  },
                ];
              }
              return [key, capture];
            }),
        ) as Record<string, Capture>;
        if (changed) set({ captures });
      },
      change: (id, revision, patch, reason) => {
        const { capture, item } = locate(get().captures, id, revision);
        if (
          patch.title !== undefined &&
          (!patch.title.trim() || patch.title.length > 180)
        )
          throw new Error('Title must contain 1–180 characters.');
        if (patch.summary !== undefined && patch.summary.length > 2500)
          throw new Error('Summary is too long.');
        if (
          patch.dueAt !== undefined &&
          (!Number.isFinite(patch.dueAt) ||
            patch.dueAt <= Date.now() ||
            !['reminder', 'commitment', 'decision'].includes(
              patch.frame || item.frame,
            ) ||
            (patch.kind || item.kind) === 'idea')
        )
          throw new Error('Only action items can have a confirmed date.');
        const nextKind = patch.kind || item.kind,
          nextFrame = patch.frame || item.frame;
        if (
          (nextKind === 'idea' && nextFrame !== 'idea') ||
          (nextKind === 'decision' &&
            !['decision', 'clarification'].includes(nextFrame)) ||
          (nextKind === 'commitment' &&
            !['commitment', 'clarification'].includes(nextFrame))
        )
          throw new Error('Intent and display framework do not match.');
        let state = item.state;
        if (patch.frame || patch.kind)
          state = initialState({
            ...item,
            ...patch,
            questions:
              (patch.kind || item.kind) === 'idea' ? [] : item.questions,
          });
        if (
          patch.dueAt &&
          item.frame === 'reminder' &&
          !item.questions.filter(
            q => !/\b(?:time|when|date)\b|时间|日期/i.test(q),
          ).length
        )
          state = 'pending';
        const next = {
          ...item,
          ...patch,
          state,
          questions:
            (patch.kind || item.kind) === 'idea'
              ? []
              : patch.dueAt
              ? item.questions.filter(
                  q => !/\b(?:time|when|date)\b|时间|日期/i.test(q),
                )
              : item.questions,
          revision: item.revision + 1,
          updatedAt: Date.now(),
          history: [...item.history, event(item, reason)],
        };
        set(current => ({
          captures: {
            ...current.captures,
            [item.sourceKey]: {
              ...capture,
              items: capture.items.map(i => (i.id === id ? next : i)),
            },
          },
        }));
      },
      transition: (id, revision, state) => {
        const { capture, item } = locate(get().captures, id, revision);
        if (!transitions[item.state]?.includes(state))
          throw new Error('This state change is not available.');
        if (
          state === 'completed' &&
          ['idea', 'decision', 'clarification'].includes(item.frame)
        )
          throw new Error('This card is a record, not an executed task.');
        // Email can never become sent/completed here. Reminder is page-only.
        if (item.frame === 'email' && state === 'completed')
          throw new Error(
            'No email service is connected. This is a draft only.',
          );
        const next = {
          ...item,
          state,
          reason:
            state === 'completed'
              ? 'User marked this item complete; not independently verified.'
              : `User changed state to ${state}.`,
          revision: item.revision + 1,
          updatedAt: Date.now(),
          history: [
            ...item.history,
            event(item, `User changed state to ${state}`),
          ],
        };
        set(current => ({
          captures: {
            ...current.captures,
            [item.sourceKey]: {
              ...capture,
              items: capture.items.map(i => (i.id === id ? next : i)),
            },
          },
        }));
      },
      adopt: (replacementId, revision, targetId, targetRevision) => {
        const all = { ...get().captures };
        const { capture, item: replacement } = locate(
          all,
          replacementId,
          revision,
        );
        const { item: target } = locate(all, targetId, targetRevision);
        if (
          capture.source.parentItemId !== targetId ||
          capture.source.parentRevision !== target.revision ||
          replacement.id === targetId ||
          ['correction', 'progress'].includes(replacement.kind) ||
          ['completed', 'cancelled', 'superseded'].includes(target.state)
        )
          throw new Error('This draft cannot replace the selected item.');
        const content = {
          presentation: replacement.presentation,
          metrics: replacement.metrics,
          kind: replacement.kind,
          frame: replacement.frame,
          title: replacement.title,
          summary: replacement.summary,
          actor: replacement.actor,
          counterparty: replacement.counterparty,
          deliverable: replacement.deliverable,
          direction: replacement.direction,
          dateText: replacement.dateText,
          sections: replacement.sections,
          checklist: replacement.checklist,
          questions: replacement.questions,
          email: replacement.email,
        };
        const changedTarget = {
          ...target,
          ...content,
          dueAt:
            target.dateText === replacement.dateText ? target.dueAt : undefined,
          state: initialState({ ...target, ...content }),
          read: false,
          revision: target.revision + 1,
          updatedAt: Date.now(),
          reason:
            'User approved the prepared revision; no external action performed.',
          history: [
            ...target.history,
            event(
              target,
              'User adopted prepared follow-up',
              'user',
              replacement.sourceKey,
            ),
          ],
        };
        const changedReplacement = {
          ...replacement,
          targetId,
          matterId: target.matterId,
          archived: true,
          state: 'superseded' as const,
          revision: replacement.revision + 1,
          history: [
            ...replacement.history,
            event(
              replacement,
              'Adopted into existing item',
              'user',
              target.sourceKey,
            ),
          ],
        };
        for (const changed of [changedTarget, changedReplacement]) {
          const current = all[changed.sourceKey];
          all[changed.sourceKey] = {
            ...current,
            items: current.items.map(item =>
              item.id === changed.id ? changed : item,
            ),
          };
        }
        set({ captures: all });
      },
      apply: (updateId, updateRevision, targetId, targetRevision) => {
        const all = { ...get().captures };
        const { item: update } = locate(all, updateId, updateRevision);
        const { item: target } = locate(all, targetId, targetRevision);
        if (
          !['correction', 'progress'].includes(update.kind) ||
          update.id === target.id ||
          update.state === 'completed' ||
          ['completed', 'cancelled', 'superseded'].includes(target.state)
        )
          throw new Error(
            'Choose an active, different target for this update.',
          );
        if (update.change === 'replace' && update.kind !== 'correction')
          throw new Error('Only a correction can supersede a decision.');
        const nextState: ItemState =
          update.change === 'cancel'
            ? 'cancelled'
            : update.change === 'pause'
            ? 'paused'
            : update.change === 'complete'
            ? 'completed'
            : update.change === 'replace'
            ? 'superseded'
            : target.state;
        const now = Date.now();
        // Link evidence rather than silently rewriting a script, recipient or deadline.
        const changedTarget = {
          ...target,
          state: nextState,
          revision: target.revision + 1,
          updatedAt: now,
          reason: update.summary,
          read: false,
          sections: [
            ...target.sections,
            { heading: 'User-confirmed update', body: update.summary },
          ],
          history: [
            ...target.history,
            event(
              target,
              `Applied confirmed ${update.kind}: ${update.summary}`,
              'user',
              update.sourceKey,
            ),
          ],
        };
        const effectiveReplacement =
          update.change === 'replace' &&
          target.frame === 'decision' &&
          !!update.replacement;
        const changedUpdate = {
          ...update,
          ...(effectiveReplacement
            ? {
                kind: 'decision' as const,
                frame: 'decision' as const,
                summary: update.replacement!,
                questions: [],
              }
            : {}),
          targetId,
          matterId: target.matterId,
          state: effectiveReplacement
            ? ('recorded' as const)
            : ('completed' as const),
          revision: update.revision + 1,
          updatedAt: now,
          reason:
            'User linked this update to the selected item. This does not verify any external action.',
          history: [
            ...update.history,
            event(
              update,
              `User selected target ${target.title}`,
              'user',
              target.sourceKey,
            ),
          ],
        };
        for (const changed of [changedTarget, changedUpdate]) {
          const capture = all[changed.sourceKey];
          all[changed.sourceKey] = {
            ...capture,
            items: capture.items.map(item =>
              item.id === changed.id ? changed : item,
            ),
          };
        }
        set({ captures: all });
      },
    }),
    {
      name: 'spur-v2-intent-ledger-v1',
      version: 1,
      storage: createJSONStorage(() => ledgerStorage),
      partialize: state => ({ captures: state.captures }),
      merge: (persisted, current) => {
        if (!persisted) return current;
        const data = persisted as { captures?: Record<string, Capture> };
        if (
          !data.captures ||
          typeof data.captures !== 'object' ||
          Array.isArray(data.captures) ||
          Object.values(data.captures).some(
            c =>
              !c ||
              !c.source ||
              typeof c.source.text !== 'string' ||
              typeof c.source.key !== 'string' ||
              !Number.isInteger(c.revision) ||
              !['working', 'done', 'failed'].includes(c.state) ||
              !Array.isArray(c.items) ||
              c.items.some(
                i =>
                  !i ||
                  !states.includes(i.state) ||
                  !kinds.includes(i.kind) ||
                  !frames.includes(i.frame) ||
                  !Array.isArray(i.history) ||
                  !Array.isArray(i.sections) ||
                  typeof i.id !== 'string',
              ),
          )
        )
          throw new Error('Invalid intent ledger storage');
        return { ...current, captures: data.captures };
      },
      onRehydrateStorage: () => (_state, error) => {
        if (error) {
          persistenceBlocked = true;
          useIntentStore.setState({
            loadError:
              'Intent records could not be read. Restart the app; existing storage will not be overwritten.',
          });
        }
      },
    },
  ),
);
export async function intentStorageReady() {
  if (useIntentStore.getState().loadError)
    throw new Error(useIntentStore.getState().loadError);
  if (useIntentStore.persist.hasHydrated()) return;
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      unsubscribe();
      reject(new Error('Intent storage is not ready. Please retry.'));
    }, 10000);
    const unsubscribe = useIntentStore.persist.onFinishHydration(() => {
      clearTimeout(timeout);
      resolve();
    });
  });
}
export function allItems() {
  return Object.values(useIntentStore.getState().captures).flatMap(
    c => c.items,
  );
}
export function frameLabel(frame: Frame) {
  return {
    idea: 'Idea',
    decision: 'Decision',
    commitment: 'Commitment',
    reminder: 'Reminder',
    clarification: 'Clarification',
    email: 'Email draft',
    report: 'Report & analysis',
    script: 'Script & shooting plan',
  }[frame];
}
