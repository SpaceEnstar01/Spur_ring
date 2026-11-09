import { PersonalAgentSection } from './RecordingReplyCard';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Markdown from 'react-native-markdown-display';
import type { AgentEntry } from './AgentDashboard';
import { Icon } from './Icon';
import { RealAdaptiveItem } from '../adaptive/RealAdaptiveItem';
import {
  Frame,
  IntentItem,
  ItemState,
  Source,
  frames,
  kinds,
  needsAttention,
  parseLocalTime,
  stateLabels,
} from '../intent/model';
import { frameLabel, useIntentStore } from '../intent/store';
import {
  currentSource,
  organizeNote,
  recordingSource,
} from '../intent/runtime';
import { generateRecordingReply } from '../services/automaticReplies';
import { useNotesStore } from '../notes/useNotesStore';
type Props = {
  entries: AgentEntry[];
  onOpen: (entry: AgentEntry) => void;
  renderFeed?: (
    cards: React.ReactNode[],
    attentionCount: number,
  ) => React.ReactNode;
};
export function IntentWorkspace({ entries, onOpen, renderFeed }: Props) {
  const captures = useIntentStore(state => state.captures);
  const loadError = useIntentStore(state => state.loadError);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [expandedCaptures, setExpandedCaptures] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(''),
    [summary, setSummary] = useState('');
  const [frame, setFrame] = useState<Frame>('idea');
  const [kind, setKind] = useState<IntentItem['kind']>('idea');
  const [time, setTime] = useState(''),
    [followup, setFollowup] = useState('');
  const [targetId, setTargetId] = useState('');
  const [busyNote, setBusyNote] = useState(false);
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick(n => n + 1), 60000);
    return () => clearInterval(timer);
  }, []);
  const valid = Object.values(captures).filter(
    capture => currentSource(capture.source.key)?.text === capture.source.text,
  );
  const all = valid
    .filter(c => c.state !== 'working')
    .flatMap(c => c.items)
    .sort(
      (a, b) =>
        Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt,
    );
  const items = all.filter(item =>
    showArchived
      ? true
      : !item.archived && !['superseded', 'cancelled'].includes(item.state),
  );
  const selected = all.find(item => item.id === selectedId);
  const selectedCapture = selected ? captures[selected.sourceKey] : undefined;
  const parentId = selectedCapture?.source.parentItemId;
  const sources = entries
    .map(entry =>
      entry.file
        ? recordingSource(entry.file)
        : currentSource(`note:${entry.id}`),
    )
    .filter((source): source is Source => !!source?.text);
  const unclassified = sources.filter(
    source =>
      !captures[source.key] ||
      captures[source.key].state !== 'done' ||
      captures[source.key].source.text !== source.text,
  );
  useEffect(() => {
    if (selectedId && !selected) setSelectedId(null);
  }, [selectedId, selected]);
  function attempt(job: () => void) {
    try {
      job();
    } catch (error) {
      Alert.alert('Item changed', (error as Error).message);
    }
  }
  function open(item: IntentItem) {
    setSelectedId(item.id);
    setEditing(false);
    setShowHistory(false);
    setFollowup('');
    setTime('');
    setTargetId('');
    if (!item.read)
      attempt(() =>
        useIntentStore
          .getState()
          .change(item.id, item.revision, { read: true }, 'Opened item'),
      );
  }
  function organize(source: Source) {
    Alert.alert(
      'Organize this capture?',
      'Send only this selected text to Spur’s audio cloud and model service to classify intentions and prepare content. No audio, unrelated notes or external actions.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Organize',
          onPress: () => {
            const note = source.noteId
              ? useNotesStore.getState().notes.find(n => n.id === source.noteId)
              : undefined;
            const task = source.uri
              ? generateRecordingReply(source.uri)
              : note
              ? organizeNote(note)
              : Promise.reject(new Error('Source is no longer available.'));
            task.catch(error =>
              Alert.alert('Could not organize', (error as Error).message),
            );
          },
        },
      ],
    );
  }
  function sourceLink(item: IntentItem) {
    const capture = captures[item.sourceKey];
    const entry = entries.find(e =>
      e.file
        ? recordingSource(e.file).key === item.sourceKey
        : `note:${e.id}` === item.sourceKey,
    );
    if (capture && entry) {
      setSelectedId(null);
      onOpen(entry);
    }
  }
  function stateChange(item: IntentItem, state: ItemState) {
    attempt(() =>
      useIntentStore.getState().transition(item.id, item.revision, state),
    );
  }
  function card(item: IntentItem) {
    const file =
      item.execution === 'research'
        ? entries.find(
            entry =>
              entry.file && recordingSource(entry.file).key === item.sourceKey,
          )?.file
        : undefined;
    const firstResearch = captures[item.sourceKey]?.items.find(
      candidate => candidate.execution === 'research',
    );
    const execution = file?.personalAgentState;
    const display = execution
      ? {
          ...item,
          state:
            execution === 'running'
              ? ('working' as const)
              : execution === 'done'
              ? ('completed' as const)
              : ('failed' as const),
        }
      : item;
    return (
      <View key={item.id}>
        <RealAdaptiveItem
          item={display}
          onOpen={open}
          onComplete={target => stateChange(target, 'completed')}
          onRespond={(target, answer) => {
            open(target);
            setFollowup(answer);
          }}
          onPause={
            execution ? undefined : target => stateChange(target, 'paused')
          }
        />
        {file && firstResearch?.id === item.id && (
          <PersonalAgentSection file={file} />
        )}
      </View>
    );
  }
  const attention = items.filter(needsAttention);
  const other = items.filter(item => !needsAttention(item));
  const ideas = other.filter(item => item.kind === 'idea');
  const tasks = other.filter(item => item.kind !== 'idea');
  return (
    <View>
      {valid
        .filter(c => c.state === 'working')
        .map(c => (
          <View key={c.source.key} style={s.card}>
            <Text style={s.eyebrow}>IN MOTION</Text>
            <Text style={s.cardTitle}>{c.source.title}</Text>
            <Text style={s.body}>
              正在理解录音、整理想法与提取任务，原始文字已保留。
            </Text>
          </View>
        ))}
      {!!loadError && <Text style={s.error}>{loadError}</Text>}
      {renderFeed ? (
        renderFeed([...attention, ...other].map(card), attention.length)
      ) : (
        <>
          {!!attention.length && <Text style={s.eyebrow}>需要你确认</Text>}
          {attention.map(card)}
          {!!tasks.length && <Text style={s.eyebrow}>待办、承诺与任务</Text>}
          {tasks.map(card)}
          {!!ideas.length && <Text style={s.eyebrow}>想法、灵感与知识</Text>}
          {ideas.map(card)}
        </>
      )}
      {!!all.length && (
        <Pressable
          accessibilityRole="button"
          onPress={() => setShowArchived(!showArchived)}
          style={s.linkButton}
        >
          <Text style={s.link}>
            {showArchived ? 'Hide archived items' : 'Show archived items'}
          </Text>
        </Pressable>
      )}
      {!!unclassified.length && (
        <View style={s.capturePanel}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setExpandedCaptures(!expandedCaptures)}
            style={s.linkButton}
          >
            <Text style={s.link}>
              {expandedCaptures
                ? 'Hide captures'
                : `Review ${unclassified.length} ${
                    unclassified.length === 1 ? 'capture' : 'captures'
                  }`}
            </Text>
          </Pressable>
          {expandedCaptures &&
            unclassified.slice(0, showAll ? undefined : 4).map(source => (
              <View key={source.key} style={s.unclassified}>
                <Text style={s.smallTitle}>{source.title}</Text>
                <Text numberOfLines={2} style={s.body}>
                  {source.text}
                </Text>
                {!!captures[source.key]?.error && (
                  <Text style={s.error}>{captures[source.key].error}</Text>
                )}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Organize ${source.title}`}
                  disabled={captures[source.key]?.state === 'working'}
                  onPress={() => organize(source)}
                  style={s.linkButton}
                >
                  <Text style={s.link}>
                    {captures[source.key]?.state === 'working'
                      ? 'Organizing…'
                      : 'Classify & prepare →'}
                  </Text>
                </Pressable>
              </View>
            ))}
          {expandedCaptures && unclassified.length > 4 && (
            <Pressable
              onPress={() => setShowAll(!showAll)}
              accessibilityRole="button"
            >
              <Text style={s.link}>
                {showAll
                  ? 'Show fewer'
                  : `Show all ${unclassified.length} captures`}
              </Text>
            </Pressable>
          )}
        </View>
      )}
      <Modal
        visible={!!selected}
        presentationStyle="pageSheet"
        animationType="slide"
        onRequestClose={() => setSelectedId(null)}
      >
        <SafeAreaView style={s.modal}>
          <View style={s.toolbar}>
            <Text style={s.eyebrow}>SPUR · YOUR INTENTIONS</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close intent details"
              onPress={() => setSelectedId(null)}
              style={s.close}
            >
              <Icon name="close" />
            </Pressable>
          </View>
          {selected && (
            <ScrollView
              key={selected.id}
              keyboardShouldPersistTaps="handled"
              automaticallyAdjustKeyboardInsets
              keyboardDismissMode="interactive"
              contentContainerStyle={s.details}
            >
              <Text style={s.pageTitle}>{selected.title}</Text>
              <Text style={s.note}>
                {frameLabel(selected.frame)} · {selected.kind} ·{' '}
                {stateLabels[selected.state]}
              </Text>
              <Text style={s.body}>{selected.reason}</Text>
              {selected.frame === 'reminder' && (
                <View style={s.notice}>
                  <Text style={s.body}>
                    Agent-page reminder only. This card does not schedule an iOS
                    notification. Existing system alarms keep their separate
                    verified controls.
                  </Text>
                </View>
              )}
              {selected.frame === 'email' && (
                <View style={s.notice}>
                  <Text style={s.body}>
                    Draft only · No real email account is connected. No email
                    has been sent.
                  </Text>
                </View>
              )}
              <Text selectable style={s.summary}>
                {selected.summary}
              </Text>
              <View style={s.facts}>
                {[
                  ['Actor', selected.actor === 'user' ? 'You' : selected.actor],
                  ['Counterparty', selected.counterparty],
                  ['Deliverable', selected.deliverable],
                  [
                    'Commitment',
                    selected.direction === 'user_owes'
                      ? 'You owe the delivery'
                      : selected.direction === 'other_owes'
                      ? 'Waiting on another person'
                      : 'Not established',
                  ],
                  ['Original date wording', selected.dateText],
                  [
                    'Confirmed time',
                    selected.dueAt
                      ? new Date(selected.dueAt).toLocaleString()
                      : '',
                  ],
                ]
                  .filter(([, value]) => !!value)
                  .map(([label, value]) => (
                    <View key={label} style={s.fact}>
                      <Text style={s.factLabel}>{label}</Text>
                      <Text selectable style={s.body}>
                        {value}
                      </Text>
                    </View>
                  ))}
              </View>
              {selected.email && (
                <View style={s.email}>
                  <Text style={s.smallTitle}>
                    To: {selected.email.to || 'Needs verified recipient'}
                  </Text>
                  <Text style={s.smallTitle}>
                    Subject: {selected.email.subject}
                  </Text>
                  <Text selectable style={s.body}>
                    {selected.email.body}
                  </Text>
                </View>
              )}
              {!!selected.metrics?.length && (
                <View style={s.contentSection}>
                  <Text style={s.smallTitle}>Metrics from your capture</Text>
                  {selected.metrics.map((metric, index) => (
                    <View key={index} style={s.fact}>
                      <Text style={s.smallTitle}>
                        {metric.label}: {metric.value.toLocaleString()}
                        {metric.unit}
                      </Text>
                      {metric.baseline !== undefined && (
                        <Text style={s.body}>
                          Baseline: {metric.baseline.toLocaleString()}
                          {metric.unit}
                        </Text>
                      )}
                      <Text selectable style={s.note}>
                        Source: “{metric.sourceSpan}”
                      </Text>
                    </View>
                  ))}
                </View>
              )}
              {selected.sections.map((section, index) => (
                <View key={index} style={s.contentSection}>
                  <Text style={s.smallTitle}>{section.heading}</Text>
                  <Markdown rules={{ image: () => null }}>
                    {section.body}
                  </Markdown>
                </View>
              ))}
              {!!selected.checklist.length && (
                <View style={s.contentSection}>
                  <Text style={s.smallTitle}>Checklist</Text>
                  {selected.checklist.map((step, index) => (
                    <Text selectable key={index} style={s.body}>
                      {index + 1}. {step}
                    </Text>
                  ))}
                </View>
              )}
              {!!selected.questions.length && (
                <View style={s.notice}>
                  <Text style={s.smallTitle}>Information to clarify</Text>
                  {selected.questions.map((question, index) => (
                    <Text key={index} style={s.body}>
                      • {question}
                    </Text>
                  ))}
                </View>
              )}
              {!['completed', 'cancelled', 'superseded'].includes(
                selected.state,
              ) && (
                <>
                  <Text style={s.sectionTitle}>Add information or revise</Text>
                  <TextInput
                    value={followup}
                    onChangeText={setFollowup}
                    maxLength={8000}
                    multiline
                    placeholder="Answer the questions or explain what should change…"
                    style={s.input}
                    accessibilityLabel="Intent follow-up"
                  />
                  <Pressable
                    accessibilityRole="button"
                    disabled={busyNote || !followup.trim()}
                    style={s.primary}
                    onPress={() => {
                      const text = followup.trim();
                      if (!text) return;
                      Alert.alert(
                        'Prepare an updated version?',
                        'Send this new text and this selected item’s source and content to Spur’s cloud. Other captures are not included. The original item changes only after you review and adopt the new version.',
                        [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Prepare Update',
                            onPress: async () => {
                              setBusyNote(true);
                              const note = {
                                id: `intent-followup-${Date.now()}-${Math.random()
                                  .toString(36)
                                  .slice(2, 8)}`,
                                title: `Update: ${selected.title}`,
                                text,
                                createdAt: Date.now(),
                                intentParentId: selected.id,
                                intentParentRevision: selected.revision,
                              };
                              useNotesStore.getState().save(note);
                              try {
                                await organizeNote(note, {
                                  title: selected.title,
                                  text: JSON.stringify({
                                    original: selectedCapture?.source.text,
                                    item: {
                                      title: selected.title,
                                      kind: selected.kind,
                                      frame: selected.frame,
                                      summary: selected.summary,
                                      sections: selected.sections,
                                      email: selected.email,
                                      questions: selected.questions,
                                      actor: selected.actor,
                                      counterparty: selected.counterparty,
                                      deliverable: selected.deliverable,
                                      dateText: selected.dateText,
                                    },
                                  }),
                                });
                                setFollowup('');
                                setSelectedId(null);
                              } catch (error) {
                                Alert.alert(
                                  'Update not prepared',
                                  (error as Error).message,
                                );
                              } finally {
                                setBusyNote(false);
                              }
                            },
                          },
                        ],
                      );
                    }}
                  >
                    <Text style={s.primaryText}>
                      {busyNote ? 'Preparing…' : 'Prepare Updated Version'}
                    </Text>
                  </Pressable>
                </>
              )}
              {parentId &&
                !['correction', 'progress'].includes(selected.kind) && (
                  <Pressable
                    accessibilityRole="button"
                    style={s.primary}
                    onPress={() => {
                      const target = all.find(i => i.id === parentId);
                      if (!target)
                        return Alert.alert('Original item unavailable');
                      Alert.alert(
                        'Adopt this prepared version?',
                        `Replace the working content of “${target.title}” with this version. History is retained; no external action occurs.`,
                        [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Adopt Version',
                            onPress: () =>
                              attempt(() => {
                                useIntentStore
                                  .getState()
                                  .adopt(
                                    selected.id,
                                    selected.revision,
                                    target.id,
                                    target.revision,
                                  );
                                setSelectedId(target.id);
                              }),
                          },
                        ],
                      );
                    }}
                  >
                    <Text style={s.primaryText}>Adopt into Original Item</Text>
                  </Pressable>
                )}
              {['correction', 'progress'].includes(selected.kind) &&
                selected.state !== 'completed' && (
                  <View style={s.contentSection}>
                    <Text style={s.smallTitle}>
                      Choose the item this updates
                    </Text>
                    <Text style={s.note}>
                      Proposed change: {selected.change}. Review the target
                      before confirming.
                    </Text>
                    {all
                      .filter(
                        i =>
                          i.id !== selected.id &&
                          !i.archived &&
                          !['completed', 'cancelled', 'superseded'].includes(
                            i.state,
                          ),
                      )
                      .map(target => (
                        <Pressable
                          key={target.id}
                          accessibilityRole="radio"
                          accessibilityState={{
                            checked: targetId === target.id,
                          }}
                          style={s.target}
                          onPress={() => setTargetId(target.id)}
                        >
                          <Text style={s.body}>
                            {targetId === target.id ? '● ' : '○ '}
                            {target.title}
                          </Text>
                        </Pressable>
                      ))}
                    <Pressable
                      accessibilityRole="button"
                      style={s.primary}
                      disabled={!targetId}
                      onPress={() => {
                        const target = all.find(i => i.id === targetId);
                        if (!target) return;
                        Alert.alert(
                          'Apply this update?',
                          `${selected.summary}\n\nTarget: ${target.title}\nChange: ${selected.change}\nThis records your confirmation; it does not execute or verify an external action.`,
                          [
                            { text: 'Cancel', style: 'cancel' },
                            {
                              text: 'Apply Update',
                              onPress: () =>
                                attempt(() =>
                                  useIntentStore
                                    .getState()
                                    .apply(
                                      selected.id,
                                      selected.revision,
                                      target.id,
                                      target.revision,
                                    ),
                                ),
                            },
                          ],
                        );
                      }}
                    >
                      <Text style={s.primaryText}>Confirm Target & Apply</Text>
                    </Pressable>
                  </View>
                )}
              {['reminder', 'commitment', 'decision'].includes(
                selected.frame,
              ) &&
                !['completed', 'cancelled', 'superseded'].includes(
                  selected.state,
                ) && (
                  <View style={s.contentSection}>
                    <Text style={s.smallTitle}>Confirm a time</Text>
                    <Text style={s.note}>
                      Phone local time ·{' '}
                      {Intl.DateTimeFormat().resolvedOptions().timeZone}. Only a
                      page reminder is created.
                    </Text>
                    <TextInput
                      accessibilityLabel="Confirmed intent time"
                      placeholder="YYYY-MM-DD HH:mm"
                      value={time}
                      onChangeText={setTime}
                      style={s.input}
                    />
                    <Pressable
                      accessibilityRole="button"
                      style={s.linkButton}
                      onPress={() =>
                        attempt(() => {
                          const dueAt = parseLocalTime(time);
                          if (dueAt <= Date.now())
                            throw new Error('Choose a future time.');
                          useIntentStore.getState().change(
                            selected.id,
                            selected.revision,
                            {
                              dueAt,
                              dueTimezone:
                                Intl.DateTimeFormat().resolvedOptions()
                                  .timeZone,
                            },
                            'User confirmed local deadline / page reminder',
                          );
                          setTime('');
                        })
                      }
                    >
                      <Text style={s.link}>Save Confirmed Time</Text>
                    </Pressable>
                  </View>
                )}
              <View style={s.actions}>
                {['pending', 'waiting', 'ready'].includes(selected.state) &&
                  selected.frame !== 'email' && (
                    <Action
                      title="Mark Complete"
                      onPress={() => stateChange(selected, 'completed')}
                    />
                  )}
                {!['completed', 'cancelled', 'superseded', 'paused'].includes(
                  selected.state,
                ) && (
                  <Action
                    title="Pause"
                    onPress={() => stateChange(selected, 'paused')}
                  />
                )}
                {selected.state === 'paused' && (
                  <Action
                    title="Resume"
                    onPress={() =>
                      stateChange(
                        selected,
                        selected.frame === 'email'
                          ? 'needs_confirmation'
                          : selected.questions.length ||
                            ['reminder', 'clarification'].includes(
                              selected.frame,
                            )
                          ? 'needs_clarification'
                          : selected.frame === 'commitment'
                          ? selected.direction === 'other_owes'
                            ? 'waiting'
                            : 'pending'
                          : ['idea', 'decision'].includes(selected.frame)
                          ? 'recorded'
                          : 'ready',
                      )
                    }
                  />
                )}
                {!['completed', 'cancelled', 'superseded'].includes(
                  selected.state,
                ) && (
                  <Action
                    title="Cancel Item"
                    onPress={() =>
                      Alert.alert(
                        'Cancel this item?',
                        'This stops the internal item only. It does not recall messages or cancel external bookings.',
                        [
                          { text: 'Keep', style: 'cancel' },
                          {
                            text: 'Cancel Item',
                            style: 'destructive',
                            onPress: () => stateChange(selected, 'cancelled'),
                          },
                        ],
                      )
                    }
                  />
                )}
                <Action
                  title={selected.pinned ? 'Unpin' : 'Pin'}
                  onPress={() =>
                    attempt(() =>
                      useIntentStore
                        .getState()
                        .change(
                          selected.id,
                          selected.revision,
                          { pinned: !selected.pinned },
                          'Changed pin',
                        ),
                    )
                  }
                />
                <Action
                  title={selected.archived ? 'Unarchive' : 'Archive'}
                  onPress={() =>
                    attempt(() =>
                      useIntentStore
                        .getState()
                        .change(
                          selected.id,
                          selected.revision,
                          { archived: !selected.archived },
                          'Changed archive',
                        ),
                    )
                  }
                />
                <Action
                  title="Correct Classification"
                  onPress={() => {
                    setEditing(!editing);
                    setTitle(selected.title);
                    setSummary(selected.summary);
                    setFrame(selected.frame);
                    setKind(selected.kind);
                  }}
                />
                <Action
                  title="View Original Source"
                  onPress={() => sourceLink(selected)}
                />
                <Action
                  title={showHistory ? 'Hide History' : 'Show History'}
                  onPress={() => setShowHistory(!showHistory)}
                />
              </View>
              {editing && (
                <View style={s.notice}>
                  <Text style={s.smallTitle}>Edit internal classification</Text>
                  <TextInput
                    value={title}
                    maxLength={180}
                    onChangeText={setTitle}
                    style={s.input}
                    accessibilityLabel="Intent title"
                  />
                  <TextInput
                    value={summary}
                    maxLength={2500}
                    onChangeText={setSummary}
                    multiline
                    style={s.input}
                    accessibilityLabel="Intent summary"
                  />
                  <Text style={s.note}>Intent</Text>
                  <View style={s.actions}>
                    {kinds.map(value => (
                      <Action
                        key={value}
                        title={`${kind === value ? '✓ ' : ''}${value}`}
                        onPress={() => {
                          setKind(value);
                          if (
                            ['idea', 'decision', 'commitment'].includes(value)
                          )
                            setFrame(value as Frame);
                        }}
                      />
                    ))}
                  </View>
                  <Text style={s.note}>Display framework</Text>
                  <View style={s.actions}>
                    {frames.map(value => (
                      <Action
                        key={value}
                        title={`${frame === value ? '✓ ' : ''}${frameLabel(
                          value,
                        )}`}
                        onPress={() => setFrame(value)}
                      />
                    ))}
                  </View>
                  <Action
                    title="Save Correction"
                    onPress={() =>
                      attempt(() => {
                        if (
                          (kind === 'idea' && frame !== 'idea') ||
                          (kind === 'decision' && frame !== 'decision') ||
                          (kind === 'commitment' && frame !== 'commitment')
                        )
                          throw new Error(
                            'Choose the matching framework for this intention.',
                          );
                        useIntentStore
                          .getState()
                          .change(
                            selected.id,
                            selected.revision,
                            { title, summary, kind, frame },
                            'User corrected classification',
                          );
                        setEditing(false);
                      })
                    }
                  />
                </View>
              )}
              <View style={s.contentSection}>
                <Text style={s.smallTitle}>Source evidence</Text>
                <Text selectable style={s.body}>
                  “{selected.sourceSpan}”
                </Text>
                <Text style={s.note}>
                  {selectedCapture?.source.timeTrusted
                    ? 'Captured '
                    : 'Library time (recording time unverified) '}
                  {new Date(
                    selectedCapture?.source.capturedAt || selected.createdAt,
                  ).toLocaleString()}{' '}
                  · AI interpretation · You can correct this
                </Text>
              </View>
              {showHistory &&
                selected.history.map((entry, index) => (
                  <View key={index} style={s.history}>
                    <Text style={s.smallTitle}>{entry.reason}</Text>
                    <Text style={s.note}>
                      {entry.actor} · {new Date(entry.at).toLocaleString()}
                    </Text>
                    <Text selectable style={s.historyText}>
                      {historyPreview(entry.snapshot)}
                    </Text>
                  </View>
                ))}
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
    </View>
  );
}
function historyPreview(snapshot: string) {
  try {
    const item = JSON.parse(snapshot) as IntentItem;
    return `${item.title}\n${stateLabels[item.state] || item.state}\n${
      item.summary
    }${item.dueAt ? `\nTime: ${new Date(item.dueAt).toLocaleString()}` : ''}`;
  } catch {
    return 'Earlier version retained.';
  }
}
function Action({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={s.action}>
      <Text style={s.link}>{title}</Text>
    </Pressable>
  );
}
const s = StyleSheet.create({
  sectionTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: '#24344D',
    marginTop: 22,
    marginBottom: 12,
  },
  card: {
    borderRadius: 21,
    padding: 16,
    backgroundColor: '#F0F5FD',
    borderWidth: 1,
    borderColor: '#E4EBF7',
    marginBottom: 12,
  },
  ideaCard: { backgroundColor: '#F8F9FB', borderColor: '#EEF0F4' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 8 },
  eyebrow: { fontSize: 10, fontWeight: '600', color: '#6C85A8', flex: 1 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#4781D3' },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#24344D',
    lineHeight: 23,
    marginBottom: 8,
  },
  body: { fontSize: 13, color: '#718096', lineHeight: 22 },
  status: { fontSize: 10, color: '#5781AE', marginTop: 12 },
  date: { fontSize: 11, color: '#7C8BA2', lineHeight: 18 },
  overdue: { color: '#BA7250' },
  note: { fontSize: 11, color: '#929CAA', lineHeight: 18, marginBottom: 12 },
  capturePanel: { marginTop: 15, paddingBottom: 12 },
  unclassified: {
    borderBottomWidth: 1,
    borderBottomColor: '#EDEFF4',
    paddingVertical: 12,
  },
  smallTitle: {
    fontSize: 14,
    lineHeight: 22,
    color: '#30425D',
    fontWeight: '600',
    marginBottom: 8,
  },
  error: { fontSize: 12, lineHeight: 19, color: '#B17A5C', marginVertical: 8 },
  linkButton: { paddingVertical: 11 },
  link: { fontSize: 12, color: '#3873C5', fontWeight: '500' },
  modal: { flex: 1, backgroundColor: '#FFFFFF' },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingVertical: 10,
  },
  close: { padding: 9 },
  details: { padding: 22, paddingBottom: 45 },
  pageTitle: {
    color: '#202E46',
    fontSize: 26,
    lineHeight: 35,
    fontWeight: '700',
    marginBottom: 12,
  },
  notice: {
    borderRadius: 15,
    padding: 15,
    backgroundColor: '#F4F7FC',
    marginVertical: 16,
  },
  summary: {
    fontSize: 16,
    lineHeight: 26,
    color: '#4E617B',
    marginVertical: 20,
  },
  facts: { gap: 10 },
  fact: {
    paddingBottom: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F3F7',
  },
  factLabel: { fontSize: 10, color: '#9AA3B1', marginBottom: 4 },
  contentSection: { marginTop: 20 },
  email: {
    backgroundColor: '#FAF7F1',
    borderRadius: 16,
    padding: 16,
    marginVertical: 18,
  },
  input: {
    borderWidth: 1,
    borderColor: '#DFE6F0',
    borderRadius: 13,
    padding: 12,
    fontSize: 14,
    lineHeight: 22,
    color: '#344760',
    marginVertical: 10,
    minHeight: 45,
  },
  primary: {
    borderRadius: 24,
    padding: 14,
    alignItems: 'center',
    backgroundColor: '#263D5B',
    marginVertical: 10,
  },
  primaryText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 15 },
  action: {
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 18,
    backgroundColor: '#F1F5FA',
  },
  target: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#F4F7FA',
    marginBottom: 8,
  },
  history: {
    marginTop: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF1F5',
    paddingBottom: 12,
  },
  historyText: { fontSize: 10, lineHeight: 16, color: '#8E99A9' },
});
