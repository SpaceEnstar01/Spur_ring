import React, { useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  partnershipProfile,
  partnershipProspects,
  partnershipStageLabels,
  PartnershipStage,
  Prospect,
} from '../agent/partnershipDemo';
import { Icon } from './Icon';
export function PartnershipDemo() {
  const [open, setOpen] = useState(false),
    [selectedId, setSelectedId] = useState<string | null>(null);
  const [prospects, setProspects] = useState(partnershipProspects);
  const [filter, setFilter] = useState('All');
  const selected = prospects.find(p => p.id === selectedId);
  function update(
    prospect: Prospect,
    stage: PartnershipStage,
    reason: string,
    reply?: string,
  ) {
    setProspects(current =>
      current.map(p =>
        p.id === prospect.id
          ? {
              ...p,
              stage,
              reply: reply ?? p.reply,
              history: [
                ...p.history,
                `${new Date().toLocaleString()} · ${reason}`,
              ],
            }
          : p,
      ),
    );
  }
  const matches = prospects.filter(p =>
    filter === 'All' || filter === 'Needs you'
      ? filter === 'All' ||
        ['interested', 'needs_information'].includes(p.stage)
      : filter === 'Drafts'
      ? p.stage === 'draft'
      : p.stage === 'awaiting_reply',
  );
  function send(prospect: Prospect) {
    Alert.alert(
      'Review this outreach step?',
      'This moves the reference workflow to its next step. No email is sent, no account is accessed, and no rates or commercial commitments are agreed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue Workflow',
          onPress: () =>
            update(
              prospect,
              'awaiting_reply',
              'Outreach step reviewed. No email sent.',
            ),
        },
      ],
    );
  }
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Review brand partnership workflow"
        onPress={() => {
          setOpen(true);
          setSelectedId(null);
        }}
        style={s.card}
      >
        <View style={s.row}>
          <Icon name="mail" size={17} color="#6084B5" />
          <Text style={s.kicker}>PARTNERSHIP WORKFLOW</Text>
        </View>
        <Text style={s.title}>Brand Partnership Playbook ›</Text>
        <Text style={s.body}>
          A reference workflow for discovering brands, preparing outreach, and
          reviewing partnership opportunities.
        </Text>
        <View style={s.stats}>
          {[
            ['01', 'Discover'],
            ['02', 'Prepare'],
            ['03', 'Review'],
          ].map(([value, label]) => (
            <View key={label} style={s.stat}>
              <Text style={s.value}>{value}</Text>
              <Text style={s.statLabel}>{label}</Text>
            </View>
          ))}
        </View>
        <Text style={s.link}>Review Opportunities →</Text>
      </Pressable>
      <Modal
        visible={open}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setOpen(false)}
      >
        <SafeAreaView style={s.modal}>
          <View style={s.toolbar}>
            {selected ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Back to partnership overview"
                onPress={() => setSelectedId(null)}
                style={s.close}
              >
                <Icon name="back" />
              </Pressable>
            ) : (
              <Text style={s.kicker}>SPUR · PARTNERSHIPS</Text>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close partnership workflow"
              onPress={() => setOpen(false)}
              style={s.close}
            >
              <Icon name="close" />
            </Pressable>
          </View>
          <ScrollView
            key={selectedId || 'overview'}
            contentContainerStyle={s.details}
          >
            <Text style={s.pageTitle}>
              {selected ? selected.name : 'Brand Partnership Opportunities'}
            </Text>
            <View style={s.notice}>
              <Text style={s.body}>
                Reference scenario. No inbox access, brand research,
                authorization, or actual email delivery. Connected Apps badges
                do not authorize this workflow.
              </Text>
            </View>
            {!selected ? (
              <>
                <Text style={s.heading}>
                  From opportunity to a useful conversation
                </Text>
                <Text style={s.body}>
                  Discover → Qualify → Prepare outreach → Review approval →
                  Triage replies → Creator decision → Follow up. A match is not
                  evidence of brand interest. Interest is not a confirmed deal.
                </Text>
                <Text style={s.heading}>Creator partnership profile</Text>
                {partnershipProfile.map(([title, text]) => (
                  <Section key={title} title={title} text={text} />
                ))}
                <Text style={s.heading}>Opportunity pipeline</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={s.filters}
                >
                  {['All', 'Needs you', 'Drafts', 'Awaiting reply'].map(
                    value => (
                      <Pressable
                        key={value}
                        accessibilityRole="tab"
                        accessibilityState={{ selected: filter === value }}
                        onPress={() => setFilter(value)}
                        style={[s.chip, filter === value && s.selectedChip]}
                      >
                        <Text style={s.chipText}>{value}</Text>
                      </Pressable>
                    ),
                  )}
                </ScrollView>
                {matches.map(p => (
                  <Pressable
                    key={p.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Review ${p.name} opportunity`}
                    onPress={() => setSelectedId(p.id)}
                    style={s.prospect}
                  >
                    <Text style={s.prospectTitle}>{p.name} ›</Text>
                    <Text style={s.stage}>
                      {partnershipStageLabels[p.stage]}
                    </Text>
                    <Text style={s.body}>{p.product}</Text>
                    <Text numberOfLines={3} style={s.note}>
                      {p.reason}
                    </Text>
                  </Pressable>
                ))}
                {!matches.length && (
                  <Text style={s.body}>No opportunities in this stage.</Text>
                )}
                <Text style={s.heading}>The creator stays in control</Text>
                <Text style={s.body}>
                  In a real integration, approve a specific contact list,
                  message, limits, and follow-up rules before outreach. Quotes,
                  usage rights, exclusivity, and contract commitments require
                  their own review. No response or a tracking signal alone
                  should be labelled commercial interest.
                </Text>
                <Button
                  title="Start Again"
                  onPress={() => {
                    setProspects(partnershipProspects);
                    setFilter('All');
                  }}
                />
              </>
            ) : (
              <>
                <Text style={s.stage}>
                  {partnershipStageLabels[selected.stage]}
                </Text>
                <Section
                  title="Product & possible fit"
                  text={selected.product}
                />
                <Section
                  title="Why this match was suggested"
                  text={selected.reason}
                />
                <Section
                  title="Evidence & confidence"
                  text={
                    selected.reply
                      ? 'The message below is a fictional source example. It supports only what it explicitly says; it is not a verified email or proof of an agreed campaign.'
                      : 'Editorial match hypothesis only. No verified campaign, contact, brand interest, or response.'
                  }
                />
                {!!selected.reply && (
                  <>
                    <Text style={s.heading}>Reference brand reply</Text>
                    <Text selectable style={s.email}>
                      {selected.reply}
                    </Text>
                  </>
                )}
                <Text style={s.heading}>What still needs agreement</Text>
                {selected.missing.map(item => (
                  <Text key={item} style={s.bullet}>
                    • {item}
                  </Text>
                ))}
                <Text style={s.heading}>
                  {selected.stage === 'needs_information'
                    ? 'Clarifying reply draft'
                    : 'Outreach / response draft'}
                </Text>
                <Text style={s.note}>
                  Display-only recipient: {selected.contact}. Replace with a
                  verified contact before any real send.
                </Text>
                <Text selectable style={s.subject}>
                  {selected.subject}
                </Text>
                <Text selectable style={s.email}>
                  {selected.id === 'northline'
                    ? 'Hi Northline Audio team,\n\nThanks for your interest. I’d be happy to explore whether the campaign is a good fit. Could you share the campaign objective, target publishing window, intended deliverables, and indicative budget? Please also clarify any paid-media usage, exclusivity, and review requirements.\n\nI’ll review the scope and confirm availability before sending an approved proposal and rate. I can share a verified media kit once the creator has reviewed the request.\n\nBest,\n[Creator Name]'
                    : selected.draft}
                </Text>
                <Text style={s.heading}>Recommended next step</Text>
                <Text style={s.body}>
                  {selected.stage === 'interested'
                    ? 'Creator review: decide whether to continue, confirm your availability, and choose the approved rate card. Ask the brand to clarify scope before making a proposal. Do not accept an offer that has not been made.'
                    : selected.stage === 'needs_information'
                    ? 'Ask for campaign scope before quoting. The prepared response should collect the minimum missing information without inventing a price or commitment.'
                    : selected.stage === 'awaiting_reply'
                    ? 'This reference is at the waiting stage. A future real workflow should track the last contact and respect the creator’s approved cadence and stop rules.'
                    : 'Review relevance, recipient, verified creator facts, and the full draft before approving any outreach.'}
                </Text>
                {['draft', 'needs_information'].includes(selected.stage) && (
                  <Button
                    title="Review Outreach Step"
                    onPress={() => send(selected)}
                  />
                )}
                {selected.stage === 'matched' && (
                  <Button
                    title="Prepare Draft"
                    onPress={() =>
                      update(selected, 'draft', 'Reference draft prepared.')
                    }
                  />
                )}
                {selected.stage === 'awaiting_reply' && (
                  <Button
                    title="Explore an Interested Reply"
                    onPress={() =>
                      update(
                        selected,
                        'interested',
                        'Reference reply opened; not an actual inbox event.',
                        'Hi [Creator Name], we are interested in discussing a collaboration. Could you share your media kit, availability, and proposed format?',
                      )
                    }
                  />
                )}
                {selected.stage === 'interested' && (
                  <Button
                    title="Mark for My Follow-up"
                    onPress={() =>
                      update(
                        selected,
                        'handed_over',
                        'Reference marked for follow-up. No external action.',
                      )
                    }
                  />
                )}
                {!['paused', 'declined'].includes(selected.stage) && (
                  <Button
                    title="Not Now"
                    onPress={() =>
                      update(
                        selected,
                        'paused',
                        'Creator postponed this opportunity.',
                      )
                    }
                  />
                )}
                {selected.stage !== 'declined' && (
                  <Button
                    title="Do Not Pursue"
                    onPress={() =>
                      Alert.alert(
                        'Stop pursuing this opportunity?',
                        'No message will be sent.',
                        [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Do Not Pursue',
                            onPress: () =>
                              update(
                                selected,
                                'declined',
                                'Reference opportunity declined locally.',
                              ),
                          },
                        ],
                      )
                    }
                  />
                )}
                <Text style={s.heading}>Communication history</Text>
                {selected.history.map((event, index) => (
                  <Text key={index} style={s.history}>
                    {event}
                  </Text>
                ))}
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </>
  );
}
function Section({ title, text }: { title: string; text: string }) {
  return (
    <View style={s.section}>
      <Text style={s.prospectTitle}>{title}</Text>
      <Text selectable style={s.body}>
        {text}
      </Text>
    </View>
  );
}
function Button({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={s.button}>
      <Text style={s.buttonText}>{title}</Text>
    </Pressable>
  );
}
const s = StyleSheet.create({
  card: {
    padding: 17,
    backgroundColor: '#F0F5FA',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E6EDF5',
    marginBottom: 14,
  },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 14 },
  kicker: {
    fontSize: 10,
    color: '#7590AE',
    letterSpacing: 0.8,
    flex: 1,
    fontWeight: '600',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#23344B',
    lineHeight: 26,
    marginBottom: 9,
  },
  body: { color: '#78879B', fontSize: 13, lineHeight: 22 },
  stats: { flexDirection: 'row', gap: 8, marginVertical: 15 },
  stat: {
    flex: 1,
    backgroundColor: '#FFFFFFBB',
    borderRadius: 12,
    padding: 10,
  },
  value: { color: '#375E86', fontSize: 23, fontWeight: '700' },
  statLabel: { color: '#8C9BAC', fontSize: 9, lineHeight: 14, marginTop: 4 },
  link: { fontSize: 12, fontWeight: '600', color: '#4475AE', marginTop: 14 },
  note: { fontSize: 10, color: '#99A4B2', lineHeight: 17, marginTop: 10 },
  modal: { flex: 1, backgroundColor: '#FFFFFF' },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingVertical: 8,
  },
  close: { padding: 10 },
  details: { padding: 22, paddingBottom: 45 },
  pageTitle: {
    fontSize: 27,
    color: '#22334C',
    lineHeight: 36,
    fontWeight: '700',
  },
  notice: {
    padding: 15,
    backgroundColor: '#F4F7FB',
    borderRadius: 15,
    marginVertical: 18,
  },
  heading: {
    color: '#314864',
    fontSize: 19,
    lineHeight: 27,
    fontWeight: '600',
    marginTop: 25,
    marginBottom: 13,
  },
  section: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#EDF1F6',
  },
  prospectTitle: {
    fontSize: 15,
    color: '#405570',
    fontWeight: '600',
    lineHeight: 23,
    marginBottom: 6,
  },
  filters: { flexDirection: 'row', gap: 8, marginBottom: 15 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 15,
    backgroundColor: '#F5F6F9',
  },
  selectedChip: { backgroundColor: '#EAF1FB' },
  chipText: { color: '#6C87A7', fontSize: 11 },
  prospect: {
    padding: 15,
    backgroundColor: '#F6F8FB',
    borderRadius: 17,
    marginBottom: 11,
  },
  stage: {
    fontSize: 11,
    color: '#4C86A8',
    marginBottom: 9,
    marginTop: 9,
    fontWeight: '600',
  },
  bullet: { color: '#7A879B', fontSize: 13, lineHeight: 23, marginBottom: 9 },
  email: {
    padding: 16,
    backgroundColor: '#FAFAF8',
    borderRadius: 13,
    fontSize: 14,
    lineHeight: 24,
    color: '#5C6E85',
  },
  subject: {
    fontSize: 14,
    color: '#465D7A',
    fontWeight: '600',
    lineHeight: 23,
    marginVertical: 14,
  },
  button: {
    backgroundColor: '#EAF0F8',
    padding: 14,
    borderRadius: 23,
    alignItems: 'center',
    marginTop: 13,
  },
  buttonText: { color: '#3D638D', fontSize: 12, fontWeight: '600' },
  history: {
    color: '#8C98A8',
    fontSize: 11,
    lineHeight: 19,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EDF1F6',
  },
});
