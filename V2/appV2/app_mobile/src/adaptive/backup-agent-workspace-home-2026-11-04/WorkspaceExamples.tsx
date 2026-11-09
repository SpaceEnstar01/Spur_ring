import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { workspaceExamples, patternDescriptions } from './examples';
import {
  Action,
  AdaptivePattern,
  ContextVisual,
  GentleMotion,
  s,
} from './Patterns';
export const exampleTaskId = 'example-jack-followup';
type Stage =
  | 'captured'
  | 'executing'
  | 'approval'
  | 'approved'
  | 'completed'
  | 'failed'
  | 'denied';
export function TaskTransformation() {
  const [stage, setStage] = useState<Stage>('captured');
  return (
    <View testID={`lifecycle-${exampleTaskId}`} style={styles.lifecycle}>
      {stage === 'captured' && (
        <>
          <Text style={s.message}>
            “Help me ask Jack when the Paris footage will be ready.”
          </Text>
          <Text style={s.body}>A new intention captured · Paris Travel</Text>
          <Action
            label="Preview preparation"
            onPress={() => setStage('executing')}
          />
        </>
      )}
      {stage === 'executing' && (
        <>
          <Text style={s.title}>Preparing a follow-up…</Text>
          <View style={s.segments}>
            <View style={[s.segment, s.blueSegment]} />
            <View style={s.segment} />
            <View style={s.segment} />
          </View>
          <Text style={s.body}>
            Organizing your request and drafting a concise email.
          </Text>
          <Action
            label="Preview approval"
            onPress={() => setStage('approval')}
          />
        </>
      )}
      {stage === 'approval' && (
        <>
          <ContextVisual
            title="Ready to send"
            subtitle="Spur · Creator collaboration"
          />
          <Text style={s.meta}>Recipient · Jack, Photographer</Text>
          <Text style={s.detailText}>
            Hi Jack, could you confirm when the Paris footage will be ready? We
            would love to plan the edit around your delivery date.
          </Text>
          <View style={s.actions}>
            <Action label="Deny email" onPress={() => setStage('denied')} />
            <Action
              label="Allow email"
              primary
              onPress={() => setStage('approved')}
            />
          </View>
        </>
      )}
      {stage === 'approved' && (
        <>
          <Text accessibilityLiveRegion="polite" style={s.title}>
            Approved — awaiting execution
          </Text>
          <Text style={s.body}>
            Approval is recorded for this example. Nothing has been sent.
          </Text>
          <Action
            label="Simulate successful execution"
            primary
            onPress={() => setStage('completed')}
          />
          <Action
            label="Simulate failed execution"
            onPress={() => setStage('failed')}
          />
        </>
      )}
      {stage === 'completed' && (
        <>
          <ContextVisual
            success
            title="Email sent"
            subtitle="PARIS TRAVEL · FOLLOW-UP"
          />
          <Text style={s.body}>Recipient: Jack · Status: Sent</Text>
          <Text style={s.feedback}>
            Simulated result — no email was actually sent.
          </Text>
        </>
      )}
      {stage === 'failed' && (
        <>
          <Text accessibilityLiveRegion="polite" style={s.title}>
            Unable to send email.
          </Text>
          <Text style={s.body}>
            Simulated connection failure. The draft is safe.
          </Text>
          <Action
            label="Retry execution preview"
            onPress={() => setStage('approved')}
          />
          <Action
            label="Return to draft"
            onPress={() => setStage('approval')}
          />
        </>
      )}
      {stage === 'denied' && (
        <>
          <Text accessibilityLiveRegion="polite" style={s.title}>
            Action declined.
          </Text>
          <Text style={s.body}>
            No message sent. You can return to the draft whenever you are ready.
          </Text>
          <Action
            label="Return to draft"
            onPress={() => setStage('approval')}
          />
        </>
      )}
      {stage !== 'captured' && (
        <Action
          label="Reset task example"
          onPress={() => setStage('captured')}
        />
      )}
    </View>
  );
}
// Same fixture identities in both compositions; never insert examples into real stores.
const todayOrder = [
  'example-titles',
  'example-authorize',
  'example-research',
  'example-artifact',
  'example-completed',
  'example-next',
  'example-capture',
];
export function WorkspaceExamples() {
  const [visible, setVisible] = useState(true),
    [today, setToday] = useState(false);
  return (
    <GentleMotion>
      <View style={styles.root}>
        <View style={styles.header}>
          <View style={s.flex}>
            <Text style={styles.heading}>Adaptive Agent UI</Text>
            <Text style={s.meta}>20 interaction patterns</Text>
          </View>
          <Action
            label={visible ? 'Hide examples' : 'Show examples'}
            onPress={() => setVisible(!visible)}
          />
        </View>
        {visible && (
          <>
            <View style={s.actions}>
              <Action
                label="All 20 examples"
                selected={!today}
                onPress={() => setToday(false)}
              />
              <Action
                label="Today composition"
                selected={today}
                onPress={() => setToday(true)}
              />
            </View>
            {(today
              ? todayOrder.map(
                  id => workspaceExamples.find(entry => entry.id === id)!,
                )
              : workspaceExamples
            ).map(entry => (
              <View
                key={entry.id}
                testID={`adaptive-${entry.kind}`}
                style={styles.pattern}
              >
                <Text style={styles.patternTitle}>{`${String(
                  workspaceExamples.indexOf(entry) + 1,
                ).padStart(2, '0')} | ${
                  patternDescriptions[entry.kind].name
                }`}</Text>
                <Text style={styles.patternUse}>
                  适合：{patternDescriptions[entry.kind].use}
                </Text>
                {entry.kind === 'task_transformation' ? (
                  <TaskTransformation />
                ) : (
                  <AdaptivePattern entry={entry} />
                )}
              </View>
            ))}
          </>
        )}
      </View>
    </GentleMotion>
  );
}
const styles = StyleSheet.create({
  root: {
    marginTop: 24,
    paddingTop: 24,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E8ECF0',
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  heading: {
    fontSize: 22,
    fontWeight: '600',
    color: '#182235',
    letterSpacing: -0.7,
  },
  intro: {
    color: '#7C8491',
    fontSize: 13,
    lineHeight: 21,
    marginTop: 15,
    marginBottom: 6,
  },
  pattern: {
    paddingTop: 24,
    paddingBottom: 12,
  },
  lifecycle: { gap: 10 },
  patternTitle: {
    color: '#1B1B1B',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 22,
    marginBottom: 6,
  },
  patternUse: {
    color: '#626262',
    fontSize: 12,
    lineHeight: 20,
    marginBottom: 16,
  },
  eyebrow: {
    color: '#7C8491',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.2,
  },
});
