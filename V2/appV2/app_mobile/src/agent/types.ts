export type IntentKind =
  | 'idea'
  | 'decision'
  | 'commitment'
  | 'instruction'
  | 'correction'
  | 'unknown';
export type AgentIntent = {
  id: string;
  type: IntentKind;
  span: string;
  summary: string;
  matterId: string | null;
  question: string | null;
  confidence: number;
  processingStatus: string;
  targetActionId: string | null;
  counterparty?: string | null;
  deliverable?: string | null;
  targetTaskId?: string | null;
  targetEventId?: string | null;
};
export type DeliveryTask = {
  id: string;
  recordId: string;
  intentId: string;
  matterId: string | null;
  counterparty: string | null;
  deliverable: string | null;
  direction: string | null;
  dateText: string | null;
  dueDate: string | null;
  dateOmitted: boolean;
  timezone: string;
  state: string;
  reason: string;
  version: number;
  history: {
    version: number;
    recordedAt: number;
    state: string;
    counterparty: string | null;
    deliverable: string | null;
    direction: string | null;
    dueDate: string | null;
    reason: string;
    actor: string;
  }[];
};
export const taskLabels: Record<string, string> = {
  needs_user: '待补充',
  open: '内部待交付',
  paused: '已暂停 · 需复核',
  completed: '用户标记完成',
  cancelled: '已取消',
  superseded: '旧版本 · 不再推进',
};
export type Capture = {
  id: string;
  clientId: string;
  revision: number;
  transcript: string;
  capturedAt: number;
  status: string;
  error: string | null;
  source: string;
  intents: AgentIntent[];
  timezone: string;
  timeTrusted: boolean;
};
export type AgentAction = {
  id: string;
  recordId: string;
  intentId: string | null;
  tool: string;
  title: string;
  state: string;
  reason: string;
  version: number;
  fireAt: number | null;
  targetAlarmId: string | null;
  dependsOn: string | null;
  expiresAt: number;
};
export type Workspace = {
  schemaVersion: number;
  version: number;
  alarmAuthorizedSince: number | null;
  records: Capture[];
  actions: AgentAction[];
  tasks?: DeliveryTask[];
  matters: {
    id: string;
    title: string;
    status: string;
    direction: string | null;
    sourceIds: string[];
    version?: number;
  }[];
  memories: {
    id: string;
    recordId: string;
    content: string;
    evidence: string;
    status: string;
  }[];
  events: {
    id: string;
    type: string;
    recordId: string | null;
    value: string;
    reason: string;
    recordedAt: number;
    matterId?: string | null;
    intentId?: string | null;
    supersedes?: string | null;
  }[];
};
export type Ticket = {
  deviceId: string;
  actionId: string;
  actionVersion: number;
  attemptId: string;
  token: string;
  expiresAt: number;
  mode: 'execute' | 'reconcile';
  tool: string;
  fireAt: number | null;
  targetAlarmId: string | null;
  title: string;
};
export type Receipt = {
  attemptId: string;
  token: string;
  outcome: 'scheduled' | 'cancelled' | 'unknown' | 'absent';
  systemAlarmId: string;
  detail: string;
};
export const kindLabels: Record<IntentKind, string> = {
  idea: '想法',
  decision: '决定',
  commitment: '承诺',
  instruction: '指令',
  correction: '纠错',
  unknown: '待澄清',
};
export const actionLabels: Record<string, string> = {
  needs_user: '等你确认',
  ready: '等待手机执行',
  dispatched: '设备核验中',
  unknown: '结果待核对',
  failed: '执行未完成',
  scheduled: '系统已确认创建',
  cancel_requested: '等待取消回执',
  cancelled: '已取消',
  superseded: '已被修正',
  ended: '已结束或已从系统移除',
};
export function cloudCaptureSummary(w: Workspace, r: Capture) {
  if (['received', 'interpreting'].includes(r.status))
    return '文字已保存，Agent 正在分析；完成后会自动显示回复，无需重复提交。';
  if (r.status === 'failed')
    return `转写文字已保存，AI 回复暂未完成：${
      r.error || '请在 agent 重试'
    }。无需重新录音或转写，可稍后重试 AI 分析。`;
  return [
    '### Spur agent',
    ...r.intents.map(
      i =>
        `**${
          i.processingStatus === 'answered' ? 'AI 回复' : kindLabels[i.type]
        }** · ${i.summary}\n\n${
          i.question ||
          (i.processingStatus === 'answered'
            ? ''
            : i.processingStatus === 'updated'
            ? '已更新内部事项，不代表外部操作完成。'
            : '请在 agent 核对下一步。')
        }`,
    ),
    ...w.actions
      .filter(a => a.recordId === r.id)
      .map(
        a =>
          `**${actionLabels[a.state] || a.state}** · ${a.title}\n\n${
            a.reason || ''
          }`,
      ),
    ...(w.tasks || [])
      .filter(t => t.recordId === r.id && t.state !== 'deleted')
      .map(
        t =>
          `**${taskLabels[t.state] || t.state}** · ${
            t.deliverable || '待补充交付物'
          }\n\n对象：${t.counterparty || '待补充'}；日期：${
            t.dueDate || t.dateText || '待确认'
          }。${t.reason}`,
      ),
  ].join('\n\n');
}
export function effectiveDecisions(w: Workspace) {
  const revoked = new Set(
    w.events
      .filter(e => e.type === 'InterpretationEffectRevoked')
      .map(e => e.supersedes),
  );
  const current = new Map<string, Workspace['events'][number]>();
  w.events.forEach(e => {
    if (
      e.type === 'DecisionRecorded' &&
      e.matterId &&
      !revoked.has(e.id) &&
      !w.records.some(r => r.id === e.recordId && r.status === 'redacted')
    )
      current.set(e.matterId, e);
  });
  return [...current.values()];
}
