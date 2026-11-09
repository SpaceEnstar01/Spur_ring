import type { AgentEntry } from '../components/AgentDashboard';
import type { IntentItem } from './model';
// Adapts existing answers visually only; it does not classify obligations or reminders.
export function legacyPresentation(entry: AgentEntry): IntentItem {
  const source = entry.file?.transcript || entry.text;
  const answer = entry.file?.aiReply || '';
  const isScript =
    /脚本|分镜|script|storyboard/i.test(source) &&
    /旁白|镜头|分镜|开场|台词|spoken script|voiceover|scene|opening hook/i.test(
      answer,
    ) &&
    answer.length > 200;
  return {
    id: `existing:${entry.id}`,
    matterId: '',
    sourceKey: entry.id,
    revision: 1,
    kind: 'question',
    frame: isScript ? 'script' : 'report',
    title: entry.title,
    summary:
      entry.file?.aiReply
        ?.replace(/[#*`]/g, '')
        .replace(/\s+/g, ' ')
        .slice(0, 220) || entry.text,
    sourceSpan: source,
    confidence: 0,
    actor: '',
    counterparty: '',
    deliverable: '',
    direction: 'unknown',
    dateText: '',
    sections: [
      {
        heading: isScript
          ? 'Your existing creative draft'
          : 'Your existing analysis',
        body: entry.file?.aiReply || '',
      },
    ],
    checklist: [],
    questions: [],
    email: null,
    change: 'update',
    state: 'ready',
    reason: 'Existing answer, unchanged.',
    createdAt: entry.time,
    updatedAt: entry.file?.aiReplyCompletedAt || entry.time,
    read: true,
    archived: false,
    pinned: false,
    history: [],
  };
}
