import type { IntentItem } from './model';
export const presentations = [
  'idea',
  'decision',
  'commitment',
  'reminder',
  'analytics',
  'report',
  'script',
  'email',
  'partnership',
  'clarification',
] as const;
export type Presentation = (typeof presentations)[number];
export type CaptureMetric = {
  label: string;
  value: number;
  baseline?: number;
  unit: string;
  sourceSpan: string;
};
const compatible: Record<Presentation, string[]> = {
  idea: ['idea'],
  decision: ['decision'],
  commitment: ['commitment'],
  reminder: ['reminder'],
  analytics: ['report'],
  report: ['report'],
  script: ['script'],
  email: ['email'],
  partnership: ['email', 'report'],
  clarification: ['clarification'],
};
// Visual selection never creates a task, changes authority, or runs an action.
export function presentationFor(item: IntentItem): Presentation {
  if (item.kind === 'idea') return 'idea';
  if (
    ['correction', 'progress', 'unknown'].includes(item.kind) ||
    item.frame === 'clarification'
  )
    return 'clarification';
  if (
    item.presentation &&
    presentations.includes(item.presentation) &&
    compatible[item.presentation].includes(item.frame)
  )
    return item.presentation;
  const topic = [item.title, item.sourceSpan, item.summary].join(' ');
  if (
    ['email', 'report'].includes(item.frame) &&
    /品牌合作|商务合作|广告合作|商业合作|赞助|brand partnership|sponsor|outreach/i.test(
      topic,
    )
  )
    return 'partnership';
  if (
    item.frame === 'report' &&
    (item.metrics?.length ||
      /数据分析|数据对比|留存|播放量|转化率|performance|analytics|retention|engagement/i.test(
        topic,
      ))
  )
    return 'analytics';
  return item.frame;
}
export const cardTheme: Record<
  Presentation,
  {
    background: string;
    accent: string;
    icon: string;
    label: string;
    action: string;
  }
> = {
  idea: {
    background: '#F7F5FC',
    accent: '#8C76AD',
    icon: 'sparkles',
    label: 'A thought worth keeping',
    action: 'Explore Thought',
  },
  decision: {
    background: '#F0F6F0',
    accent: '#638A6F',
    icon: 'check',
    label: 'Your direction is set',
    action: 'Review Decision',
  },
  commitment: {
    background: '#FFF7EC',
    accent: '#BA8A42',
    icon: 'users',
    label: 'A commitment to keep',
    action: 'Review Delivery',
  },
  reminder: {
    background: '#FFF2ED',
    accent: '#C88368',
    icon: 'clock',
    label: 'Keep this on your radar',
    action: 'Review Reminder',
  },
  analytics: {
    background: '#EEF5FF',
    accent: '#5485C6',
    icon: 'analytics',
    label: 'Your agent has an update',
    action: 'View Performance Report',
  },
  report: {
    background: '#F1F5FA',
    accent: '#6D89AA',
    icon: 'note',
    label: 'Your agent has prepared',
    action: 'Read Report',
  },
  script: {
    background: '#FFF1F6',
    accent: '#BC7C96',
    icon: 'play',
    label: 'Your next story takes shape',
    action: 'Open Script & Shot List',
  },
  email: {
    background: '#FFF9EF',
    accent: '#B0925C',
    icon: 'mail',
    label: 'Ready for your review',
    action: 'Review Email Draft',
  },
  partnership: {
    background: '#EEF7F5',
    accent: '#5C968C',
    icon: 'link',
    label: 'Your partnership workspace',
    action: 'Review Opportunity',
  },
  clarification: {
    background: '#F5F3FD',
    accent: '#9380BA',
    icon: 'sparkles',
    label: 'A little input from you',
    action: 'Add Information',
  },
};
