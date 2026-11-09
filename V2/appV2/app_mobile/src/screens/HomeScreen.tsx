import { useMailNotificationStore } from '../services/mailNotifications';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  KeyboardAvoidingView,
  Platform,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '../components/Icon';
import { Sidebar, filterLabels } from '../components/Sidebar';
import type { ContentFilter } from '../components/Sidebar';
import { selectionHaptic } from '../services/haptics';
import type { RootStackParamList } from '../navigation/types';
import { useNotesStore } from '../notes/useNotesStore';
import { ringConnectionService } from '../ring/RingConnectionService';
import { useRingStore } from '../ring/store/useRingStore';
import { useRecordingStore } from '../ring/store/useRecordingStore';
import { colors } from '../theme/tokens';
import { recordingTitle, isAudioFilename } from '../ring/recordingTitle';
import { confirmDeleteEntry } from '../services/confirmDeleteEntry';
import { sameRecording } from '../ring/recordingIdentity';
import { AgentDashboard } from '../components/AgentDashboard';
import { RecordingPipelineNotice } from '../components/RecordingPipelineNotice';
import { recordingCardStatus } from '../services/recordingInsight';

export const connectionLabels = {
  idle: '未连接',
  disconnected: '已断开',
  scanning: '搜索中',
  connecting: '连接中',
  authenticating: '鉴权中',
  connected: '已连接',
  recording: '录音中',
  syncing: '同步中',
  failed: '连接异常',
};
type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;
export function HomeScreen({ navigation }: Props) {
  const mailUnread = useMailNotificationStore(state => state.unreadCount);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [filter, setFilter] = useState<ContentFilter>('all');
  const status = useRingStore(state => state.status);
  const syncProgress = useRingStore(state => state.syncProgress);
  const syncError = useRingStore(state => state.syncError);
  const notes = useNotesStore(state => state.notes);
  const files = useRecordingStore(state => state.files);
  useEffect(() => {
    ringConnectionService
      .reconnectLast()
      .catch(error => useRingStore.getState().setError(error.message));
  }, []);
  const cards = [
    ...notes
      .filter(
        (note, index) =>
          !note.recordingUri ||
          !notes
            .slice(0, index)
            .some(item => sameRecording(item.recordingUri, note.recordingUri)),
      )
      .map(note => {
        const file = files.find(item =>
          sameRecording(item.uri, note.recordingUri),
        );
        return {
          id: note.id,
          title:
            file && (isAudioFilename(note.title) || !note.title)
              ? recordingTitle(file)
              : note.title,
          text: note.text.trim() || file?.transcript || '',
          time: note.createdAt,
          uri: note.recordingUri,
          file,
        };
      }),
    ...files
      .filter(
        file => !notes.some(note => sameRecording(note.recordingUri, file.uri)),
      )
      .map(file => ({
        id: file.uri,
        title: recordingTitle(file),
        text:
          file.transcript ||
          `${
            file.source === 'phone' ? '手机录音已保存' : '戒指录音已同步'
          } · 本机识别`,
        time: file.timestamp,
        uri: file.uri,
        file,
      })),
  ].sort((a, b) => b.time - a.time);
  const counts = {
    all: cards.length,
    notes: cards.filter(card => !card.uri).length,
    recordings: cards.filter(card => !!card.uri).length,
  };
  const visibleCards = cards.filter(card =>
    filter === 'all' ? true : filter === 'notes' ? !card.uri : !!card.uri,
  );
  const online = ['connected', 'recording', 'syncing'].includes(status);
  return (
    <LinearGradient
      colors={
        filter === 'all'
          ? ['#FFFFFF', '#FFFFFF', '#FFFFFF']
          : ['#F3E9DE', '#F4F4F4', '#F4F4F4']
      }
      locations={[0, 0.55, 1]}
      style={styles.root}
    >
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        {filter === 'all' ? (
          <View style={styles.todayToolbar}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open sidebar"
              onPress={() => setSidebarOpen(true)}
            >
              <Text style={styles.todayBrand}>
                spur<Text style={styles.brandDot}>.</Text>
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`邮件通知，${mailUnread}封未读`}
              onPress={() => navigation.navigate('AgentMailbox')}
              style={styles.bell}
            >
              <Icon name="bell" size={23} />
              {mailUnread > 0 && (
                <Text style={styles.mailBadge}>
                  {mailUnread > 99 ? '99+' : mailUnread}
                </Text>
              )}
            </Pressable>
          </View>
        ) : (
          <View style={styles.toolbar}>
            <Pressable
              accessibilityLabel="打开侧边栏"
              accessibilityRole="button"
              style={styles.circle}
              onPress={() => {
                selectionHaptic();
                setSidebarOpen(true);
              }}
            >
              <Icon name="menu" />
            </Pressable>
            <Text style={styles.brand}>
              SPUR <Text style={styles.brandLight}>RING</Text>
            </Text>
            <Pressable
              accessibilityLabel={`戒指${connectionLabels[status]}`}
              style={styles.deviceButton}
              onPress={() => navigation.navigate('Device')}
            >
              <Icon name="ring" size={22} />
              <View style={[styles.dot, online && styles.online]} />
              <Text style={styles.deviceLabel}>{connectionLabels[status]}</Text>
            </Pressable>
          </View>
        )}
        {status === 'syncing' && (
          <View style={styles.syncHint} accessibilityLiveRegion="polite">
            <ActivityIndicator size="small" color="#7A896C" />
            <Text style={styles.syncText}>
              正在同步戒指录音 · {syncProgress}%
            </Text>
          </View>
        )}
        {!!syncError && status !== 'syncing' && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              status === 'connected' ? '重试戒指录音同步' : '查看戒指同步问题'
            }
            style={styles.syncHint}
            onPress={() => {
              if (status !== 'connected') {
                navigation.navigate('Device');
                return;
              }
              ringConnectionService
                .syncRecordings()
                .catch(error => Alert.alert('同步未完成', error.message));
            }}
          >
            <Text style={styles.syncError}>
              {syncError} · {status === 'connected' ? '点击重试' : '查看设备'} ↗
            </Text>
          </Pressable>
        )}
        <KeyboardAvoidingView
          style={styles.root}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {filter === 'all' ? (
            <AgentDashboard
              entries={cards}
              onUseFramework={initialText =>
                navigation.navigate('Chat', { initialText, autoSend: false })
              }
              onOpen={card =>
                navigation.navigate(
                  'Note',
                  card.uri ? { recordingUri: card.uri } : { id: card.id },
                )
              }
              onDelete={card => {
                selectionHaptic();
                confirmDeleteEntry({
                  file: card.file,
                  noteId: card.id,
                  title: card.title,
                });
              }}
              onRecord={() => navigation.navigate('Recorder')}
              onDevice={() => navigation.navigate('Device')}
              onSettings={() => navigation.navigate('Settings')}
              onOpenMailbox={messageId =>
                navigation.navigate('AgentMailbox', { messageId })
              }
            />
          ) : (
            <>
              <ScrollView
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.scroll}
              >
                {filter === 'recordings' && (
                  <RecordingPipelineNotice
                    onSettings={() => navigation.navigate('Settings')}
                  />
                )}
                <>
                  <View style={styles.headingRow}>
                    <Text style={styles.heading}>{filterLabels[filter]}</Text>
                    <Text style={styles.count}>
                      {visibleCards.length} 条记录
                    </Text>
                  </View>
                  {visibleCards.length > 0 && (
                    <Text style={styles.manageHint}>
                      留住值得的瞬间 · 长按卡片管理
                    </Text>
                  )}
                  {visibleCards.length ? (
                    <View style={styles.columns}>
                      {[0, 1].map(column => (
                        <View key={column} style={styles.column}>
                          {visibleCards
                            .filter((_, i) => i % 2 === column)
                            .map(card => (
                              <Pressable
                                key={card.id}
                                accessibilityRole="button"
                                accessibilityLabel={`查看 ${card.title}`}
                                accessibilityHint="轻点查看，长按删除"
                                style={({ pressed }) => [
                                  styles.card,
                                  pressed && styles.cardPressed,
                                ]}
                                delayLongPress={450}
                                onLongPress={() => {
                                  selectionHaptic();
                                  confirmDeleteEntry({
                                    file: card.file,
                                    noteId: card.id,
                                    title: card.title,
                                  });
                                }}
                                onPress={() =>
                                  navigation.navigate(
                                    'Note',
                                    card.uri
                                      ? { recordingUri: card.uri }
                                      : { id: card.id },
                                  )
                                }
                              >
                                <View style={styles.cardTop}>
                                  <Text style={styles.time}>
                                    {new Date(card.time).toLocaleString(
                                      'zh-CN',
                                      {
                                        month: 'numeric',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      },
                                    )}
                                  </Text>
                                  <Pressable
                                    accessibilityRole="button"
                                    accessibilityLabel={`删除 ${card.title}`}
                                    hitSlop={10}
                                    onPress={event => {
                                      event.stopPropagation();
                                      selectionHaptic();
                                      confirmDeleteEntry({
                                        file: card.file,
                                        noteId: card.id,
                                        title: card.title,
                                      });
                                    }}
                                  >
                                    <Icon
                                      name="trash"
                                      size={17}
                                      color="#92978D"
                                    />
                                  </Pressable>
                                </View>
                                <Text
                                  numberOfLines={3}
                                  style={styles.cardTitle}
                                >
                                  {card.title}
                                </Text>
                                <View style={styles.divider} />
                                <Text numberOfLines={8} style={styles.cardText}>
                                  {card.text ||
                                    (card.uri
                                      ? '文字尚未就绪，点击查看录音与识别状态'
                                      : '暂无文字')}
                                </Text>
                                {card.file?.aiReply && (
                                  <View style={styles.replyPreview}>
                                    <Text style={styles.replyLabel}>
                                      ✦ SPUR AI
                                    </Text>
                                    <Text
                                      numberOfLines={3}
                                      style={styles.replyText}
                                    >
                                      {card.file.aiReply.replace(/[#*`]/g, '')}
                                    </Text>
                                  </View>
                                )}
                                {card.uri && (
                                  <View style={styles.audioFooter}>
                                    <Icon
                                      name="wave"
                                      size={17}
                                      color="#829570"
                                    />
                                    <Text style={styles.audioFooterText}>
                                      {recordingCardStatus(card.file)}
                                    </Text>
                                  </View>
                                )}
                              </Pressable>
                            ))}
                        </View>
                      ))}
                    </View>
                  ) : (
                    <View style={styles.empty}>
                      <View style={styles.emptyIcon}>
                        <Icon name="note" size={42} color="#90998A" />
                      </View>
                      <Text style={styles.emptyTitle}>
                        {filter === 'notes'
                          ? '写下你的第一个想法'
                          : filter === 'recordings'
                          ? '收藏每一个有声瞬间'
                          : '让灵感有处安放'}
                      </Text>
                      <Text style={styles.emptyText}>
                        {filter === 'notes'
                          ? '用文字留住闪过的念头，\n把零散灵感慢慢积累成篇。'
                          : filter === 'recordings'
                          ? '连接戒指同步录音，或用手机开始录制。\n录音和转写内容都会在这里汇集。'
                          : '连接戒指同步录音，或记下第一个想法。\n所有记录都会在这里汇集。'}
                      </Text>
                      <Pressable
                        style={styles.connectLink}
                        onPress={() =>
                          navigation.navigate(
                            filter === 'notes' ? 'Note' : 'Device',
                          )
                        }
                      >
                        <Text style={styles.linkText}>
                          {filter === 'notes'
                            ? '新建一篇笔记 ↗'
                            : '连接我的录音戒指 ↗'}
                        </Text>
                      </Pressable>
                    </View>
                  )}
                </>
              </ScrollView>
              <View style={styles.composer}>
                <Pressable
                  accessibilityLabel="新建笔记"
                  style={styles.circle}
                  onPress={() => navigation.navigate('Note')}
                >
                  <Icon name="plus" />
                </Pressable>
                <Pressable
                  style={styles.prompt}
                  onPress={() => navigation.navigate('Chat')}
                >
                  <Text style={styles.placeholder}>你说，我做</Text>
                  <Text style={styles.spark}>✦</Text>
                </Pressable>
                <Pressable
                  accessibilityLabel="手机录音"
                  style={styles.circle}
                  onPress={() => navigation.navigate('Recorder')}
                >
                  <Icon name="mic" color="#FD613F" />
                </Pressable>
              </View>
            </>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
      <Sidebar
        visible={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        filter={filter}
        counts={counts}
        onFilter={setFilter}
        onNavigate={destination => navigation.navigate(destination)}
        deviceLabel={connectionLabels[status]}
        online={online}
      />
    </LinearGradient>
  );
}
const styles = StyleSheet.create({
  mailBadge: {
    position: 'absolute',
    right: 0,
    top: 0,
    fontSize: 10,
    color: '#fff',
    backgroundColor: '#71845C',
    borderRadius: 9,
    minWidth: 16,
    textAlign: 'center',
  },
  todayToolbar: {
    height: 53,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  todayBrand: {
    fontSize: 30,
    fontWeight: '800',
    color: '#111111',
    letterSpacing: -1.6,
  },
  brandDot: { color: '#2563EB' },
  bell: { padding: 8 },
  todayScroll: { paddingHorizontal: 20, paddingTop: 0 },
  todayComposer: {
    marginHorizontal: 16,
    marginTop: 7,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E6E8ED',
    padding: 5,
    shadowColor: '#182235',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
  },
  inputAction: { padding: 9 },
  agentInput: {
    flex: 1,
    minWidth: 0,
    fontSize: 12,
    color: '#111827',
    paddingVertical: 10,
  },
  syncHint: {
    marginHorizontal: 24,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#EDF1E7',
  },
  syncText: { fontSize: 12, color: '#7A896C' },
  syncError: { fontSize: 12, color: '#A46F53' },
  root: { flex: 1 },
  toolbar: {
    height: 74,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  circle: {
    width: 49,
    height: 49,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#D7D6D1',
    backgroundColor: '#FFFFFF99',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 2.5,
    color: colors.text,
  },
  brandLight: { fontWeight: '400', color: '#81867B' },
  deviceButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 60,
    height: 54,
  },
  deviceLabel: { fontSize: 10, color: '#777C72', marginTop: 3 },
  dot: {
    position: 'absolute',
    top: 7,
    right: 13,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#B9BCB7',
    borderColor: '#F5EFE7',
    borderWidth: 1,
  },
  online: { backgroundColor: '#4A9B6B' },
  scroll: { padding: 16, paddingTop: 13, paddingBottom: 24, flexGrow: 1 },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 5,
    marginBottom: 22,
  },
  heading: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -1,
    color: colors.text,
  },
  count: { fontSize: 11, color: '#9A9D96' },
  columns: { flexDirection: 'row', gap: 12 },
  column: { flex: 1, gap: 12 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 17,
    borderWidth: 1,
    borderColor: '#E9ECE3',
  },
  cardPressed: { backgroundColor: '#EDF0E7', transform: [{ scale: 0.98 }] },
  manageHint: {
    fontSize: 11,
    color: '#969F8A',
    marginTop: -10,
    marginBottom: 22,
    paddingHorizontal: 5,
  },
  audioFooter: {
    marginTop: 22,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  audioFooterText: { fontSize: 9, color: '#96A089', flexShrink: 1 },
  replyPreview: {
    padding: 10,
    marginTop: 16,
    borderRadius: 12,
    backgroundColor: '#F0F4E9',
  },
  replyLabel: {
    fontSize: 9,
    color: '#71865C',
    marginBottom: 7,
    fontWeight: '600',
  },
  replyText: { fontSize: 12, lineHeight: 19, color: '#7D8C6D' },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  time: { fontSize: 10, color: '#B0B2AD' },
  cardTitle: {
    fontSize: 17,
    lineHeight: 25,
    fontWeight: '600',
    color: colors.text,
    marginTop: 12,
  },
  divider: { height: 1, backgroundColor: '#F1F1EF', marginVertical: 12 },
  cardText: { fontSize: 14, lineHeight: 23, color: '#92958F' },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 60,
  },
  emptyIcon: { padding: 28, borderRadius: 48, backgroundColor: '#ECEDE7' },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#474D41',
    marginTop: 25,
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 24,
    color: '#999D93',
    textAlign: 'center',
    marginTop: 12,
  },
  connectLink: { marginTop: 26, padding: 12 },
  linkText: { fontSize: 14, color: '#606D51' },
  composer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 12,
    alignItems: 'center',
  },
  prompt: {
    height: 50,
    borderRadius: 28,
    borderColor: '#D7D6D1',
    borderWidth: 1,
    backgroundColor: '#FFFFFFAA',
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
  },
  placeholder: { color: '#969F8A', fontSize: 13, flexShrink: 1 },
  spark: { color: '#8A9780', fontSize: 22 },
});
