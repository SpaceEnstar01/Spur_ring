import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, DeviceEventEmitter, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Audio, type AVPlaybackStatus } from 'expo-av';
import { Heart, LoaderCircle, Mic2, Pause, Play, Sparkles, Trash2 } from 'lucide-react-native';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/types/navigation';
import { AgentSkillPanel } from '@/components/AgentSkillPanel';
import { AppScreen } from '@/components/AppScreen';
import { HomeLeadingActions } from '@/components/HomeLeadingActions';
import { LoadingState } from '@/components/LoadingState';
import { ALARM_CARD_EVENT, armPhoneAlarm, cancelPhoneAlarm, rearmFutureAlarms } from '@/services/alarmScheduler';
import { formatAlarmCountdown } from '@/services/alarmIntent';
import { deleteAgentCard, processAgentCard, syncLocalAgentCards, toggleAgentCardFavorite, type LocalAgentCard } from '@/services/localAgentCards';
import {
  cancelOfficeJob,
  inferOfficeKind,
  OFFICE_JOB_EVENT,
  openCardOffice,
  startOfficeJob
} from '@/services/officeJob';
import { AUTO_SYNC_COMPLETE_EVENT } from '@/services/autoSyncRecordings';
import {
  DEMO_BADGE_COLOR,
  DEMO_BADGE_LABEL,
  ensureDemoContent,
  isDemoAudioName
} from '@/services/demoContent';
import { preparePlayback } from '@/services/localAudioLibrary';
import { colors } from '@/theme/colors';
import { t } from '@/locales';

