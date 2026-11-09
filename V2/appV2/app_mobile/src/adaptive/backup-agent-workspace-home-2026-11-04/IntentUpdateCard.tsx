import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { IntentItem } from '../intent/model';
import { stateLabels } from '../intent/model';
import type { CaptureMetric } from '../intent/presentation';
import { cardTheme, presentationFor } from '../intent/presentation';
import { IntentArtwork } from './IntentArtwork';
import { Icon } from './Icon';
import { AgentConversation } from './AgentConversation';
import { interactionFor } from '../intent/interaction';
type Props = {
  item: IntentItem;
  onOpen: (item: IntentItem) => void;
  onRespond?: (item: IntentItem, text: string) => void;
  onPause?: (item: IntentItem) => void;
};
export function IntentUpdateCard({ item, onOpen, onRespond, onPause }: Props) {
  const type = presentationFor(item),
    theme = cardTheme[type];
  const heading =
    type === 'decision' && item.state === 'needs_clarification'
      ? 'A direction to confirm'
      : item.kind === 'correction'
      ? 'Your direction has changed'
      : item.kind === 'progress'
      ? 'Your agent is tracking progress'
      : theme.label;
  const action =
    item.kind === 'correction'
      ? 'Review Change'
      : item.kind === 'progress'
      ? 'Confirm Progress'
      : theme.action;
  const deliveryPerson =
    item.direction === 'other_owes'
      ? item.actor === 'user'
        ? 'You'
        : item.actor
      : item.counterparty;
  const overdue =
    !!item.dueAt &&
    item.dueAt < Date.now() &&
    !['completed', 'cancelled', 'superseded', 'paused'].includes(item.state);
  const outline = item.sections
    .filter(section => section.heading.trim())
    .slice(0, 3);
  const glasses = /眼镜|glasses/i.test(item.sourceSpan + item.title);
  if (interactionFor(item) !== 'delivery')
    return (
      <AgentConversation
        item={item}
        onOpen={onOpen}
        onRespond={onRespond}
        onPause={onPause}
      />
    );
  return (
    <View
      style={[
        s.card,
        { backgroundColor: theme.background },
        type === 'commitment' && s.commitmentWidth,
      ]}
      testID={`intent-template-${type}`}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Intent ${item.title}`}
        onPress={() => onOpen(item)}
      >
        <View style={s.header}>
          <Icon name={theme.icon} size={15} color={theme.accent} />
          <Text style={[s.label, { color: theme.accent }]}>{heading}</Text>
          {!item.read && (
            <View style={[s.unread, { backgroundColor: theme.accent }]} />
          )}
          <Text style={s.time}>
            {new Date(item.updatedAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            })}
          </Text>
        </View>
        {type === 'idea' ? (
          <>
            <Text style={[s.quote, { color: theme.accent }]}>“</Text>
            <Text style={s.title}>{item.title}</Text>
            <Text style={s.description} numberOfLines={3}>
              {item.summary}
            </Text>
            <Text style={s.meta}>Saved to your ideas · No reminder</Text>
          </>
        ) : type === 'reminder' ? (
          <View style={s.reminderRow}>
            <View style={s.dateTile}>
              <Text style={[s.month, { color: theme.accent }]}>
                {item.dueAt
                  ? new Date(item.dueAt)
                      .toLocaleDateString('en-US', { month: 'short' })
                      .toUpperCase()
                  : 'WHEN'}
              </Text>
              <Text style={[s.day, { color: theme.accent }]}>
                {item.dueAt ? new Date(item.dueAt).getDate() : '—'}
              </Text>
              <Text style={s.small}>
                {item.dueAt
                  ? new Date(item.dueAt).toLocaleDateString('en-US', {
                      weekday: 'short',
                    })
                  : 'Confirm time'}
              </Text>
            </View>
            <View style={s.flex}>
              <Text style={s.title}>{item.title}</Text>
              <Text style={s.description} numberOfLines={2}>
                {item.summary}
              </Text>
              <Text style={[s.clock, { color: theme.accent }]}>
                {item.dueAt
                  ? new Date(item.dueAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : item.dateText || 'Time not confirmed'}
              </Text>
            </View>
          </View>
        ) : (
          <>
            <View style={s.titleRow}>
              <View style={s.flex}>
                <Text style={s.title}>{item.title}</Text>
                {['report', 'script', 'analytics'].includes(type) && (
                  <Text style={s.meta}>
                    {type === 'report'
                      ? 'A report built around your question'
                      : type === 'script'
                      ? 'Story structure · Full draft · Production'
                      : 'Evidence · Comparisons · Next steps'}
                  </Text>
                )}
              </View>
              {['report', 'script', 'analytics'].includes(type) && (
                <IntentArtwork
                  type={type}
                  color={theme.accent}
                  glasses={glasses}
                />
              )}
            </View>
            <Text style={s.description} numberOfLines={3}>
              {item.summary}
            </Text>
            {type === 'decision' && (
              <View style={s.direction}>
                <View style={[s.seal, { backgroundColor: theme.accent }]}>
                  <Icon name="check" size={19} color="#FFFFFF" />
                </View>
                <View style={s.flex}>
                  <Text style={s.kicker}>
                    {['superseded', 'cancelled'].includes(item.state)
                      ? 'PREVIOUS DIRECTION'
                      : 'CURRENT DIRECTION'}
                  </Text>
                  <Text style={s.featureText} numberOfLines={2}>
                    {item.replacement || item.deliverable || item.title}
                  </Text>
                </View>
                <Icon name="arrow" color={theme.accent} size={18} />
              </View>
            )}
            {type === 'commitment' && (
              <>
                <View style={s.personRow}>
                  <View style={[s.avatar, { backgroundColor: theme.accent }]}>
                    <Text style={s.avatarText}>
                      {(deliveryPerson || '?').slice(0, 1).toUpperCase()}
                    </Text>
                  </View>
                  <View style={s.flex}>
                    <Text style={s.kicker}>
                      {item.direction === 'other_owes'
                        ? 'WAITING ON'
                        : item.direction === 'user_owes'
                        ? 'DELIVER TO'
                        : 'DELIVERY WITH'}
                    </Text>
                    <Text style={s.featureText}>
                      {deliveryPerson || 'Confirm the other person'}
                    </Text>
                  </View>
                </View>
                <View style={s.columns}>
                  <Fact
                    label="DELIVERABLE"
                    value={item.deliverable || 'Needs confirmation'}
                  />
                  <Fact
                    label="DEADLINE"
                    value={
                      item.dueAt
                        ? new Date(item.dueAt).toLocaleDateString()
                        : item.dateText || 'Not agreed'
                    }
                  />
                </View>
              </>
            )}
            {type === 'email' && (
              <View style={s.letter}>
                <View style={s.letterTop}>
                  <Icon name="mail" size={19} color={theme.accent} />
                  <Text style={s.recipient} numberOfLines={1}>
                    {item.email?.to ||
                      item.counterparty ||
                      'Recipient to confirm'}
                  </Text>
                  <Text style={s.draft}>DRAFT</Text>
                </View>
                <Text style={s.subject} numberOfLines={2}>
                  {item.email?.subject || 'Subject to prepare'}
                </Text>
                <Text style={s.letterBody} numberOfLines={3}>
                  {item.email?.body ||
                    'Add the missing details to prepare this message.'}
                </Text>
              </View>
            )}
            {type === 'analytics' && (
              <>
                {item.metrics?.length ? (
                  <View style={s.metricGrid}>
                    {item.metrics.slice(0, 3).map((metric, index) => (
                      <MetricTile
                        key={`${metric.label}-${index}`}
                        metric={metric}
                        accent={theme.accent}
                      />
                    ))}
                  </View>
                ) : (
                  <View style={s.insight}>
                    <Icon name="analytics" size={23} color={theme.accent} />
                    <View style={s.flex}>
                      <Text style={s.featureText}>
                        {outline[0]?.heading || 'Define the comparison'}
                      </Text>
                      <Text style={s.small}>
                        No verified metrics attached · Review the analysis scope
                      </Text>
                    </View>
                  </View>
                )}
              </>
            )}
            {type === 'report' && (
              <View style={s.document}>
                <View style={s.row}>
                  <Icon name="note" size={17} color={theme.accent} />
                  <Text style={s.kicker}>INSIDE YOUR REPORT</Text>
                </View>
                {(outline.length
                  ? outline.map(o => o.heading)
                  : [
                      'Research scope',
                      'Analysis & limitations',
                      'Recommendations',
                    ]
                ).map((title, index) => (
                  <View key={index} style={s.outlineRow}>
                    <Text style={[s.outlineNumber, { color: theme.accent }]}>
                      0{index + 1}
                    </Text>
                    <Text numberOfLines={1} style={s.outlineText}>
                      {title}
                    </Text>
                  </View>
                ))}
              </View>
            )}
            {type === 'script' && (
              <View style={s.storyboard}>
                {(outline.length
                  ? outline.map(o => o.heading)
                  : ['Opening hook', 'Main story', 'Closing payoff']
                ).map((title, index) => (
                  <View key={index} style={s.storyFrame}>
                    <View style={s.filmStrip}>
                      {[0, 1, 2, 3].map(dot => (
                        <View key={dot} style={s.filmHole} />
                      ))}
                    </View>
                    <Text style={[s.sceneNumber, { color: theme.accent }]}>
                      0{index + 1}
                    </Text>
                    <Text numberOfLines={2} style={s.sceneTitle}>
                      {title}
                    </Text>
                  </View>
                ))}
              </View>
            )}
            {type === 'partnership' && (
              <>
                <View style={s.brandRow}>
                  <View style={[s.brandMark, { borderColor: theme.accent }]}>
                    <Icon name="link" size={23} color={theme.accent} />
                  </View>
                  <View style={s.flex}>
                    <Text style={s.kicker}>PARTNERSHIP BRIEF</Text>
                    <Text style={s.featureText}>
                      {item.counterparty || 'Brand to confirm'}
                    </Text>
                  </View>
                  <Text style={[s.stage, { color: theme.accent }]}>
                    To review
                  </Text>
                </View>
                <View style={s.columns}>
                  <Fact
                    label="PROPOSED SCOPE"
                    value={item.deliverable || 'Confirm campaign scope'}
                  />
                  <Fact
                    label="NEXT STEP"
                    value={
                      item.email
                        ? 'Review outreach draft'
                        : 'Review fit & conditions'
                    }
                  />
                </View>
              </>
            )}
            {type === 'clarification' && (
              <View style={s.questionList}>
                {(item.questions.length
                  ? item.questions
                  : [
                      item.kind === 'correction'
                        ? 'Which existing item should this change?'
                        : item.kind === 'progress'
                        ? 'Which item does this progress belong to?'
                        : 'What should Spur prepare next?',
                    ]
                )
                  .slice(0, 2)
                  .map((question, index) => (
                    <View key={index} style={s.questionRow}>
                      <Text style={[s.questionNumber, { color: theme.accent }]}>
                        {index + 1}
                      </Text>
                      <Text style={s.questionText}>{question}</Text>
                    </View>
                  ))}
              </View>
            )}
          </>
        )}
      </Pressable>
      <View style={s.footer}>
        <View style={s.flex}>
          <Text style={[s.state, { color: theme.accent }]}>
            {overdue ? 'Overdue · ' : ''}
            {stateLabels[item.state]}
            {item.pinned ? ' · Pinned' : ''}
          </Text>
          {item.frame === 'email' && <Text style={s.small}>No email sent</Text>}
          {type === 'reminder' && (
            <Text style={s.small}>Agent-page reminder</Text>
          )}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${action}: ${item.title}`}
          onPress={() => onOpen(item)}
          style={s.action}
        >
          <Text style={[s.actionText, { color: theme.accent }]}>{action}</Text>
          <Icon name="chevron" size={13} color={theme.accent} />
        </Pressable>
      </View>
    </View>
  );
}
function MetricTile({
  metric,
  accent,
}: {
  metric: CaptureMetric;
  accent: string;
}) {
  const comparison =
    metric.baseline !== undefined && metric.baseline >= 0 && metric.value >= 0;
  const ceiling = Math.max(metric.value, metric.baseline || 0, 1);
  return (
    <View style={s.metric}>
      <Text style={[s.metricValue, { color: accent }]}>
        {metric.value.toLocaleString()}
        {metric.unit}
      </Text>
      <Text style={s.small}>{metric.label}</Text>
      {metric.baseline !== undefined && (
        <Text style={s.metricComparison}>
          Baseline {metric.baseline.toLocaleString()}
          {metric.unit}
        </Text>
      )}
      {comparison && (
        <View
          style={s.miniChart}
          accessibilityLabel={`Current ${metric.value}, baseline ${metric.baseline}, unit ${metric.unit}`}
        >
          <View
            style={[
              s.baselineBar,
              { width: `${((metric.baseline || 0) / ceiling) * 100}%` },
            ]}
          />
          <View
            style={[
              s.currentBar,
              {
                backgroundColor: accent,
                width: `${(metric.value / ceiling) * 100}%`,
              },
            ]}
          />
        </View>
      )}
    </View>
  );
}
function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.flex}>
      <Text style={s.kicker}>{label}</Text>
      <Text style={s.factValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}
