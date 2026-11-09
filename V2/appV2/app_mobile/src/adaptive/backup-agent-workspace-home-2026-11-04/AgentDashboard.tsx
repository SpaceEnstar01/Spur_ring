import { WorkspaceExamples } from '../adaptive/WorkspaceExamples';
import { completedUpdates } from '../agent/todayState';
import { IntentUpdateCard } from './IntentUpdateCard';
import { legacyPresentation } from '../intent/legacyPresentation';
import { useIntentStore } from '../intent/store';
import { recordingSource } from '../intent/runtime';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { RingRecording } from '../ring/types';
import { PersonalAgentSection } from './RecordingReplyCard';
import { Icon } from './Icon';
import { IntentWorkspace } from './IntentWorkspace';
import { AgentAlarmPanel } from './AgentAlarmPanel';
import { useAlarmStore } from '../services/agentAlarms';

export type AgentEntry = {
  id: string;
  title: string;
  text: string;
  time: number;
  uri?: string;
  file?: RingRecording;
};
type Props = {
  entries: AgentEntry[];
  onOpen: (entry: AgentEntry) => void;
  onDelete: (entry: AgentEntry) => void;
  onRecord: () => void;
  onDevice: () => void;
  onSettings: () => void;
  onUseFramework?: (text: string) => void;
};
export function AgentDashboard(props: Props) {
  const hasSystemAlarms = useAlarmStore(state =>
    state.actions.some(
      action =>
        /闹钟/.test(action.transcript) ||
        ['scheduled', 'scheduling'].includes(action.state),
    ),
  );
  const captures = useIntentStore(state => state.captures);
  const previous = completedUpdates(props.entries).filter(entry => {
    if (!entry.file) return true;
    const capture = captures[recordingSource(entry.file).key];
    return (
      !capture ||
      capture.state !== 'done' ||
      capture.source.text !== entry.file.transcript?.trim()
    );
  });
  const working = props.entries.filter(
    entry =>
      entry.file?.aiReplyState === 'working' ||
      entry.file?.recognitionState === 'working',
  );
  const now = new Date();
  const greeting =
    now.getHours() < 12
      ? 'Good morning.'
      : now.getHours() < 18
      ? 'Good afternoon.'
      : 'Good evening.';
  return (
    <View>
      <View style={s.greeting}>
        <Text style={s.heading}>{greeting}</Text>
        <Text style={s.subtitle}>
          {now.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}{' '}
          · Agent Workspace
        </Text>
      </View>
      <IntentWorkspace entries={props.entries} onOpen={props.onOpen} />
      {previous.map(entry => (
        <IntentUpdateCard
          key={entry.id}
          item={legacyPresentation(entry)}
          onOpen={() => props.onOpen(entry)}
        />
      ))}
      {!props.entries.length && (
        <View style={s.entry}>
          <Text style={s.entryTitle}>从一段录音开始</Text>
          <Text style={s.body}>
            录音后自动整理想法、灵感与知识，提取待办；普通对话保留摘要。
          </Text>
        </View>
      )}
      {props.entries
        .filter(
          entry =>
            entry.file?.personalAgentState &&
            !captures[recordingSource(entry.file).key]?.items.some(
              item => item.execution === 'research',
            ),
        )
        .map(entry => (
          <View key={`execution:${entry.id}`} style={s.entry}>
            <Pressable
              accessibilityRole="button"
              onPress={() => props.onOpen(entry)}
            >
              <Text style={s.entryTitle}>{entry.title}</Text>
              <Text style={s.body}>来源录音 ↗</Text>
            </Pressable>
            <PersonalAgentSection file={entry.file!} />
          </View>
        ))}
      {hasSystemAlarms && <AgentAlarmPanel />}
      {!!working.length && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>In progress</Text>
          {working.map(entry => (
            <Pressable
              key={entry.id}
              accessibilityRole="button"
              onPress={() => props.onOpen(entry)}
              style={s.entry}
            >
              <Text style={s.entryTitle}>{entry.title}</Text>
              <Text style={s.body}>
                {entry.file?.aiReplyState === 'working'
                  ? 'Preparing your analysis…'
                  : 'Transcribing on your iPhone…'}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
      <WorkspaceExamples />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Automatic analysis settings"
        onPress={props.onSettings}
        style={s.settings}
      >
        <Icon name="settings" size={15} color="#777B83" />
        <Text style={s.body}>Automatic analysis settings</Text>
        <Icon name="chevron" size={14} color="#777B83" />
      </Pressable>
    </View>
  );
}
const s = StyleSheet.create({
  libraryHeading: { marginTop: 22, marginBottom: 15 },
  tabs: { flexDirection: 'row', gap: 28, marginBottom: 22 },
  tab: { paddingVertical: 12 },
  tabText: { color: '#9498A0', fontSize: 13 },
  active: { color: '#111827', fontWeight: '600' },
  underline: {
    position: 'absolute',
    bottom: 2,
    left: 0,
    width: 22,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#111827',
  },
  greeting: { marginBottom: 20 },
  heading: {
    fontSize: 27,
    fontWeight: '700',
    color: '#141D32',
    letterSpacing: -0.8,
    lineHeight: 36,
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 19,
    color: '#858992',
    marginTop: 5,
    marginBottom: 8,
  },
  entry: {
    padding: 16,
    marginBottom: 14,
    borderRadius: 22,
    backgroundColor: '#F8FAFD',
    borderWidth: 1,
    borderColor: '#EDF0F6',
  },
  result: { backgroundColor: '#F1F6FF' },
  entryTop: {
    flexDirection: 'row',
    gap: 7,
    alignItems: 'center',
    marginBottom: 12,
  },
  entryLabel: { fontSize: 11, fontWeight: '600', color: '#2563EB', flex: 1 },
  date: { fontSize: 10, color: '#858992' },
  entryTitle: {
    fontSize: 16,
    lineHeight: 23,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  body: { fontSize: 13, color: '#777B83', lineHeight: 21 },
  link: { color: '#2563EB', fontSize: 12, fontWeight: '600', marginTop: 12 },
  analyze: { paddingBottom: 9, alignSelf: 'flex-start' },
  section: { marginTop: 16 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#202938',
    marginBottom: 14,
  },
  settings: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 20,
    justifyContent: 'center',
  },
  empty: {
    padding: 22,
    gap: 12,
    borderRadius: 22,
    backgroundColor: '#F8FAFD',
    marginTop: 16,
  },
});