export function AgentFlowScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [cards, setCards] = useState<LocalAgentCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [batch, setBatch] = useState('');
  const [selected, setSelected] = useState<LocalAgentCard | null>(null);
  const [playingUri, setPlayingUri] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);

  const refresh = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      await ensureDemoContent().catch(() => undefined);
      const next = await syncLocalAgentCards();
      setCards(next);
      rearmFutureAlarms(next);
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, []);
  useFocusEffect(useCallback(() => {
    void refresh({ silent: cards.length > 0 });
    return () => { void stopPlayback(); };
    // Intentionally only depend on refresh — silent uses latest cards.length via closure on focus.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh]));

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(AUTO_SYNC_COMPLETE_EVENT, () => {
      void refresh({ silent: true });
    });
    const officeSub = DeviceEventEmitter.addListener(OFFICE_JOB_EVENT, (updated: LocalAgentCard) => {
      setCards((current) => current.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)));
      setSelected((current) => (current?.id === updated.id ? { ...current, ...updated } : current));
    });
    const alarmSub = DeviceEventEmitter.addListener(ALARM_CARD_EVENT, (updated: LocalAgentCard) => {
      setCards((current) => current.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)));
      setSelected((current) => (current?.id === updated.id ? { ...current, ...updated } : current));
    });
    return () => {
      sub.remove();
      officeSub.remove();
      alarmSub.remove();
    };
  }, [refresh]);

  async function togglePlayback(card: LocalAgentCard) {
    try {
      await preparePlayback();
      if (soundRef.current && playingUri === card.fileUri) {
        const status = await soundRef.current.getStatusAsync();
        if (status.isLoaded && status.isPlaying) await soundRef.current.pauseAsync();
        else await soundRef.current.playAsync();
        return;
      }
      await stopPlayback();
      const created = await Audio.Sound.createAsync({ uri: card.fileUri }, { shouldPlay: true }, onPlaybackStatus);
      soundRef.current = created.sound;
      setPlayingUri(card.fileUri);
    } catch (error) {
      Alert.alert(t.agentFeed.title, error instanceof Error ? error.message : String(error));
    }
  }

  function onPlaybackStatus(status: AVPlaybackStatus) {
    if (!status.isLoaded) return;
    setIsPlaying(status.isPlaying);
    if (status.didJustFinish) { setPlayingUri(null); setIsPlaying(false); }
  }

  async function stopPlayback() {
    const sound = soundRef.current;
    soundRef.current = null;
    setPlayingUri(null);
    setIsPlaying(false);
    if (sound) await sound.unloadAsync().catch(() => undefined);
  }

  const columns = useMemo(() => ({
    left: cards.filter((_, index) => index % 2 === 0),
    right: cards.filter((_, index) => index % 2 === 1)
  }), [cards]);

  async function processOne(card: LocalAgentCard) {
    if (card.status === 'processing') return;
    setCards((current) => current.map((item) => item.id === card.id ? { ...item, status: 'processing' } : item));
    try {
      const updated = await processAgentCard(card);
      setCards((current) => current.map((item) => item.id === card.id ? updated : item));
      if (updated.alarm?.status === 'armed') {
        armPhoneAlarm(updated);
      }
      try {
        const kind = inferOfficeKind(updated.transcript || '');
        if (kind && updated.category !== 'alarm' && updated.processingKind !== 'recording_summary') {
          void startOfficeJob(
            updated,
            kind,
            [updated.transcript, updated.output].filter(Boolean).join('\n\n')
          );
        }
      } catch {
        // Office must not mark audio Process as failed.
      }
    } catch { await refresh(); }
  }

  async function processAll() {
    const queue = cards.filter((card) => card.status === 'pending' || card.status === 'failed');
    if (batch || queue.length === 0) return;
    for (let index = 0; index < queue.length; index += 1) {
      setBatch(`${index + 1}/${queue.length}`);
      await processOne(queue[index]);
    }
    setBatch('');
    await refresh();
  }

  async function favorite(card: LocalAgentCard) {
    const updated = await toggleAgentCardFavorite(card);
    setCards((current) => current.map((item) => item.id === card.id ? updated : item));
  }

  function confirmDelete(card: LocalAgentCard) {
    Alert.alert(t.agentFeed.deleteTitle, t.agentFeed.deleteMessage, [
      { text: t.common.cancel, style: 'cancel' },
      { text: t.common.delete, style: 'destructive', onPress: async () => {
        if (playingUri === card.fileUri) await stopPlayback();
        cancelPhoneAlarm(card.id);
        await deleteAgentCard(card);
        await refresh();
      } }
    ]);
  }

  const pending = cards.some((card) => card.status === 'pending' || card.status === 'failed');

  function onVoiceApplied(updated: LocalAgentCard) {
    setCards((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    setSelected(updated);
  }

  if (selected) {
    return (
      <View style={styles.flex}>
        <AgentDetail
          card={selected}
          onBack={() => setSelected(null)}
          onCancel={() => void cancelOfficeJob(selected.id)}
          onRetry={() => {
            const kind = selected.office?.kind || inferOfficeKind(selected.transcript || selected.output || '') || 'pdf';
            const prompt = selected.office?.prompt || [selected.output, selected.transcript].filter(Boolean).join('\n\n');
            void startOfficeJob(selected, kind, prompt || t.office.promptPlaceholder);
          }}
          onOpen={() => void openCardOffice(selected).catch((error) => {
            Alert.alert(t.agentFeed.title, error instanceof Error ? error.message : String(error));
          })}
        />
        <AgentSkillPanel card={selected} onApplied={onVoiceApplied} />
      </View>
    );
  }

  return (
    <AppScreen tone="plain" bottomInset={96}>
      <View style={styles.deviceEntry}><HomeLeadingActions /></View>
      <View style={styles.header}>
        <View style={styles.flex}><Text style={styles.eyebrow}>{t.agentFeed.eyebrow}</Text><Text style={styles.title}>{t.agentFeed.title}</Text><Text style={styles.subtitle}>{t.agentFeed.subtitle}</Text></View>
        <Pressable style={[styles.allButton, (!pending || !!batch) && styles.disabled]} disabled={!pending || !!batch} onPress={() => void processAll()}>
          {batch ? <LoaderCircle color="#fff" size={15} /> : <Sparkles color="#fff" size={15} />}
          <Text style={styles.allText}>{batch || t.agentFeed.processAll}</Text>
        </Pressable>
      </View>
      {!loading && cards.some((card) => isDemoAudioName(card.fileName)) ? (
        <View style={styles.sampleBanner}>
          <Text style={styles.sampleBannerText}>{t.agentFeed.sampleHint}</Text>
        </View>
      ) : null}
      {loading ? <LoadingState /> : cards.length === 0 ? (
        <View style={styles.empty}><Mic2 color={colors.text} size={30} /><Text style={styles.cardTitle}>{t.agentFeed.emptyTitle}</Text><Text style={styles.body}>{t.agentFeed.emptyText}</Text></View>
      ) : (
        <View style={styles.waterfall}>
          <View style={styles.column}>{columns.left.map((card) => <Card key={card.id} card={card} playing={playingUri === card.fileUri && isPlaying} onPlay={() => void togglePlayback(card)} onOpen={() => {
              if (card.processingKind === 'recording_summary' && card.status === 'completed') {
                navigation.navigate('RecordingSummary', { id: card.id });
              } else setSelected(card);
            }} onProcess={() => void processOne(card)} onFavorite={() => void favorite(card)} onDelete={() => confirmDelete(card)} />)}</View>
          <View style={[styles.column, styles.right]}>{columns.right.map((card) => <Card key={card.id} card={card} playing={playingUri === card.fileUri && isPlaying} onPlay={() => void togglePlayback(card)} onOpen={() => {
              if (card.processingKind === 'recording_summary' && card.status === 'completed') {
                navigation.navigate('RecordingSummary', { id: card.id });
              } else setSelected(card);
            }} onProcess={() => void processOne(card)} onFavorite={() => void favorite(card)} onDelete={() => confirmDelete(card)} />)}</View>
        </View>
      )}
    </AppScreen>
  );
}

function Card({ card, playing, onPlay, onOpen, onProcess, onFavorite, onDelete }: { card: LocalAgentCard; playing: boolean; onPlay: () => void; onOpen: () => void; onProcess: () => void; onFavorite: () => void; onDelete: () => void }) {
  const canProcess = card.status === 'pending' || card.status === 'failed';
  const isDemo = isDemoAudioName(card.fileName);
  return <View style={styles.card}>
    <Pressable onPress={onOpen}>
      <View style={styles.categoryRow}>
        <Text style={styles.category}>{categoryLabel(card.category)}</Text>
        {isDemo ? <Text style={styles.demoBadge}>{DEMO_BADGE_LABEL}</Text> : null}
      </View>
      <Text style={styles.cardTitle}>{card.title}</Text>
      {card.imageUrl ? <Image source={{ uri: card.imageUrl }} style={styles.cardImage} /> : null}
      {card.alarm ? <Text style={styles.officeBadge}>{t.agentFeed.alarm.badge}</Text> : null}
      {card.office?.status === 'ready' ? <Text style={styles.officeBadge}>{card.office.kind === 'pptx' ? 'PPT' : 'PDF'}</Text> : null}
      {card.office?.status === 'generating' ? <Text style={styles.officeBadge}>{t.agentFeed.doc.generatingBadge}</Text> : null}
      <Text style={styles.body} numberOfLines={4}>{card.summary || statusText(card.status)}</Text>
      <Text style={styles.meta}>{duration(card.durationMs)}</Text>
    </Pressable>
    {(canProcess || card.status === 'processing') && <Pressable style={[styles.process, card.status === 'processing' && styles.disabled]} disabled={card.status === 'processing'} onPress={onProcess}>{card.status === 'processing' ? <LoaderCircle color="#fff" size={14} /> : <Sparkles color="#fff" size={14} />}<Text style={styles.processText}>{card.status === 'processing' ? t.agentFeed.processing : t.agentFeed.process}</Text></Pressable>}
    <View style={styles.actions}><Pressable style={styles.playButton} onPress={onPlay}>{playing ? <Pause color="#fff" fill="#fff" size={14} /> : <Play color="#fff" fill="#fff" size={14} />}</Pressable><Pressable onPress={onFavorite}><Heart color={card.favorite ? colors.text : colors.textTertiary} fill={card.favorite ? colors.text : 'transparent'} size={17} /></Pressable><Pressable onPress={onDelete}><Trash2 color={colors.danger} size={17} /></Pressable></View>
  </View>;
}

function AgentDetail({
  card,
  onBack,
  onCancel,
  onRetry,
  onOpen
}: {
  card: LocalAgentCard;
  onBack: () => void;
  onCancel: () => void;
  onRetry: () => void;
  onOpen: () => void;
}) {
  const isDemo = isDemoAudioName(card.fileName);
  const office = card.office;
  const kindLabel = office?.kind === 'pptx' ? 'PPT' : 'PDF';
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!card.alarm || card.alarm.status !== 'armed') return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [card.alarm?.status, card.alarm?.fireAt]);

  const alarm = card.alarm;
  const remainLabel =
    alarm?.status === 'armed' ? formatAlarmCountdown(alarm.fireAt, now) : null;

  return <AppScreen tone="plain" bottomInset={36}>
    <Pressable style={styles.back} onPress={onBack}><Text style={styles.backText}>‹ {t.agentFeed.back}</Text></Pressable>
    <View style={styles.detailHero}>
      <View style={styles.categoryRow}>
        <Text style={styles.category}>{categoryLabel(card.category)}</Text>
        {isDemo ? <Text style={styles.demoBadge}>{DEMO_BADGE_LABEL}</Text> : null}
      </View>
      <Text style={styles.detailTitle}>{card.title}</Text>
      <Text style={styles.meta}>{duration(card.durationMs)} · {new Date(card.modifiedAt).toLocaleString()}</Text>
    </View>
    {alarm ? (
      <View style={styles.detailSection}>
        <Text style={styles.detailHeading}>{t.agentFeed.alarm.taskTitle}</Text>
        <Text style={styles.alarmCountdown}>
          {alarm.status === 'armed'
            ? remainLabel
            : alarm.status === 'fired'
              ? t.agentFeed.alarm.fired
              : alarm.status === 'failed'
                ? t.agentFeed.alarm.failed
                : t.agentFeed.alarm.missed}
        </Text>
        <Text style={styles.detailText}>
          {t.agentFeed.alarm.target
            .replace('{label}', alarm.label)
            .replace('{time}', new Date(alarm.fireAt).toLocaleTimeString())
            .replace('{times}', String(alarm.buzzTimes))}
        </Text>
        {alarm.error ? <Text style={[styles.detailText, { color: colors.danger }]}>{alarm.error}</Text> : null}
        <Text style={styles.meta}>{t.agentFeed.alarm.phoneHint}</Text>
      </View>
    ) : null}
    <View style={styles.detailSection}>
      <Text style={styles.detailHeading}>{t.agentFeed.aiResult}</Text>
      {card.imageUrl ? <Image source={{ uri: card.imageUrl }} style={styles.detailImage} resizeMode="contain" /> : null}
      {card.output ? (
        <Text style={[styles.detailText, card.imageUrl ? styles.detailTextAfterImage : null]}>{clean(card.output)}</Text>
      ) : card.imageUrl ? null : (
        <Text style={styles.detailText}>{statusText(card.status)}</Text>
      )}
    </View>
    {card.transcript && <View style={styles.detailSection}><Text style={styles.detailHeading}>{t.agentFeed.transcript}</Text><Text style={styles.detailText}>{card.transcript}</Text></View>}
    {office ? (
      <View style={styles.detailSection}>
        <Text style={styles.detailHeading}>{t.agentFeed.doc.title}</Text>
        {(office.trajectory ?? []).map((line, index) => (
          <Text key={`${line}-${index}`} style={styles.traceLine}>· {line}</Text>
        ))}
        {office.status === 'generating' ? (
          <View style={styles.docActions}>
            <View style={[styles.docPrimary, styles.disabled]}>
              <LoaderCircle color="#fff" size={14} />
              <Text style={styles.processText}>{kindLabel === 'PPT' ? t.agentFeed.doc.generatingPpt : t.agentFeed.doc.generatingPdf}</Text>
            </View>
            <Pressable style={styles.docCancel} onPress={onCancel}>
              <Text style={styles.docCancelText}>{t.agentFeed.doc.cancel}</Text>
            </Pressable>
          </View>
        ) : null}
        {office.status === 'ready' && office.fileName ? (
          <>
            <Text style={styles.detailText} selectable>{office.fileName}</Text>
            <Pressable style={[styles.docPrimary, { marginTop: 14 }]} onPress={onOpen}>
              <Text style={styles.processText}>{t.office.openLocal}</Text>
            </Pressable>
          </>
        ) : null}
        {office.status === 'failed' || office.status === 'cancelled' ? (
          <>
            {office.error ? <Text style={styles.detailText}>{office.error}</Text> : null}
            <Pressable style={[styles.docPrimary, { marginTop: 14 }]} onPress={onRetry}>
              <Text style={styles.processText}>{t.agentFeed.doc.retry}</Text>
            </Pressable>
          </>
        ) : null}
      </View>
    ) : null}
  </AppScreen>;
}

