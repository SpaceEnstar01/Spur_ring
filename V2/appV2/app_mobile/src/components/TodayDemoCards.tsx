import React, { useState } from 'react';
import {
  Alert,
  ImageBackground,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { todayDemo as demo } from '../agent/todayDemo';
import { useTodayDemoState } from '../agent/todayState';
import { Icon } from './Icon';
import { PerformanceReport, ScriptReport } from './TodayReports';
import { fullDemoScript } from '../agent/demoReports';

type Detail = 'performance' | 'script' | 'email' | null;
export function TodayDemoCards({
  onUseFramework,
  renderCards,
}: {
  onUseFramework?: (text: string) => void;
  renderCards?: (cards: React.ReactNode[]) => React.ReactNode;
}) {
  const { width } = useWindowDimensions();
  const columnWidth = Math.max(90, width - 198);
  const [detail, setDetail] = useState<Detail>(null);
  const decision = useTodayDemoState(state => state.decision);
  const setDecision = useTodayDemoState(state => state.setDecision);
  function sendDemo() {
    Alert.alert(
      'Keep this reviewed draft?',
      'This saves the reviewed state only. No email will be sent and no email service will be contacted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Keep Draft',
          onPress: () => {
            setDecision('simulated');
            setDetail(null);
          },
        },
      ],
    );
  }
  const cards = [
    <DemoCard key="reference-0" colors={['#F1F6FF', '#F8FAFF']}>
      <CardLabel
        icon="analytics"
        color="#2563EB"
        text="Your agent has an update"
        time="Just now"
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open travel performance analysis"
        onPress={() => setDetail('performance')}
      >
        <View style={s.contentRow}>
          <View style={[s.copy, s.fixedCopy, { width: columnWidth }]}>
            <CardTitle>{demo.performance.title}</CardTitle>
          </View>
          <ImageBackground
            source={demo.performance.thumbnail}
            imageStyle={s.imageCorners}
            style={s.thumbnail}
            accessibilityLabel="Eiffel Tower at sunset"
          >
            <View style={s.photoShade}>
              <Text style={s.photoValue}>+62%</Text>
              <View style={s.bars}>
                {[12, 19, 17, 27, 32, 39].map((height, index) => (
                  <View key={index} style={[s.bar, { height }]} />
                ))}
              </View>
            </View>
          </ImageBackground>
        </View>
        <Text style={[s.description, s.fullDescription]}>
          {demo.performance.description}
        </Text>
        <View style={s.metrics}>
          {demo.performance.metrics.map(metric => (
            <View key={metric.label} style={s.metric}>
              <View style={s.metricHeading}>
                <Icon name={metric.icon} size={13} color="#657BA8" />
                <Text style={s.metricValue}>{metric.value}</Text>
              </View>
              <Text style={s.metricLabel}>{metric.label}</Text>
              <Text style={s.positive}>↑ {metric.change}</Text>
            </View>
          ))}
        </View>
      </Pressable>
    </DemoCard>,
    <DemoCard key="reference-1" colors={['#FFF1F4', '#FFF9FA']}>
      <CardLabel
        icon="note"
        color="#E64D7A"
        text="Your agent has analyzed"
        time="2 minutes ago"
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open script structure analysis"
        onPress={() => setDetail('script')}
      >
        <View style={s.contentRow}>
          <View style={[s.copy, s.fixedCopy, { width: columnWidth }]}>
            <CardTitle>{demo.script.title}</CardTitle>
          </View>
          <ImageBackground
            source={demo.script.thumbnail}
            imageStyle={s.imageCorners}
            style={s.thumbnail}
            accessibilityLabel="Santorini coastal scenery"
          >
            <View style={s.play}>
              <Icon name="play" size={19} color="#FFFFFF" />
            </View>
            <Text style={s.duration}>{demo.script.duration}</Text>
          </ImageBackground>
        </View>
        <Text style={[s.description, s.fullDescription]}>
          {demo.script.description}
        </Text>
      </Pressable>
      <View style={s.reference}>
        <Text style={s.referenceLabel}>Reference Example</Text>
        <View style={s.contactRow}>
          <ImageBackground
            source={demo.script.thumbnail}
            style={s.smallThumbnail}
            imageStyle={s.smallCorners}
          />
          <View style={s.copy}>
            <Text style={s.referenceTitle}>{demo.script.referenceTitle}</Text>
            <Text style={s.metadata}>{demo.script.metadata}</Text>
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => setDetail('script')}
          style={s.analysisButton}
        >
          <Text style={s.smallButtonText}>View Analysis →</Text>
        </Pressable>
      </View>
    </DemoCard>,
    <DemoCard key="reference-2" colors={['#FFF8EC', '#FFFCF7']}>
      <CardLabel
        icon="mail"
        color="#D78A16"
        text="Needs your decision"
        time={
          decision === 'pending'
            ? '1 pending'
            : decision === 'simulated'
            ? 'Reviewed'
            : 'Postponed'
        }
      />
      <Pressable accessibilityRole="button" onPress={() => setDetail('email')}>
        <CardTitle>{demo.decision.title}</CardTitle>
      </Pressable>
      <Text style={s.description}>{demo.decision.description}</Text>
      <View style={[s.contactRow, s.contact]}>
        <View style={s.avatar}>
          <Text style={s.avatarLetter}>J</Text>
        </View>
        <View style={s.copy}>
          <Text style={s.referenceTitle}>{demo.decision.contactName}</Text>
          <Text style={s.metadata}>{demo.decision.contactEmail}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => setDetail('email')}
          style={s.draftButton}
        >
          <Text style={s.smallButtonText}>View Email Draft</Text>
        </Pressable>
      </View>
      {decision === 'pending' ? (
        <View style={s.actions}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setDetail('email')}
            style={s.primary}
          >
            <Icon name="send" size={15} color="#FFFFFF" />
            <Text style={s.primaryText}>Review Email</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => setDecision('postponed')}
            style={s.secondary}
          >
            <Text style={s.smallButtonText}>Not Now</Text>
          </Pressable>
        </View>
      ) : (
        <View accessibilityLiveRegion="polite">
          <Text style={s.status}>
            {decision === 'simulated'
              ? 'Draft reviewed · No email was sent.'
              : 'Postponed · No email was sent.'}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => setDecision('pending')}
            style={s.reset}
          >
            <Text style={s.smallButtonText}>Review Again</Text>
          </Pressable>
        </View>
      )}
    </DemoCard>,
  ];
  return (
    <>
      {renderCards ? renderCards(cards) : cards}
      <Modal
        visible={detail !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setDetail(null)}
      >
        <SafeAreaView style={s.modalRoot}>
          <View style={s.modalToolbar}>
            <Text style={s.modalBadge}>SPUR</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close content detail"
              onPress={() => setDetail(null)}
              style={s.close}
            >
              <Icon name="close" />
            </Pressable>
          </View>
          <ScrollView
            key={detail || 'closed'}
            contentContainerStyle={s.modalContent}
          >
            <Text style={s.detailTitle}>
              {detail === 'performance'
                ? demo.performance.title
                : detail === 'script'
                ? demo.script.title
                : 'Review Email Draft'}
            </Text>
            <Text style={s.detailNote}>
              Reference content · Not linked to a connected account
            </Text>
            {detail === 'performance' && <PerformanceReport />}
            {detail === 'script' && (
              <>
                <ScriptReport />
                <Pressable
                  accessibilityRole="button"
                  style={s.primary}
                  onPress={() => {
                    setDetail(null);
                    onUseFramework?.(
                      `${demo.script.prompt}\n\nOriginal reference script (adapt observations to my actual experience):\n${fullDemoScript}`,
                    );
                  }}
                >
                  <Text style={s.primaryText}>Use This Framework</Text>
                  <Icon name="chevron" size={16} color="#FFFFFF" />
                </Pressable>
                <Text style={s.detailNote}>
                  Opens a new conversation for you to review and send.
                </Text>
              </>
            )}
            {detail === 'email' && (
              <>
                <DetailSection
                  title="To"
                  text={`${demo.decision.contactName} · ${demo.decision.contactEmail}`}
                />
                <DetailSection title="Subject" text={demo.decision.subject} />
                <DetailSection
                  title="Why this follow-up"
                  text="In this reference scenario, the delivery date is still unclear. A short, neutral message asks for an update without assuming Jack is late or assigning blame."
                />
                <Text selectable style={s.emailBody}>
                  {demo.decision.body}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  style={s.primary}
                  onPress={sendDemo}
                >
                  <Icon name="send" size={16} color="#FFFFFF" />
                  <Text style={s.primaryText}>Keep Reviewed Draft</Text>
                </Pressable>
                <Text style={s.detailNote}>
                  No email account is connected. Nothing will be sent.
                </Text>
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </>
  );
}
function DemoCard({
  colors,
  children,
}: {
  colors: string[];
  children: React.ReactNode;
}) {
  return (
    <View style={s.card}>
      <LinearGradient
        colors={colors}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {children}
    </View>
  );
}
function CardLabel({
  icon,
  color,
  text,
  time,
}: {
  icon: string;
  color: string;
  text: string;
  time: string;
}) {
  return (
    <View style={s.labelRow}>
      <Icon name={icon} color={color} size={15} />
      <Text style={[s.label, { color }]}>{text}</Text>
      <Text style={s.time}>{time}</Text>
    </View>
  );
}
function CardTitle({ children }: { children: React.ReactNode }) {
  return (
    <Text style={s.cardTitle}>
      {children} <Text style={s.chevron}>›</Text>
    </Text>
  );
}
function DetailSection({ title, text }: { title: string; text: string }) {
  return (
    <View style={s.detailSection}>
      <Text style={s.detailHeading}>{title}</Text>
      <Text selectable style={s.detailBody}>
        {text}
      </Text>
    </View>
  );
}
const s = StyleSheet.create({
  card: {
    padding: 16,
    overflow: 'hidden',
    borderRadius: 24,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#F1F2F5',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 13,
    flexWrap: 'wrap',
  },
  label: { fontSize: 11, fontWeight: '600', flexShrink: 1 },
  time: { fontSize: 10, color: '#777B83', marginLeft: 'auto' },
  contentRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  copy: { flex: 1, minWidth: 0 },
  fixedCopy: { flex: 0 },
  cardTitle: {
    color: '#111827',
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
    marginBottom: 7,
  },
  chevron: { color: '#858B96' },
  fullDescription: { marginTop: 12, alignSelf: 'stretch' },
  description: { color: '#68717F', fontSize: 12, lineHeight: 18 },
  thumbnail: {
    width: 112,
    height: 106,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  imageCorners: { borderRadius: 12 },
  photoShade: {
    backgroundColor: '#17264544',
    width: '100%',
    height: '100%',
    borderRadius: 12,
    padding: 9,
    justifyContent: 'space-between',
  },
  photoValue: {
    fontSize: 26,
    color: '#FFFFFF',
    fontWeight: '700',
    alignSelf: 'flex-end',
  },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  bar: { flex: 1, backgroundColor: '#C9DEFF', borderRadius: 2 },
  metrics: { flexDirection: 'row', gap: 6, marginTop: 15 },
  metric: {
    flex: 1,
    padding: 9,
    backgroundColor: '#FFFFFF99',
    borderRadius: 12,
  },
  metricHeading: {
    flexDirection: 'row',
    gap: 5,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  metricValue: { fontSize: 16, fontWeight: '700', color: '#182235' },
  metricLabel: { color: '#7B8190', fontSize: 9, lineHeight: 13, marginTop: 5 },
  positive: { color: '#20995C', fontSize: 10, marginTop: 4, fontWeight: '600' },
  play: {
    width: 34,
    height: 34,
    borderRadius: 18,
    backgroundColor: '#00000077',
    alignItems: 'center',
    justifyContent: 'center',
  },
  duration: {
    position: 'absolute',
    right: 5,
    bottom: 5,
    color: '#FFFFFF',
    backgroundColor: '#00000088',
    padding: 3,
    fontSize: 9,
    borderRadius: 3,
  },
  reference: {
    padding: 10,
    backgroundColor: '#FFFFFFAA',
    borderRadius: 14,
    marginTop: 13,
  },
  referenceLabel: { color: '#777B83', fontSize: 9, marginBottom: 8 },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  smallThumbnail: { width: 48, height: 34 },
  smallCorners: { borderRadius: 6 },
  referenceTitle: {
    fontSize: 11,
    color: '#202938',
    fontWeight: '600',
    lineHeight: 16,
  },
  metadata: { fontSize: 9, color: '#7B8190', lineHeight: 14 },
  analysisButton: {
    alignSelf: 'flex-end',
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: '#F7F5FA',
    borderRadius: 16,
    marginTop: 7,
  },
  smallButtonText: {
    fontSize: 11,
    color: '#28303F',
    fontWeight: '600',
    textAlign: 'center',
  },
  contact: {
    backgroundColor: '#FFFFFF99',
    borderRadius: 14,
    padding: 10,
    marginTop: 13,
    flexWrap: 'wrap',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#B2BCC9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarLetter: { color: '#FFFFFF', fontWeight: '600', fontSize: 15 },
  draftButton: {
    borderWidth: 1,
    borderColor: '#E1E3E8',
    borderRadius: 18,
    padding: 8,
    backgroundColor: '#FFFFFF',
  },
  actions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  primary: {
    flexDirection: 'row',
    gap: 7,
    backgroundColor: '#151515',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 1,
  },
  primaryText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
  secondary: {
    flex: 1,
    padding: 12,
    borderWidth: 1,
    borderColor: '#DDE0E5',
    borderRadius: 24,
    justifyContent: 'center',
  },
  status: { fontSize: 12, lineHeight: 19, color: '#54705B', marginTop: 14 },
  reset: { alignSelf: 'flex-start', paddingVertical: 12 },
  demoNote: { fontSize: 9, color: '#92959C', marginTop: 10 },
  modalRoot: { flex: 1, backgroundColor: '#FFFFFF' },
  modalToolbar: {
    paddingHorizontal: 24,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalBadge: { color: '#777B83', fontSize: 11, letterSpacing: 2 },
  close: { padding: 10 },
  modalContent: { padding: 24, paddingBottom: 40 },
  detailTitle: {
    fontSize: 27,
    lineHeight: 35,
    fontWeight: '700',
    color: '#111827',
  },
  detailNote: {
    fontSize: 12,
    color: '#838995',
    lineHeight: 19,
    marginVertical: 14,
  },
  detailSection: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F1F4',
  },
  detailHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: '#202938',
    marginBottom: 8,
  },
  detailBody: { fontSize: 14, lineHeight: 23, color: '#68717F' },
  emailBody: {
    fontSize: 15,
    color: '#394354',
    lineHeight: 25,
    marginVertical: 24,
  },
});
