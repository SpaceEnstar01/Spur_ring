import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  Image,
  LayoutAnimation,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { Icon } from '../components/Icon';
import type { AdaptiveEntry } from './model';
import { sampleDailyViews } from './examples';
import { colors } from '../theme/tokens';
const blue = '#3165C8',
  ink = '#1B1B1B',
  muted = '#777777',
  line = '#EBEDF0';
const Motion = createContext(false);
export function GentleMotion({ children }: { children: React.ReactNode }) {
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then(value => {
      if (active) setReduced(value);
    });
    const listener = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduced,
    );
    return () => {
      active = false;
      listener.remove();
    };
  }, []);
  return <Motion.Provider value={!reduced}>{children}</Motion.Provider>;
}
export function Action({
  label,
  onPress,
  primary = false,
  selected = false,
  equal = false,
  textOnly = false,
  fullWidth = false,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
  selected?: boolean;
  equal?: boolean;
  textOnly?: boolean;
  fullWidth?: boolean;
}) {
  const animate = useContext(Motion);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={() => {
        if (animate)
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        onPress();
      }}
      style={({ pressed }) => [
        s.button,
        equal && s.equalButton,
        fullWidth && s.fullWidth,
        textOnly && s.textButton,
        primary && s.primary,
        selected && s.selected,
        pressed && { opacity: 0.7 },
      ]}
    >
      <Text style={[s.action, primary && s.whiteText]}>{label}</Text>
    </Pressable>
  );
}
function Heading({ children }: { children: React.ReactNode }) {
  return <Text style={s.title}>{children}</Text>;
}
function Body({ children }: { children: React.ReactNode }) {
  return <Text style={s.body}>{children}</Text>;
}
function Meta({ children }: { children: React.ReactNode }) {
  return <Text style={s.meta}>{children}</Text>;
}
function Detail({ text }: { text?: string }) {
  return text ? (
    <View style={s.detail}>
      <Text selectable style={s.detailText}>
        {text}
      </Text>
    </View>
  ) : null;
}
function Actions({ children }: { children: React.ReactNode }) {
  return <View style={s.actions}>{children}</View>;
}
function Preview({
  entry,
  label = 'View details',
  primary = false,
}: {
  entry: AdaptiveEntry;
  label?: string;
  primary?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Action
        label={open ? 'Close preview' : label}
        primary={primary && !open}
        fullWidth={primary && !open}
        textOnly={!primary || open}
        onPress={() => setOpen(!open)}
      />
      {open && <Detail text={entry.detail || entry.text} />}
    </>
  );
}
export function MinimalNotification({
  entry,
  completed = false,
}: {
  entry: AdaptiveEntry;
  completed?: boolean;
}) {
  return (
    <View style={s.inline}>
      <Icon
        name={completed ? 'check' : 'sparkles'}
        color={completed ? '#328768' : blue}
        size={18}
      />
      <View style={s.flex}>
        <Text style={s.message}>{entry.title}</Text>
        <Meta>{completed ? entry.text : entry.meta}</Meta>
        <Preview entry={entry} label={completed ? 'View result' : entry.text} />
      </View>
    </View>
  );
}
export function InlineQuestion({ entry }: { entry: AdaptiveEntry }) {
  const [answer, setAnswer] = useState('');
  return (
    <View>
      <Meta>SPUR WANTS TO CONFIRM</Meta>
      <Heading>{entry.title}</Heading>
      <Body>{entry.text}</Body>
      {answer ? (
        <>
          <Text accessibilityLiveRegion="polite" style={s.feedback}>
            {answer === 'Continue'
              ? 'Continuing tonight in this preview.'
              : 'Moved to tomorrow in this preview.'}
          </Text>
          <Action label="Change answer" onPress={() => setAnswer('')} />
        </>
      ) : (
        <Actions>
          {entry.options?.map(option => (
            <Action
              key={option.title}
              label={option.title}
              primary={option.title === 'Continue'}
              onPress={() => setAnswer(option.title)}
            />
          ))}
        </Actions>
      )}
    </View>
  );
}
export function CompactChecklist({ entry }: { entry: AdaptiveEntry }) {
  const [checked, setChecked] = useState<string[]>([]),
    [expanded, setExpanded] = useState('');
  return (
    <View>
      <Heading>{entry.title}</Heading>
      {entry.options?.map(option => {
        const done = checked.includes(option.title);
        return (
          <View key={option.title}>
            <View style={s.listRow}>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityLabel={`Complete ${option.title}`}
                accessibilityState={{ checked: done }}
                onPress={() =>
                  setChecked(
                    done
                      ? checked.filter(t => t !== option.title)
                      : [...checked, option.title],
                  )
                }
                style={s.checkTarget}
              >
                <View style={[s.checkbox, done && s.checked]}>
                  {done && <Icon name="check" size={13} color="#FFF" />}
                </View>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Details for ${option.title}`}
                onPress={() =>
                  setExpanded(expanded === option.title ? '' : option.title)
                }
                style={s.flex}
              >
                <Text style={[s.listTitle, done && s.struck]}>
                  {option.title}
                </Text>
              </Pressable>
              <Meta>{option.subtitle}</Meta>
            </View>
            {expanded === option.title && (
              <Detail
                text={`${option.title}\nParis Travel · Personal checklist. Changes stay in this preview.`}
              />
            )}
          </View>
        );
      })}
    </View>
  );
}
export const travelResearchStages = [
  'Searching',
  'Analyzing',
  'Drafting',
  'Ready',
] as const;
export const travelResearchStageCopy = [
  'Searching recent travel videos and reference content…',
  'Comparing topic popularity, story structures and audience responses…',
  'Preparing three actionable content directions…',
  'Research complete. Three directions are ready to review.',
];
const stages: readonly string[] = travelResearchStages;
const descriptions: readonly string[] = travelResearchStageCopy;
export function ExecutionStatus({ entry }: { entry: AdaptiveEntry }) {
  const [stage, setStage] = useState(0);
  return (
    <View style={s.execution}>
      <View style={s.inline}>
        <Icon
          name={stage === 3 ? 'check' : 'search'}
          size={18}
          color={stage === 3 ? '#328768' : blue}
        />
        <View style={s.flex}>
          <Heading>{entry.title}</Heading>
          <Meta>
            {entry.meta} · {stages[stage]}
          </Meta>
        </View>
      </View>
      <View style={s.segments}>
        {stages.map((label, index) => (
          <View
            key={label}
            style={[
              s.segment,
              index <= stage && (stage === 3 ? s.greenSegment : s.blueSegment),
            ]}
          />
        ))}
      </View>
      <Body>{descriptions[stage]}</Body>
      <Action
        label={stage === 3 ? 'Replay stages' : 'Preview next stage'}
        onPress={() => setStage(stage === 3 ? 0 : stage + 1)}
      />
      <Meta>Interactive preview · stages advance only when tapped.</Meta>
    </View>
  );
}
export function ResearchReport({ entry }: { entry: AdaptiveEntry }) {
  return (
    <View style={s.editorial}>
      <Image
        source={require('../assets/today/santorini.jpg')}
        accessibilityLabel="Santorini coastline, travel research cover"
        style={s.cover}
      />
      <View style={s.editorialBody}>
        <Meta>{entry.meta}</Meta>
        <Text style={s.reportTitle}>{entry.title}</Text>
        <Body>{entry.text}</Body>
        <View style={s.badges}>
          {['12 references', '3 directions', 'Script recommendations'].map(
            text => (
              <Text key={text} style={s.badge}>
                {text}
              </Text>
            ),
          )}
        </View>
        <Preview entry={entry} label="View full report" />
      </View>
    </View>
  );
}
export function VideoAnalytics({ entry }: { entry: AdaptiveEntry }) {
  const [point, setPoint] = useState(6),
    [more, setMore] = useState(false);
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const points = sampleDailyViews.map((value, index) => ({
    x: 12 + index * 46,
    y: 118 - value / 3000,
  }));
  return (
    <View style={s.analytics}>
      <Heading>{entry.title}</Heading>
      <View style={s.metricRow}>
        <Text style={s.metric}>
          1.2M<Text style={s.unit}> views</Text>
        </Text>
        <Text style={s.growth}>+62%</Text>
      </View>
      <Meta>
        {entry.meta} · Illustrative metrics, not connected to analytics
      </Meta>
      <Svg
        width="100%"
        height={140}
        viewBox="0 0 300 140"
        accessibilityElementsHidden
      >
        {[40, 80, 120].map(y => (
          <Path key={y} d={`M0 ${y}H300`} stroke={line} />
        ))}
        <Path
          d={points.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join(' ')}
          stroke={blue}
          strokeWidth={2.5}
          fill="none"
        />
        {points.map((p, i) => (
          <Circle
            key={days[i]}
            cx={p.x}
            cy={p.y}
            r={i === point ? 7 : 5}
            onPress={() => setPoint(i)}
            fill={blue}
          />
        ))}
      </Svg>
      <View style={s.days}>
        {days.map((day, i) => (
          <Pressable
            key={day}
            accessibilityRole="button"
            accessibilityLabel={`${day} ${sampleDailyViews[i]} views`}
            accessibilityState={{ selected: point === i }}
            onPress={() => setPoint(i)}
            style={[s.day, point === i && s.selected]}
          >
            <Text style={s.dayText}>{day}</Text>
          </Pressable>
        ))}
      </View>
      <Text accessibilityLiveRegion="polite" style={s.feedback}>
        {days[point]} · {sampleDailyViews[point].toLocaleString()} views
      </Text>
      <Body>{entry.text}</Body>
      <Action
        label={more ? 'Fewer insights' : 'Explore insights'}
        onPress={() => setMore(!more)}
      />
      {more && (
        <Detail text="Sunday contributed 25% of the sample week’s views.\nThe final two days account for 45% of this sample.\nThis example shows correlation, not why the video performed well." />
      )}
    </View>
  );
}
export function EmailApproval({ entry }: { entry: AdaptiveEntry }) {
  const [draft, setDraft] = useState(entry.text),
    [savedDraft, setSavedDraft] = useState(entry.text),
    [editing, setEditing] = useState(false),
    [approved, setApproved] = useState(false);
  return (
    <View style={s.panel}>
      <Meta>EMAIL DRAFT</Meta>
      <Heading>{entry.title}</Heading>
      <Meta>{entry.meta}</Meta>
      {editing ? (
        <TextInput
          accessibilityLabel="Edit email draft"
          value={draft}
          onChangeText={setDraft}
          multiline
          style={s.input}
        />
      ) : (
        <View>
          <Text numberOfLines={2} style={s.body}>
            {draft}
          </Text>
          <Preview
            entry={{ ...entry, detail: draft }}
            label="Read full draft"
          />
        </View>
      )}
      {approved && (
        <Text accessibilityLiveRegion="polite" style={s.feedback}>
          Approved — demo only, no email sent.
        </Text>
      )}
      <Actions>
        <Action
          label={editing ? 'Save draft' : approved ? 'Review again' : 'Approve'}
          primary
          onPress={() => {
            if (editing) {
              setSavedDraft(draft);
              setEditing(false);
              setApproved(false);
            } else setApproved(!approved);
          }}
        />
        <Action
          label={editing ? 'Cancel edit' : 'Edit'}
          onPress={() => {
            if (editing) setDraft(savedDraft);
            else setSavedDraft(draft);
            setEditing(!editing);
            setApproved(false);
          }}
        />
      </Actions>
    </View>
  );
}
export function RecordingTimeline({ entry }: { entry: AdaptiveEntry }) {
  const [full, setFull] = useState(false),
    [step, setStep] = useState(-1);
  return (
    <View>
      <View style={s.inline}>
        <Icon name="wave" size={23} color={blue} />
        <View>
          <Heading>{entry.title}</Heading>
          <Meta>{entry.meta}</Meta>
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Expand recording transcript"
        onPress={() => setFull(!full)}
      >
        <Text style={s.quote} numberOfLines={full ? undefined : 2}>
          “{entry.text}”
        </Text>
        <Text style={s.link}>
          {full ? 'Less transcript' : 'Read transcript'}
        </Text>
      </Pressable>
      {entry.options?.map((option, index) => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={option.title}
          key={option.title}
          onPress={() => setStep(step === index ? -1 : index)}
          style={s.timelineRow}
        >
          <View style={s.timelineDot} />
          <View style={s.flex}>
            <Text style={s.listTitle}>{option.title}</Text>
            {step === index && <Body>{option.subtitle}</Body>}
          </View>
        </Pressable>
      ))}
    </View>
  );
}
export function ChoiceSelector({
  entry,
  visual = false,
}: {
  entry: AdaptiveEntry;
  visual?: boolean;
}) {
  const [selected, setSelected] = useState(-1);
  const images = [
    require('../assets/today/paris.jpg'),
    require('../assets/today/santorini.jpg'),
  ];
  const options = entry.options?.map((option, index) => (
    <Pressable
      key={option.title}
      accessibilityRole="button"
      accessibilityLabel={`Choose ${option.title}`}
      accessibilityState={{ selected: selected === index }}
      onPress={() => setSelected(index)}
      style={[
        visual ? s.visualOption : s.choice,
        selected === index && s.selected,
      ]}
    >
      {visual ? (
        <Image
          source={images[index % 2]}
          accessibilityLabel={option.subtitle}
          style={s.thumbnail}
        />
      ) : (
        <Text style={s.optionNumber}>0{index + 1}</Text>
      )}
      <View style={s.optionText}>
        <Text style={s.listTitle}>
          {option.title}
          {selected === index ? ' ✓' : ''}
        </Text>
        <Meta>{option.subtitle}</Meta>
      </View>
    </Pressable>
  ));
  return (
    <View>
      <Heading>{entry.title}</Heading>
      <Body>{entry.text}</Body>
      {visual ? (
        <View style={s.visualGrid}>{options}</View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.horizontal}
        >
          {options}
        </ScrollView>
      )}
      {selected >= 0 && (
        <Text accessibilityLiveRegion="polite" style={s.feedback}>
          Selected: {entry.options?.[selected].title}
        </Text>
      )}
    </View>
  );
}
export function ScheduleTimeline({ entry }: { entry: AdaptiveEntry }) {
  const [selected, setSelected] = useState(-1);
  return (
    <View>
      <Heading>{entry.title}</Heading>
      {entry.options?.map((option, index) => {
        const [time, ...meta] = option.subtitle.split(' · ');
        return (
          <Pressable
            key={time}
            accessibilityRole="button"
            accessibilityLabel={`${time} ${option.title}`}
            onPress={() => setSelected(selected === index ? -1 : index)}
            style={s.schedule}
          >
            <Text style={s.time}>{time}</Text>
            <View style={s.scheduleContent}>
              <View style={s.timelineDot} />
              <View style={s.flex}>
                <Text style={s.listTitle}>
                  {option.title}
                  {index === 0 ? ' · Next' : ''}
                </Text>
                <Meta>{meta.join(' · ')}</Meta>
                {selected === index && (
                  <Detail text="Review the project and confirm the next step. This schedule is illustrative; no calendar event was created." />
                )}
              </View>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
export function LearningFeedback({ entry }: { entry: AdaptiveEntry }) {
  const [preference, setPreference] = useState(entry.text),
    [draft, setDraft] = useState(entry.text),
    [editing, setEditing] = useState(false),
    [confirmed, setConfirmed] = useState(false);
  return (
    <View style={s.soft}>
      <Meta>
        {confirmed
          ? 'CONFIRMED IN THIS PREVIEW'
          : 'INFERRED · NEEDS YOUR CONFIRMATION'}
      </Meta>
      <Heading>{entry.title}</Heading>
      {editing ? (
        <TextInput
          accessibilityLabel="Correct preference"
          value={draft}
          onChangeText={setDraft}
          multiline
          style={s.input}
        />
      ) : (
        <Body>{preference}</Body>
      )}
      <Actions>
        <Action
          label={editing ? 'Save preference' : 'That’s right'}
          primary
          onPress={() => {
            if (editing && !draft.trim()) return;
            if (editing) setPreference(draft.trim());
            setEditing(false);
            setConfirmed(true);
          }}
        />
        <Action
          label={editing ? 'Cancel correction' : 'Correct it'}
          onPress={() => {
            setDraft(preference);
            setEditing(!editing);
          }}
        />
      </Actions>
    </View>
  );
}
export function ContextVisual({
  success = false,
  file = false,
  title,
  subtitle,
}: {
  success?: boolean;
  file?: boolean;
  title?: string;
  subtitle?: string;
}) {
  return (
    <View style={[s.art, success && s.successArt]}>
      <Icon
        name={success ? 'check' : file ? 'note' : 'send'}
        size={25}
        color={success ? '#148348' : '#B56E4D'}
      />
      {!!title && (
        <Text style={[s.heroTitle, success && s.greenText]}>{title}</Text>
      )}
      {!!subtitle && (
        <Text style={[s.heroSubtitle, success && s.greenText]}>{subtitle}</Text>
      )}
    </View>
  );
}
function InfoRow({
  label,
  value,
  success = false,
}: {
  label: string;
  value: string;
  success?: boolean;
}) {
  return (
    <View style={s.infoRow}>
      <Text style={s.meta}>{label}</Text>
      <Text style={[s.infoValue, success && s.greenText]}>{value}</Text>
    </View>
  );
}
export function ActionApproval({ entry }: { entry: AdaptiveEntry }) {
  const [state, setState] = useState<'pending' | 'approved' | 'denied'>(
    'pending',
  );
  return (
    <View style={s.editorial}>
      <ContextVisual
        title={
          state === 'pending'
            ? 'Ready to send'
            : state === 'approved'
            ? 'Approved'
            : 'Action declined'
        }
        subtitle="Spur · Creator collaboration"
      />
      <View style={s.editorialBody}>
        <Text style={s.message}>{entry.text}</Text>
        <InfoRow label="Recipient" value="Jack · Photographer" />
        <InfoRow label="Action" value="Send email" />
        {state === 'pending' ? (
          <View style={s.equalActions}>
            <Action equal label="Deny" onPress={() => setState('denied')} />
            <Action
              equal
              label="Allow"
              primary
              onPress={() => setState('approved')}
            />
          </View>
        ) : (
          <>
            <Text accessibilityLiveRegion="polite" style={s.feedback}>
              {state === 'approved'
                ? 'Approved — demo only, not sent.'
                : 'Denied — no action taken.'}
            </Text>
            <Action
              textOnly
              label="Reset approval"
              onPress={() => setState('pending')}
            />
          </>
        )}
        <Preview entry={entry} label="Read draft" />
      </View>
    </View>
  );
}
export function CompletionArtifact({ entry }: { entry: AdaptiveEntry }) {
  return (
    <View style={s.editorial}>
      <ContextVisual
        success
        file
        title="Script completed"
        subtitle="PARIS TRAVEL · SCRIPT V2"
      />
      <View style={s.editorialBody}>
        <Text style={s.message}>{entry.text}</Text>
        <Text style={s.body}>
          Your latest direction is reflected in a revised, reviewable draft.
        </Text>
        <InfoRow label="Version" value="V2 · Draft" />
        <InfoRow label="Status" value="Ready for review" success />
        <Preview entry={entry} label="View script" primary />
      </View>
    </View>
  );
}
export function RecoveryState({ entry }: { entry: AdaptiveEntry }) {
  const [answer, setAnswer] = useState('');
  return (
    <View style={s.recovery}>
      <Text style={s.title}>{entry.title}</Text>
      <Text style={s.body}>{entry.text}</Text>
      {answer ? (
        <>
          <Text style={s.feedback}>{answer}</Text>
          <Action
            textOnly
            label="Reset recovery"
            onPress={() => setAnswer('')}
          />
        </>
      ) : (
        <Actions>
          <Action
            label="Retry"
            primary
            onPress={() =>
              setAnswer('Retry selected — no email sent in this preview.')
            }
          />
          <Action
            label="Return to draft"
            onPress={() => setAnswer('Returned to the draft. No action taken.')}
          />
        </Actions>
      )}
    </View>
  );
}
export function GeneratedDeliverable({ entry }: { entry: AdaptiveEntry }) {
  const [preview, setPreview] = useState(false);
  const [editing, setEditing] = useState(false),
    [request, setRequest] = useState(''),
    [submitted, setSubmitted] = useState('');
  return (
    <View style={s.panel}>
      <View style={s.inline}>
        <View style={s.fileIcon}>
          <Icon name="analytics" size={28} color={blue} />
        </View>
        <View style={s.flex}>
          <Heading>{entry.title}</Heading>
          <Meta>{entry.meta}</Meta>
        </View>
      </View>
      <Body>{entry.text}</Body>
      <Actions>
        <Action
          label={preview ? 'Close preview' : 'Preview presentation'}
          primary={!preview}
          onPress={() => setPreview(!preview)}
        />
        <Action
          label={editing ? 'Cancel refinement' : 'Refine'}
          onPress={() => setEditing(!editing)}
        />
      </Actions>
      {preview && <Detail text={entry.detail} />}
      {editing && (
        <>
          <TextInput
            accessibilityLabel="Refinement request"
            placeholder="Make the strategy more focused on YouTube."
            placeholderTextColor={muted}
            value={request}
            onChangeText={setRequest}
            multiline
            style={s.input}
          />
          <Action
            label="Save refinement request"
            primary
            onPress={() => {
              if (request.trim()) {
                setSubmitted(request.trim());
                setEditing(false);
              }
            }}
          />
        </>
      )}
      {submitted && (
        <Detail
          text={`Revision requested: ${submitted}\nSaved in this preview only; no actual file was modified.`}
        />
      )}
    </View>
  );
}
export function BeforeAfter({ entry }: { entry: AdaptiveEntry }) {
  const [revised, setRevised] = useState(true);
  return (
    <View>
      <Meta>REVISED</Meta>
      <Heading>{entry.title}</Heading>
      <Actions>
        <Action
          label="Original"
          selected={!revised}
          onPress={() => setRevised(false)}
        />
        <Action
          label="Spur’s revision"
          selected={revised}
          onPress={() => setRevised(true)}
        />
      </Actions>
      <Detail text={revised ? entry.text : entry.detail} />
      <Meta>{entry.meta}</Meta>
    </View>
  );
}
export function NextAction({ entry }: { entry: AdaptiveEntry }) {
  const [state, setState] = useState('');
  if (state === 'dismissed')
    return (
      <View style={s.inline}>
        <Meta>Suggestion set aside.</Meta>
        <Action label="Restore suggestion" onPress={() => setState('')} />
      </View>
    );
  return (
    <View style={s.soft}>
      <Heading>{entry.title}</Heading>
      <Body>{entry.text}</Body>
      {state === 'accepted' ? (
        <>
          <Text accessibilityLiveRegion="polite" style={s.feedback}>
            Outline selected — simulated task only.
          </Text>
          <Action label="Undo next step" onPress={() => setState('')} />
        </>
      ) : (
        <Actions>
          <Action
            label="Create outline"
            primary
            onPress={() => setState('accepted')}
          />
          <Action label="Not now" onPress={() => setState('dismissed')} />
        </Actions>
      )}
    </View>
  );
}
export function AdaptivePattern({ entry }: { entry: AdaptiveEntry }) {
  switch (entry.kind) {
    case 'notification':
      return <MinimalNotification entry={entry} />;
    case 'question':
      return <InlineQuestion entry={entry} />;
    case 'todo':
      return <CompactChecklist entry={entry} />;
    case 'agent_execution':
      return <ExecutionStatus entry={entry} />;
    case 'research_report':
      return <ResearchReport entry={entry} />;
    case 'analytics':
      return <VideoAnalytics entry={entry} />;
    case 'approval':
      return <EmailApproval entry={entry} />;
    case 'recording':
      return <RecordingTimeline entry={entry} />;
    case 'choice':
      return <ChoiceSelector entry={entry} />;
    case 'schedule':
      return <ScheduleTimeline entry={entry} />;
    case 'memory_update':
      return <LearningFeedback entry={entry} />;
    case 'completion':
      return <MinimalNotification entry={entry} completed />;
    case 'action_approval':
      return <ActionApproval entry={entry} />;
    case 'completion_artifact':
      return <CompletionArtifact entry={entry} />;
    case 'visual_decision':
      return <ChoiceSelector entry={entry} visual />;
    case 'generated_deliverable':
      return <GeneratedDeliverable entry={entry} />;
    case 'comparison':
      return <BeforeAfter entry={entry} />;
    case 'next_action':
      return <NextAction entry={entry} />;
    case 'recovery':
      return <RecoveryState entry={entry} />;
    case 'task_transformation':
      return null;
  }
}
export const s = StyleSheet.create({
  fullWidth: { alignSelf: 'stretch' },
  equalActions: { flexDirection: 'row', gap: 9, marginTop: 12 },
  equalButton: { flex: 1, alignSelf: 'stretch', minWidth: 0 },
  textButton: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    paddingHorizontal: 0,
    paddingVertical: 5,
    minHeight: 38,
  },
  heroTitle: {
    fontSize: 18,
    lineHeight: 25,
    fontWeight: '600',
    color: '#252525',
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: 12,
    lineHeight: 18,
    color: '#81736A',
    textAlign: 'center',
  },
  greenText: { color: '#148348' },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 15,
    minHeight: 51,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EEEEEE',
  },
  infoValue: {
    fontSize: 13,
    lineHeight: 20,
    color: '#252525',
    flexShrink: 1,
    textAlign: 'right',
  },
  recovery: { backgroundColor: '#FBF5ED', borderRadius: 14, padding: 18 },

  whiteText: { color: '#FFF' },
  successArt: { backgroundColor: '#E5F3E9' },
  greenSegment: { backgroundColor: '#328768' },
  blueSegment: { backgroundColor: blue },
  realLine: { paddingVertical: 16 },
  realQuestion: { paddingVertical: 17 },
  dueLabel: { maxWidth: 82 },
  flex: { flex: 1, minWidth: 0 },
  inline: { flexDirection: 'row', alignItems: 'flex-start', gap: 11 },
  title: {
    color: ink,
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 25,
    letterSpacing: -0.2,
    marginBottom: 7,
  },
  message: { color: ink, fontSize: 15, lineHeight: 23, fontWeight: '500' },
  body: { color: '#626B79', fontSize: 14, lineHeight: 22, marginBottom: 9 },
  meta: { color: muted, fontSize: 11, lineHeight: 17, marginBottom: 5 },
  link: { color: blue, fontSize: 12, paddingVertical: 9 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 9 },
  button: {
    minHeight: 44,
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    marginVertical: 3,
    borderWidth: 1,
    borderColor: '#DDDDDD',
  },
  primary: { backgroundColor: '#101010', borderColor: '#101010' },
  selected: { borderColor: blue, backgroundColor: '#F0F5FF', borderWidth: 1 },
  action: { color: '#555555', fontSize: 13, fontWeight: '500' },
  detail: {
    backgroundColor: '#F6F7F8',
    borderRadius: 12,
    padding: 15,
    marginVertical: 10,
  },
  detailText: { color: '#455164', fontSize: 14, lineHeight: 24 },
  feedback: {
    color: '#34785C',
    fontSize: 12,
    lineHeight: 20,
    marginTop: 8,
    marginBottom: 5,
  },
  panel: { borderWidth: 1, borderColor: line, borderRadius: 20, padding: 18 },
  soft: { backgroundColor: '#F6F7F8', borderRadius: 18, padding: 18 },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 57,
    borderBottomColor: line,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  listTitle: { color: ink, fontSize: 14, fontWeight: '500', lineHeight: 21 },
  checkTarget: { width: 44, height: 48, justifyContent: 'center' },
  checkbox: {
    width: 19,
    height: 19,
    borderWidth: 1,
    borderColor: '#BAC2CD',
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checked: { backgroundColor: '#328768', borderColor: '#328768' },
  struck: { textDecorationLine: 'line-through', color: muted },
  execution: {
    borderLeftWidth: 2,
    borderLeftColor: blue,
    paddingLeft: 17,
    paddingVertical: 4,
  },
  segments: { flexDirection: 'row', gap: 5, marginVertical: 13 },
  segment: { height: 3, flex: 1, borderRadius: 2, backgroundColor: '#E5EAF1' },
  editorial: {
    borderRadius: 19,
    borderWidth: 1,
    borderColor: line,
    overflow: 'hidden',
    backgroundColor: colors.white,
  },
  cover: { width: '100%', aspectRatio: 1.9 },
  editorialBody: { padding: 16 },
  reportTitle: {
    color: ink,
    fontSize: 24,
    fontWeight: '600',
    lineHeight: 31,
    letterSpacing: -0.8,
    marginVertical: 8,
  },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 8 },
  badge: {
    color: '#77818F',
    fontSize: 10,
    backgroundColor: '#F3F5F7',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 5,
  },
  analytics: { paddingVertical: 7 },
  metricRow: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  metric: { color: ink, fontSize: 35, fontWeight: '600', letterSpacing: -1 },
  unit: { fontSize: 14, fontWeight: '400', color: muted },
  growth: { color: '#328768', fontSize: 13, fontWeight: '600' },
  days: { flexDirection: 'row' },
  day: {
    flex: 1,
    minHeight: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  dayText: { color: muted, fontSize: 10 },
  quote: { color: '#455164', fontSize: 16, lineHeight: 26, marginTop: 12 },
  timelineRow: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 12,
    minHeight: 44,
    borderLeftWidth: 1,
    borderLeftColor: '#DDE4EE',
    marginLeft: 7,
    paddingLeft: 16,
  },
  timelineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: blue,
    marginTop: 7,
  },
  horizontal: { gap: 10, paddingVertical: 12, paddingRight: 8 },
  choice: {
    width: 208,
    padding: 16,
    borderWidth: 1,
    borderColor: line,
    borderRadius: 14,
  },
  optionNumber: { color: '#A4AEBE', fontSize: 12, marginBottom: 16 },
  optionText: { padding: 9 },
  visualGrid: { flexDirection: 'row', gap: 10, marginTop: 12 },
  visualOption: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderColor: line,
    borderRadius: 12,
    overflow: 'hidden',
  },
  thumbnail: { width: '100%', aspectRatio: 4 / 3 },
  schedule: { flexDirection: 'row', minHeight: 66, gap: 16 },
  time: { color: ink, fontSize: 13, width: 45, paddingTop: 14 },
  scheduleContent: {
    flex: 1,
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 12,
    paddingLeft: 13,
    borderLeftWidth: 1,
    borderLeftColor: '#DFE4EB',
  },
  input: {
    backgroundColor: '#F4F6F8',
    borderRadius: 12,
    padding: 13,
    minHeight: 100,
    color: ink,
    fontSize: 14,
    lineHeight: 22,
    textAlignVertical: 'top',
    marginVertical: 12,
  },
  art: {
    backgroundColor: '#F7E7DE',
    minHeight: 123,
    paddingVertical: 19,
    gap: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileIcon: {
    width: 49,
    height: 60,
    borderRadius: 10,
    backgroundColor: '#EDF2FD',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