function categoryLabel(category: LocalAgentCard['category']) {
  if (category === 'alarm') return t.agentFeed.category.alarm;
  if (category === 'idea') return t.agentFeed.category.idea;
  if (category === 'report') return t.agentFeed.category.report;
  if (category === 'action') return t.agentFeed.category.action;
  return t.agentFeed.category.note;
}

function statusText(status: LocalAgentCard['status']) { return status === 'failed' ? t.agentFeed.failed : status === 'processing' ? t.agentFeed.processing : t.agentFeed.pending; }
function duration(ms: number) {
  const seconds = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
function clean(value: string) { return value.replace(/^\s*#{1,6}\s*/gm, '').replace(/[*_`]/g, '').replace(/^\s*[-+]\s+/gm, '• ').trim(); }

const styles = StyleSheet.create({
  flex: { flex: 1 }, deviceEntry: { alignItems: 'flex-start', marginBottom: 12 }, header: { flexDirection: 'row', gap: 10, marginTop: 18, marginBottom: 18 }, eyebrow: { color: colors.textSecondary, fontSize: 10, fontWeight: '900' }, title: { color: colors.text, fontSize: 26, fontWeight: '900', marginTop: 3 }, subtitle: { color: colors.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 5 },
  allButton: { alignSelf: 'flex-start', padding: 10, borderRadius: 12, backgroundColor: colors.text, flexDirection: 'row', gap: 5 }, allText: { color: '#fff', fontSize: 10, fontWeight: '900' }, disabled: { opacity: 0.5 },
  sampleBanner: { padding: 12, borderRadius: 14, backgroundColor: '#f5f7f9', borderWidth: 1, borderColor: colors.border, marginBottom: 12 },
  sampleBannerText: { color: colors.textSecondary, fontSize: 11, lineHeight: 17 },
  waterfall: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 }, column: { flex: 1, gap: 10 }, right: { paddingTop: 22 }, card: { padding: 13, borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }, categoryRow: { flexDirection: 'row', alignItems: 'center', gap: 8 }, category: { color: colors.textSecondary, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' }, demoBadge: { color: '#fff', backgroundColor: DEMO_BADGE_COLOR, overflow: 'hidden', fontSize: 9, fontWeight: '900', letterSpacing: 0.4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 }, cardTitle: { color: colors.text, fontSize: 15, lineHeight: 20, fontWeight: '900', marginTop: 7 }, cardImage: { width: '100%', aspectRatio: 1, borderRadius: 12, marginTop: 10, backgroundColor: colors.border }, body: { color: colors.textSecondary, fontSize: 11, lineHeight: 17, marginTop: 8 }, meta: { color: colors.textTertiary, fontSize: 9, marginTop: 9 },
  process: { marginTop: 10, minHeight: 34, borderRadius: 10, backgroundColor: colors.text, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 }, processText: { color: '#fff', fontSize: 10, fontWeight: '900' }, actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 15, marginTop: 11 }, playButton: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.text, alignItems: 'center', justifyContent: 'center', marginRight: 'auto' }, empty: { alignItems: 'center', padding: 28, borderRadius: 22, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  back: { alignSelf: 'flex-start', paddingVertical: 10 }, backText: { color: colors.text, fontWeight: '900' }, detailHero: { padding: 20, borderRadius: 22, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }, detailTitle: { color: colors.text, fontSize: 25, lineHeight: 32, fontWeight: '900', marginTop: 8 }, detailSection: { marginTop: 14, padding: 18, borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }, detailHeading: { color: colors.text, fontSize: 18, fontWeight: '900', marginBottom: 12 }, detailImage: { width: '100%', aspectRatio: 1, borderRadius: 14, backgroundColor: colors.border }, detailTextAfterImage: { marginTop: 12 }, detailText: { color: colors.text, fontSize: 14, lineHeight: 23 },
  alarmCountdown: { color: colors.text, fontSize: 42, fontWeight: '900', letterSpacing: 1, marginBottom: 10 },
  traceLine: { color: colors.textSecondary, fontSize: 13, lineHeight: 20, marginBottom: 4 },
  officeBadge: { marginTop: 8, alignSelf: 'flex-start', overflow: 'hidden', color: '#fff', backgroundColor: colors.text, fontSize: 9, fontWeight: '900', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  docActions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 },
  docPrimary: { flex: 1, minHeight: 40, borderRadius: 12, backgroundColor: colors.text, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  docCancel: { minHeight: 40, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  docCancelText: { color: colors.text, fontSize: 12, fontWeight: '800' }
});