const s = StyleSheet.create({
  narrow: { maxWidth: '86%' },
  medium: { maxWidth: '94%' },
  commitmentWidth: { width: '94%', alignSelf: 'flex-start' },
  compact: {
    alignSelf: 'flex-start',
    padding: 15,
    borderRadius: 20,
    marginBottom: 14,
  },
  compactRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  compactText: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
    color: '#172033',
  },
  miniChart: { marginTop: 9, gap: 4 },
  baselineBar: { height: 4, borderRadius: 2, backgroundColor: '#D6DFEC' },
  currentBar: { height: 4, borderRadius: 2 },
  card: {
    padding: 17,
    borderRadius: 24,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#EDF0F4',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 15,
    flexWrap: 'wrap',
  },
  label: { fontSize: 11, fontWeight: '600', flexShrink: 1 },
  unread: { width: 4, height: 4, borderRadius: 2 },
  time: { color: '#9CA3AF', fontSize: 9, marginLeft: 'auto' },
  title: {
    color: '#1D2A40',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 26,
    marginBottom: 7,
  },
  description: { color: '#7B889C', fontSize: 13, lineHeight: 21 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  meta: { color: '#99A3B3', fontSize: 10, lineHeight: 17, marginVertical: 8 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 14,
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#FFFFFFBB',
    flexWrap: 'wrap',
  },
  state: { fontSize: 10, lineHeight: 17, fontWeight: '500' },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    flexShrink: 1,
  },
  actionText: { fontSize: 11, fontWeight: '600', flexShrink: 1 },
  small: { fontSize: 10, color: '#98A3B4', lineHeight: 16 },
  quote: { fontSize: 53, lineHeight: 40, marginTop: 2, opacity: 0.5 },
  direction: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#FFFFFFB8',
    borderRadius: 16,
    marginTop: 14,
  },
  seal: {
    width: 33,
    height: 33,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kicker: {
    color: '#96A0AE',
    fontSize: 8,
    fontWeight: '600',
    letterSpacing: 0.7,
    marginBottom: 4,
  },
  featureText: {
    color: '#566B82',
    fontSize: 13,
    lineHeight: 21,
    fontWeight: '500',
  },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    marginTop: 16,
  },
  avatar: {
    width: 35,
    height: 35,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.8,
  },
  avatarText: { fontSize: 15, color: '#FFFFFF', fontWeight: '600' },
  columns: {
    flexDirection: 'row',
    gap: 12,
    padding: 13,
    backgroundColor: '#FFFFFFA8',
    borderRadius: 15,
    marginTop: 14,
  },
  factValue: { fontSize: 12, lineHeight: 19, color: '#738095' },
  reminderRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  dateTile: {
    width: 83,
    borderRadius: 17,
    backgroundColor: '#FFFFFFBB',
    padding: 12,
    alignItems: 'center',
  },
  month: { fontSize: 10, letterSpacing: 1, fontWeight: '600' },
  day: { fontSize: 37, fontWeight: '300', lineHeight: 45 },
  clock: { fontSize: 18, fontWeight: '500', marginTop: 9 },
  letter: {
    backgroundColor: '#FFFFFFC9',
    padding: 14,
    borderRadius: 15,
    marginTop: 15,
    borderBottomWidth: 3,
    borderBottomColor: '#E9DFC9',
  },
  letterTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 11,
  },
  recipient: { flex: 1, fontSize: 11, color: '#8D98A7' },
  draft: { fontSize: 8, color: '#B19B76', letterSpacing: 1 },
  subject: {
    fontSize: 13,
    lineHeight: 20,
    color: '#68758B',
    fontWeight: '600',
    marginBottom: 8,
  },
  letterBody: { fontSize: 12, color: '#9AA4B1', lineHeight: 20 },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 15 },
  metric: {
    flexGrow: 1,
    flexBasis: '28%',
    minWidth: 76,
    padding: 10,
    borderRadius: 13,
    backgroundColor: '#FFFFFFBB',
  },
  metricValue: { fontSize: 22, fontWeight: '700', marginBottom: 5 },
  metricComparison: { fontSize: 9, color: '#8C9BB0', marginTop: 6 },
  insight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 13,
    borderRadius: 14,
    marginTop: 15,
    backgroundColor: '#FFFFFFAA',
  },
  document: {
    borderRadius: 14,
    padding: 14,
    backgroundColor: '#FFFFFFB8',
    marginTop: 15,
    borderLeftWidth: 3,
    borderLeftColor: '#B9C9DD',
  },
  outlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 11,
  },
  outlineNumber: { fontSize: 10 },
  outlineText: { flex: 1, fontSize: 12, color: '#8794A7' },
  storyboard: { flexDirection: 'row', gap: 7, marginTop: 15 },
  storyFrame: {
    flex: 1,
    minWidth: 0,
    backgroundColor: '#FFFFFFBA',
    borderRadius: 11,
    padding: 10,
    paddingTop: 7,
    minHeight: 99,
  },
  filmStrip: { flexDirection: 'row', gap: 4, marginBottom: 12 },
  filmHole: {
    width: 5,
    height: 4,
    backgroundColor: '#EADCE3',
    borderRadius: 1,
  },
  sceneNumber: { fontSize: 18, fontWeight: '300', marginBottom: 7 },
  sceneTitle: { fontSize: 10, lineHeight: 16, color: '#9D8D9A' },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 17,
  },
  brandMark: {
    width: 39,
    height: 39,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: '#FFFFFFB9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stage: {
    fontSize: 9,
    backgroundColor: '#FFFFFFBB',
    padding: 6,
    borderRadius: 9,
  },
  questionList: {
    backgroundColor: '#FFFFFFB3',
    borderRadius: 15,
    padding: 12,
    marginTop: 15,
    gap: 12,
  },
  questionRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  questionNumber: {
    width: 20,
    fontSize: 13,
    lineHeight: 21,
    fontWeight: '600',
  },
  questionText: { flex: 1, color: '#8C86A2', fontSize: 12, lineHeight: 20 },
});
