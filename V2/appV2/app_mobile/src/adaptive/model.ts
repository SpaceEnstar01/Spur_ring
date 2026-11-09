import type { IntentItem } from '../intent/model';
export const patternKinds = [
  'notification',
  'question',
  'todo',
  'agent_execution',
  'research_report',
  'analytics',
  'approval',
  'recording',
  'choice',
  'schedule',
  'memory_update',
  'completion',
  'action_approval',
  'completion_artifact',
  'visual_decision',
  'generated_deliverable',
  'comparison',
  'next_action',
  'recovery',
  'task_transformation',
] as const;
export type PatternKind = (typeof patternKinds)[number];
export type AdaptiveEntry = {
  id: string;
  kind: PatternKind;
  title: string;
  text: string;
  meta?: string;
  detail?: string;
  options?: { title: string; subtitle: string }[];
};
// View selection grants no authority and never creates another task or model request.
export function presentationForTask(item: IntentItem): PatternKind {
  if (item.state === 'completed')
    return item.sections.length ? 'completion_artifact' : 'completion';
  if (['working', 'preparing'].includes(item.state)) return 'agent_execution';
  if (item.kind === 'idea') return 'notification';
  if (item.questions.length || item.state === 'needs_clarification')
    return 'question';
  if (item.frame === 'email') return 'approval';
  if (item.metrics?.length) return 'analytics';
  if (item.frame === 'report') return 'research_report';
  if (item.frame === 'script') return 'generated_deliverable';
  if (item.frame === 'commitment' || item.frame === 'reminder') return 'todo';
  return 'notification';
}
