import type { IntentItem } from './model';
export type Interaction =
  | 'thought'
  | 'paused'
  | 'status'
  | 'change'
  | 'question'
  | 'confirm'
  | 'checklist'
  | 'delivery';
// Workflow state takes precedence over presentation; a visual choice grants no authority.
export function interactionFor(item: IntentItem): Interaction {
  if (item.state === 'paused') return 'paused';
  if (['completed', 'cancelled', 'superseded'].includes(item.state))
    return 'delivery';
  if (item.kind === 'idea') return 'thought';
  if (['working', 'preparing'].includes(item.state)) return 'status';
  if (['correction', 'progress'].includes(item.kind)) return 'change';
  if (item.frame === 'reminder' && !item.dueAt) return 'confirm';
  if (item.questions.length || ['clarification'].includes(item.frame))
    return 'question';
  if (item.frame === 'decision') return 'confirm';
  if (
    item.checklist.length &&
    !item.sections.length &&
    !item.email &&
    !item.metrics?.length
  )
    return 'checklist';
  return 'delivery';
}

// These are proposed answers, not extracted facts. Only an explicit tap selects one.
export function answerChoices(question: string): string[] {
  if (/受众|读者|给谁看|audience|who.*(?:read|for)/i.test(question))
    return ['Brand partner', 'My team', 'Just for me'];
  if (/室内|户外|拍摄地点|filming location|where.*film/i.test(question))
    return ['Indoors', 'Outdoors', 'Both'];
  if (/语气|tone of|which tone|what tone/i.test(question))
    return ['Friendly', 'Professional', 'More direct'];
  return [];
}
