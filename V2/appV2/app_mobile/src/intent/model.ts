import { presentations, Presentation, CaptureMetric } from './presentation';
export const kinds = [
  'idea',
  'decision',
  'commitment',
  'instruction',
  'correction',
  'progress',
  'question',
  'unknown',
] as const;
export type IntentKind = (typeof kinds)[number];
export const frames = [
  'idea',
  'decision',
  'commitment',
  'reminder',
  'clarification',
  'email',
  'report',
  'script',
] as const;
export type Frame = (typeof frames)[number];
export const states = [
  'recorded',
  'needs_clarification',
  'preparing',
  'ready',
  'needs_confirmation',
  'pending',
  'working',
  'waiting',
  'completed',
  'failed',
  'paused',
  'cancelled',
  'superseded',
] as const;
export type ItemState = (typeof states)[number];
export const stateLabels: Record<ItemState, string> = {
  recorded: 'Recorded',
  needs_clarification: 'Needs information',
  preparing: 'Preparing',
  ready: 'Ready to review',
  needs_confirmation: 'Needs approval',
  pending: 'Open',
  working: 'In progress',
  waiting: 'Waiting on someone',
  completed: 'Completed',
  failed: 'Needs retry',
  paused: 'Paused',
  cancelled: 'Cancelled',
  superseded: 'Superseded',
};
export type Source = {
  parentItemId?: string;
  parentRevision?: number;
  timeTrusted?: boolean;
  key: string;
  text: string;
  title: string;
  capturedAt: number;
  uri?: string;
  noteId?: string;
};
export type Interpretation = {
  execution?: 'research';
  presentation?: Presentation;
  metrics?: CaptureMetric[];
  kind: IntentKind;
  frame: Frame;
  title: string;
  summary: string;
  sourceSpan: string;
  confidence: number;
  actor: string;
  counterparty: string;
  deliverable: string;
  direction: 'user_owes' | 'other_owes' | 'unknown';
  dateText: string;
  sections: { heading: string; body: string }[];
  checklist: string[];
  questions: string[];
  email: { to: string; subject: string; body: string } | null;
  replacement?: string;
  change: 'update' | 'cancel' | 'complete' | 'pause' | 'replace';
};
export type History = {
  at: number;
  actor: 'user' | 'model' | 'system';
  reason: string;
  snapshot: string;
  sourceKey?: string;
};
export type IntentItem = Interpretation & {
  id: string;
  matterId: string;
  sourceKey: string;
  revision: number;
  state: ItemState;
  reason: string;
  createdAt: number;
  updatedAt: number;
  dueAt?: number;
  dueTimezone?: string;
  read: boolean;
  archived: boolean;
  pinned: boolean;
  targetId?: string;
  history: History[];
};
export type Capture = {
  previousText?: string;
  source: Source;
  revision: number;
  state: 'working' | 'done' | 'failed';
  error?: string;
  items: IntentItem[];
};
export type Envelope = { reply: string; intents: Interpretation[] };
function text(value: unknown, limit: number, required = false): string {
  if (
    typeof value !== 'string' ||
    value.length > limit ||
    (required && !value.trim())
  )
    throw new Error('Invalid text field');
  return value.trim();
}
function list(value: unknown, limit: number) {
  if (!Array.isArray(value) || value.length > limit)
    throw new Error('Invalid list');
  return value;
}
function oneOf<T extends readonly string[]>(
  value: unknown,
  choices: T,
): T[number] {
  if (typeof value !== 'string' || !choices.includes(value))
    throw new Error('Invalid classification');
  return value as T[number];
}
export function parseEnvelope(
  raw: string,
  source: string,
  selectedContext = '',
): Envelope {
  const grounding = source + '\n' + selectedContext;
  const content = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
  const parsed = JSON.parse(content);
  const reply = text(parsed.reply, 28000, true);
  const intents = list(parsed.intents, 8).map(
    (value: unknown): Interpretation => {
      if (!value || typeof value !== 'object')
        throw new Error('Invalid intent');
      const item = value as Record<string, unknown>;
      const kind = oneOf(item.kind, kinds),
        frame = oneOf(item.frame, frames);
      const confidence = item.confidence;
      if (
        typeof confidence !== 'number' ||
        !Number.isFinite(confidence) ||
        confidence < 0 ||
        confidence > 1
      )
        throw new Error('Invalid confidence');
      const span = text(item.sourceSpan, 8000, true);
      if (!source.includes(span))
        throw new Error('Intent has no exact source evidence');
      if (kind === 'idea' && frame !== 'idea')
        throw new Error('An idea cannot become an action');
      if (kind === 'decision' && !['decision', 'clarification'].includes(frame))
        throw new Error('A decision is not execution permission');
      if (
        kind === 'commitment' &&
        !['commitment', 'clarification'].includes(frame)
      )
        throw new Error('A promise is not an action');
      const dateText = text(item.dateText ?? '', 150);
      const email =
        item.email == null ? null : (item.email as Record<string, unknown>);
      const interpretation: Interpretation = {
        presentation:
          typeof item.presentation === 'string' &&
          presentations.includes(item.presentation as Presentation)
            ? (item.presentation as Presentation)
            : undefined,
        metrics: [],
        kind: confidence < 0.75 ? 'unknown' : kind,
        frame: confidence < 0.75 ? 'clarification' : frame,
        confidence,
        title: text(item.title, 180, true),
        summary: text(item.summary, 2500, true),
        sourceSpan: span,
        actor: text(item.actor ?? '', 160),
        counterparty: text(item.counterparty ?? '', 160),
        deliverable: text(item.deliverable ?? '', 300),
        direction: oneOf(item.direction ?? 'unknown', [
          'user_owes',
          'other_owes',
          'unknown',
        ] as const),
        dateText: dateText && source.includes(dateText) ? dateText : '',
        sections: list(item.sections ?? [], 20).map(section => ({
          heading: text(section.heading, 180, true),
          body: text(section.body, 7000, true),
        })),
        checklist: list(item.checklist ?? [], 20).map(step =>
          text(step, 1000, true),
        ),
        questions:
          kind === 'idea' && confidence >= 0.75
            ? []
            : list(item.questions ?? [], 10).map(question =>
                text(question, 500, true),
              ),
        email: email
          ? {
              to: text(email.to ?? '', 300),
              subject: text(email.subject ?? '', 300),
              body: text(email.body ?? '', 12000),
            }
          : null,
        replacement:
          typeof item.replacement === 'string' &&
          item.replacement.length <= 1000 &&
          source.includes(item.replacement)
            ? item.replacement
            : '',
        change: oneOf(item.change ?? 'update', [
          'update',
          'cancel',
          'complete',
          'pause',
          'replace',
        ] as const),
      };
      if (interpretation.kind === 'unknown' && !interpretation.questions.length)
        interpretation.questions.push(
          'What would you like Spur to do with this capture?',
        );
      if (Array.isArray(item.metrics)) {
        interpretation.metrics = item.metrics
          .slice(0, 6)
          .flatMap((metric: unknown) => {
            if (!metric || typeof metric !== 'object') return [];
            const m = metric as Record<string, unknown>;
            if (
              typeof m.label !== 'string' ||
              !m.label.trim() ||
              m.label.length > 80 ||
              typeof m.value !== 'number' ||
              !Number.isFinite(m.value) ||
              typeof m.unit !== 'string' ||
              m.unit.length > 20 ||
              typeof m.sourceSpan !== 'string' ||
              !m.sourceSpan.trim() ||
              !source.includes(m.sourceSpan)
            )
              return [];
            const evidence = m.sourceSpan.replace(
              /\d{1,3}(?:,\d{3})+(?:\.\d+)?/g,
              n => n.replace(/,/g, ''),
            );
            const hasNumber = (numeric: number) =>
              new RegExp(
                '(^|[^0-9.])' +
                  String(numeric).replace(/\./g, '\\.') +
                  '([^0-9.]|$)',
              ).test(evidence);
            if (
              !hasNumber(m.value) ||
              (m.unit && !m.sourceSpan.includes(m.unit))
            )
              return [];
            if (
              m.baseline !== undefined &&
              (typeof m.baseline !== 'number' ||
                !Number.isFinite(m.baseline) ||
                !hasNumber(m.baseline))
            )
              return [];
            return [
              {
                label: m.label.trim(),
                value: m.value,
                unit: m.unit,
                baseline: m.baseline as number | undefined,
                sourceSpan: m.sourceSpan,
              },
            ];
          });
      }
      const groundedPerson = (name: string) =>
        !name ||
        (['user', 'you', '我', '本人'].includes(name.toLowerCase())
          ? /我|本人|\b(?:I|my|me)\b/i.test(grounding)
          : grounding.includes(name));
      if (!groundedPerson(interpretation.actor)) interpretation.actor = '';
      if (!groundedPerson(interpretation.counterparty))
        interpretation.counterparty = '';
      if (
        interpretation.deliverable &&
        !grounding.includes(interpretation.deliverable)
      )
        interpretation.deliverable = '';
      if (frame === 'commitment') {
        if (
          !interpretation.actor ||
          !interpretation.counterparty ||
          interpretation.direction === 'unknown'
        )
          interpretation.questions.push('Who owes the delivery, and to whom?');
        if (!interpretation.deliverable)
          interpretation.questions.push('What needs to be delivered?');
      }
      // Names and addresses are proposals. The client never treats them as authority.
      if (
        frame === 'email' &&
        (!interpretation.email?.to || !source.includes(interpretation.email.to))
      ) {
        if (interpretation.email) interpretation.email.to = '';
        interpretation.questions.push(
          'Which verified email address should this draft be addressed to?',
        );
      }
      if (
        item.execution === 'research' &&
        interpretation.kind === 'instruction' &&
        interpretation.frame === 'report' &&
        !interpretation.questions.length &&
        confidence >= 0.9
      )
        interpretation.execution = 'research';
      return interpretation;
    },
  );
  return { reply, intents };
}
export function initialState(item: Interpretation): ItemState {
  if (item.kind === 'idea') return 'recorded';
  if (
    item.kind === 'correction' ||
    item.kind === 'progress' ||
    item.questions.length ||
    item.frame === 'clarification'
  )
    return 'needs_clarification';
  if (item.frame === 'reminder') return 'needs_clarification'; // User must confirm a concrete time.
  if (item.frame === 'email') return 'needs_confirmation';
  if (item.frame === 'commitment')
    return item.direction === 'other_owes' ? 'waiting' : 'pending';
  if (item.frame === 'decision') return 'recorded';
  return 'ready';
}
export function needsAttention(item: IntentItem) {
  if (
    item.archived ||
    ['completed', 'cancelled', 'superseded', 'paused'].includes(item.state) ||
    item.kind === 'idea'
  )
    return false;
  return (
    ['needs_clarification', 'needs_confirmation', 'failed'].includes(
      item.state,
    ) ||
    (!!item.dueAt && item.dueAt <= Date.now() + 86400000)
  );
}
export function parseLocalTime(value: string) {
  const parts = value.trim().match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/);
  if (!parts)
    throw new Error('Use YYYY-MM-DD HH:mm in your phone’s local time.');
  const [y, m, d, h, min] = parts.slice(1).map(Number);
  const date = new Date(y, m - 1, d, h, min);
  if (
    date.getFullYear() !== y ||
    date.getMonth() !== m - 1 ||
    date.getDate() !== d ||
    date.getHours() !== h ||
    date.getMinutes() !== min
  )
    throw new Error('Invalid date or time.');
  return date.getTime();
}
