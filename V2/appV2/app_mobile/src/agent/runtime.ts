import { JAVA_AGENT_ENABLED } from '../config/backend';
import { AppState, NativeModules } from 'react-native';
import { create } from 'zustand';
import { getApiUrl } from '../services/chatApi';
import { useRecordingStore } from '../ring/store/useRecordingStore';
import { useRingStore } from '../ring/store/useRingStore';
import { recordingKey } from '../ring/recordingIdentity';
import type { RingRecording } from '../ring/types';
import { agentRequest, newAgentId, readSecure, writeSecure } from './client';
import {
  cloudOwnsRecording,
  eligibleForAutomaticUpload,
  loadAgentSettings,
  saveAgentSettings,
  useAgentSettings,
} from './settings';
import { cloudCaptureSummary } from './types';
import type { AgentAction, Receipt, Ticket, Workspace } from './types';

export const useAgentRuntime = create<{
  workspace: Workspace | null;
  busy: boolean;
  error: string;
}>(() => ({ workspace: null, busy: false, error: '' }));
const alarm = () => {
  if (!NativeModules.SpurAlarm) throw new Error('当前版本未提供系统闹钟工具');
  return NativeModules.SpurAlarm as {
    status(): Promise<{ supported: boolean; authorized: boolean }>;
    authorize(): Promise<boolean>;
    list(): Promise<string[]>;
    schedule(id: string, timestamp: number, title: string): Promise<boolean>;
    cancel(id: string): Promise<boolean>;
  };
};
let queue: Promise<unknown> = Promise.resolve();
function serial<T>(job: () => Promise<T>) {
  const next = queue.then(async () => {
    useAgentRuntime.setState({ busy: true, error: '' });
    try {
      await loadAgentSettings();
      return await job();
    } catch (e) {
      useAgentRuntime.setState({ error: (e as Error).message });
      throw e;
    } finally {
      useAgentRuntime.setState({ busy: false });
    }
  });
  queue = next.catch(() => {});
  return next;
}
function accept(w: Workspace) {
  if (
    w?.schemaVersion !== 1 ||
    !Array.isArray(w.records) ||
    !Array.isArray(w.actions) ||
    !Array.isArray(w.matters) ||
    !Array.isArray(w.events)
  )
    throw new Error('Agent 数据版本不兼容，已停止执行');
  useAgentRuntime.setState({ workspace: w });
  // The cloud agent and recording library are two views of the same reply.
  // Mirror only the exact bound source revision; do not overwrite edited text.
  for (const binding of useAgentSettings.getState().bindings) {
    const record = w.records.find(
      r =>
        r.clientId === binding.clientId &&
        r.revision === binding.revision &&
        r.transcript === binding.transcript,
    );
    const file = useRecordingStore
      .getState()
      .files.find(
        f =>
          recordingKey(f.uri) === binding.key &&
          f.transcript?.trim() === binding.transcript,
      );
    if (
      !record ||
      !file ||
      !['received', 'interpreting', 'understood', 'failed'].includes(
        record.status,
      )
    )
      continue;
    const summary = cloudCaptureSummary(w, record);
    const replyState = ['received', 'interpreting'].includes(record.status)
      ? 'working'
      : record.status === 'failed'
      ? 'failed'
      : 'done';
    const error =
      record.status === 'failed'
        ? record.error || 'Agent 分析未完成，请在 agent 中重试'
        : undefined;
    if (
      file.aiReply !== summary ||
      file.aiReplyState !== replyState ||
      file.aiReplyError !== error
    )
      useRecordingStore.getState().setReply(file.uri, {
        aiReply: summary,
        aiReplyState: replyState,
        aiReplyError: error,
      });
  }
  return w;
}
const state = async () => accept(await agentRequest<Workspace>('/workspace'));
let pauseRequested = false;
const enabled = () =>
  !pauseRequested && useAgentSettings.getState().enabledAt !== null;
const zone = () =>
  Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai';
export async function enableCloudAgent() {
  return serial(async () => {
    const base = await getApiUrl();
    const saved = useAgentSettings.getState();
    if (saved.base && saved.base !== base && saved.bindings.length)
      throw new Error('请恢复原服务地址；已有执行状态不能迁移到另一个服务');
    const cap = await agentRequest<{ enabled: boolean; schemaVersion: number }>(
      '/capabilities',
      undefined,
      base,
    );
    if (!cap.enabled || cap.schemaVersion !== 1)
      throw new Error(
        '服务器尚未启用持久化 Agent，请先部署 Java 与数据库；现有录音仍保留在本机',
      );
    if (!(await readSecure(base))) {
      const identity = await agentRequest<{ deviceId: string; token: string }>(
        '/devices',
        {},
        base,
      );
      if (
        !/^[0-9a-f-]{36}$/i.test(identity.deviceId) ||
        !/^[A-Za-z0-9_-]{43}$/.test(identity.token)
      )
        throw new Error('设备身份格式无效');
      await writeSecure(base, identity); // Fail closed: no uploads or OS calls before secure persistence.
    }
    await saveAgentSettings({ base });
    accept(
      await agentRequest<Workspace>('/policy', { alarmAutomation: false }),
    );
    await saveAgentSettings({
      base,
      enabledAt: Date.now(),
      excluded: useRecordingStore
        .getState()
        .files.map(f => recordingKey(f.uri)),
    });
    pauseRequested = false;
    return state();
  });
}
export function pauseCloudAgent() {
  pauseRequested = true;
  return serial(async () => {
    // Stop locally even if revoking the remote policy is temporarily unavailable.
    await saveAgentSettings({ enabledAt: null });
    accept(
      await agentRequest<Workspace>('/policy', { alarmAutomation: false }),
    );
  });
}
export function setCloudAlarmPolicy(allowed: boolean) {
  return serial(async () => {
    if (!enabled()) throw new Error('请先开启云端 Agent');
    if (allowed && !(await alarm().authorize()))
      throw new Error('未取得系统闹钟权限');
    accept(
      await agentRequest<Workspace>('/policy', { alarmAutomation: allowed }),
    );
  });
}
async function upload(file: RingRecording, manual = false) {
  if (!enabled() || !file.transcript?.trim()) return;
  if (
    !manual &&
    !eligibleForAutomaticUpload(file) &&
    !useAgentSettings
      .getState()
      .bindings.some(b => b.key === recordingKey(file.uri))
  )
    return;
  const transcript = file.transcript.trim();
  if (transcript.length > 8000) throw new Error('转写超过 8000 字，请分段处理');
  const s = useAgentSettings.getState(),
    key = recordingKey(file.uri);
  let binding = s.bindings.find(b => b.key === key);
  const previous = useAgentRuntime
    .getState()
    .workspace?.records.filter(r => r.clientId === binding?.clientId)
    .sort((a, b) => b.revision - a.revision)[0];
  if (previous?.status === 'redacted') {
    if (!manual) return; // A cloud deletion is a tombstone, not an invitation to auto-upload again.
    binding = undefined; // Explicit re-submission creates a new source, never resurrects the old audit chain.
  }
  if (
    binding?.transcript === transcript &&
    previous?.revision === binding.revision
  )
    return;
  if (!binding || binding.transcript !== transcript) {
    binding = {
      key,
      clientId: binding?.clientId || (await newAgentId()),
      revision: (binding?.revision || 0) + 1,
      transcript,
    };
    await saveAgentSettings({
      bindings: [...s.bindings.filter(b => b.key !== key), binding],
    });
  }
  const at = file.source === 'phone' ? file.timestamp : file.commandRecordedAt;
  accept(
    await agentRequest<Workspace>('/records', {
      clientRecordId: binding.clientId,
      revision: binding.revision,
      transcript,
      capturedAt: at ?? file.timestamp,
      timezone: zone(),
      source: file.source || 'import',
      timeTrusted: at !== undefined,
    }),
  );
}
function ownsAction(a: AgentAction, w: Workspace) {
  const s = useAgentSettings.getState();
  if (s.explicitActions.includes(a.id)) return true;
  const r = w.records.find(row => row.id === a.recordId);
  return (
    !!r &&
    s.bindings.some(b => b.clientId === r.clientId && b.revision === r.revision)
  );
}
export function validateAgentTicket(
  t: Ticket,
  a: AgentAction,
  deviceId: string,
  now = Date.now(),
) {
  if (
    !t ||
    t.deviceId !== deviceId ||
    t.actionId !== a.id ||
    t.actionVersion !== a.version ||
    !/^[0-9a-f-]{36}$/i.test(t.actionId) ||
    !/^[0-9a-f-]{36}$/i.test(t.attemptId) ||
    !/^[A-Za-z0-9_-]{43}$/.test(t.token) ||
    !Number.isFinite(t.expiresAt) ||
    t.expiresAt <= now ||
    t.expiresAt > now + 65000 ||
    !['execute', 'reconcile'].includes(t.mode) ||
    !['alarm.create', 'alarm.cancel'].includes(t.tool) ||
    t.tool !== a.tool ||
    t.fireAt !== a.fireAt ||
    t.targetAlarmId !== a.targetAlarmId ||
    typeof t.title !== 'string' ||
    t.title.length > 600 ||
    (t.tool === 'alarm.create' &&
      (!Number.isFinite(t.fireAt) ||
        (t.mode === 'execute' && t.fireAt! <= now + 5000))) ||
    (t.tool === 'alarm.cancel' &&
      !/^[0-9a-f-]{36}$/i.test(t.targetAlarmId || ''))
  )
    throw new Error('执行许可与本机动作不匹配，已停止操作');
}
// Durable receipt outbox is flushed before any new claim; interrupted calls only reconcile.
async function flushOutbox() {
  const base = useAgentSettings.getState().base,
    secure = await readSecure(base);
  if (!secure?.pending) return;
  const p = secure.pending;
  if (!p.receipt) {
    const status = await alarm().status();
    if (!status.supported || !status.authorized)
      throw new Error('系统权限不可用，执行结果待核对；不会自动重建');
    const ids = await alarm().list();
    const id =
      p.ticket.tool === 'alarm.create'
        ? p.ticket.actionId
        : p.ticket.targetAlarmId!;
    const present = ids.some(x => x.toLowerCase() === id.toLowerCase());
    p.receipt = {
      attemptId: p.ticket.attemptId,
      token: p.ticket.token,
      systemAlarmId: id,
      outcome:
        p.ticket.tool === 'alarm.create'
          ? present
            ? 'scheduled'
            : 'absent'
          : present
          ? 'unknown'
          : 'absent',
      detail: '中断后已查询系统；不重复调用创建或取消',
    };
    await writeSecure(base, secure);
  }
  accept(
    await agentRequest<Workspace>(
      `/actions/${p.ticket.actionId}/receipt`,
      p.receipt,
    ),
  );
  delete secure.pending;
  await writeSecure(base, secure);
}
async function execute(a: AgentAction) {
  const base = useAgentSettings.getState().base,
    secure = await readSecure(base);
  if (!secure || secure.pending) throw new Error('请先核对上一条系统操作');
  const status = await alarm().status();
  if (!status.supported || !status.authorized)
    throw new Error('请在动作卡片确认系统闹钟权限（需要 iOS 26）');
  const t = await agentRequest<Ticket>(`/actions/${a.id}/claim`, {
    version: a.version,
  });
  validateAgentTicket(t, a, secure.deviceId);
  secure.pending = { ticket: t };
  await writeSecure(base, secure);
  const id = t.tool === 'alarm.create' ? t.actionId : t.targetAlarmId!;
  let outcome: Receipt['outcome'] = 'unknown',
    detail = '设备操作未确认，请核对系统状态';
  try {
    if (!enabled() || AppState.currentState !== 'active')
      throw new Error('APP 已暂停，未发起新操作');
    await agentRequest(`/actions/${a.id}/validate`, {
      attemptId: t.attemptId,
      token: t.token,
    });
    if (
      !enabled() ||
      AppState.currentState !== 'active' ||
      Date.now() >= t.expiresAt
    )
      throw new Error('执行许可已过期或 APP 已暂停');
    const ids = await alarm().list(),
      present = ids.some(x => x.toLowerCase() === id.toLowerCase());
    if (t.mode === 'reconcile') {
      outcome =
        t.tool === 'alarm.create'
          ? present
            ? 'scheduled'
            : 'absent'
          : present
          ? 'unknown'
          : 'absent';
    } else if (t.tool === 'alarm.create') {
      if (!present) {
        if (!(await alarm().schedule(id.toUpperCase(), t.fireAt!, t.title)))
          throw new Error('系统未确认创建');
      }
      outcome = 'scheduled';
    } else {
      if (present && !(await alarm().cancel(id.toUpperCase())))
        throw new Error('系统未确认取消');
      outcome = present ? 'cancelled' : 'absent';
    }
    detail =
      outcome === 'scheduled'
        ? 'iOS 已确认创建；不代表已响铃或已起床'
        : outcome === 'unknown'
        ? '系统仍有原闹钟，请手动核对后重试取消'
        : '已查询系统并确认目标闹钟不再存在';
  } catch {
    /* Never turn an ambiguous native/network error into success or an automatic retry. */
  }
  secure.pending.receipt = {
    attemptId: t.attemptId,
    token: t.token,
    outcome,
    systemAlarmId: id,
    detail,
  };
  await writeSecure(base, secure);
  await flushOutbox();
}
async function pump(reconcile: boolean) {
  if (!enabled() || AppState.currentState !== 'active') return;
  await state();
  await flushOutbox();
  if (reconcile) {
    const current = useAgentRuntime.getState().workspace!;
    const scheduled = current.actions.filter(
      a => a.state === 'scheduled' && ownsAction(a, current),
    );
    if (scheduled.length) {
      const status = await alarm().status();
      if (status.supported && status.authorized) {
        const ids = await alarm().list();
        for (const a of scheduled)
          if (!ids.some(id => id.toLowerCase() === a.id.toLowerCase()))
            accept(
              await agentRequest<Workspace>(`/actions/${a.id}/observe`, {
                version: a.version,
                outcome: 'absent',
              }),
            );
      }
    }
  }
  if (useRingStore.getState().status !== 'syncing') {
    for (const file of useRecordingStore.getState().files) {
      if (!enabled() || AppState.currentState !== 'active') return;
      await upload(file);
    }
  }
  const seen = new Set<string>();
  for (let count = 0; count < 6; count++) {
    const w = useAgentRuntime.getState().workspace!;
    const a = w.actions.find(
      x =>
        !seen.has(x.id) &&
        ownsAction(x, w) &&
        (!x.dependsOn ||
          w.actions.some(
            y => y.id === x.dependsOn && y.state === 'cancelled',
          )) &&
        (x.state === 'ready' ||
          (reconcile &&
            (x.state === 'unknown' ||
              (x.state === 'dispatched' && x.expiresAt < Date.now())))),
    );
    if (!a || !enabled() || AppState.currentState !== 'active') break;
    seen.add(a.id);
    await execute(a);
  }
}
export const refreshCloudAgent = () => serial(() => pump(true));
export const updateCloudTask = (
  id: string,
  body: {
    version: number;
    operation: 'confirm' | 'complete' | 'cancel';
    counterparty?: string;
    deliverable?: string;
    direction?: string;
    dueDate?: string;
    dateOmitted?: boolean;
  },
) =>
  serial(async () =>
    accept(await agentRequest<Workspace>(`/tasks/${id}/update`, body)),
  );
export const applyCloudCorrection = (
  recordId: string,
  body: {
    intentId: string;
    targetKind: 'task' | 'decision';
    targetId: string;
    version: number;
    replacement?: string;
  },
) =>
  serial(async () =>
    accept(await agentRequest<Workspace>(`/records/${recordId}/correct`, body)),
  );
export const createCloudMatter = (
  recordId: string,
  intentId: string,
  title: string,
) =>
  serial(async () =>
    accept(
      await agentRequest<Workspace>(`/records/${recordId}/matter`, {
        intentId,
        title,
      }),
    ),
  );
export const submitCloudRecording = (file: RingRecording) =>
  serial(async () => {
    await state();
    await upload(file, true);
    await pump(false);
  });
export function cloudAction(
  id: string,
  operation: 'confirm' | 'cancel' | 'reschedule',
  clarification = '',
) {
  return serial(async () => {
    if (!enabled())
      throw new Error('请先恢复云端 Agent；暂停不会取消已创建的系统闹钟');
    await state();
    const a = useAgentRuntime
      .getState()
      .workspace?.actions.find(x => x.id === id);
    if (!a) throw new Error('动作不存在');
    if (operation !== 'cancel' && !(await alarm().authorize()))
      throw new Error('未取得闹钟权限');
    const w = accept(
      await agentRequest<Workspace>(`/actions/${id}/${operation}`, {
        version: a.version,
        clarification,
        timezone: zone(),
      }),
    );
    const explicit = new Set([
      ...useAgentSettings.getState().explicitActions,
      id,
      ...w.actions.filter(x => x.recordId === a.recordId).map(x => x.id),
    ]);
    await saveAgentSettings({ explicitActions: [...explicit] });
    await pump(true);
  });
}
export function resolveCloudIntent(
  recordId: string,
  intentId: string,
  type: string,
  matterId: string | null,
  direction?: string,
) {
  return serial(async () =>
    accept(
      await agentRequest<Workspace>(`/records/${recordId}/resolve`, {
        intentId,
        type,
        matterId,
        direction,
      }),
    ),
  );
}
export const authorizeCloudAlarms = async () => {
  if (!(await alarm().authorize())) throw new Error('未授权');
  await refreshCloudAgent();
};
export function reviseCloudRecord(recordId: string, transcript: string) {
  return serial(async () => {
    if (!enabled()) throw new Error('请先恢复云端 Agent');
    const r = (await state()).records.find(x => x.id === recordId);
    if (!r) throw new Error('原文不存在');
    const binding = useAgentSettings
      .getState()
      .bindings.find(b => b.clientId === r.clientId);
    if (!binding)
      throw new Error('这条录音的本机来源不可用，请保留原文并重新录制');
    const file = useRecordingStore
      .getState()
      .files.find(f => recordingKey(f.uri) === binding.key);
    if (!file) throw new Error('本机原录音已删除，不能覆盖来源；请创建新录音');
    useRecordingStore.getState().setTranscript(file.uri, transcript);
    await upload({ ...file, transcript }, true);
  });
}
export const rememberCloudIntent = (
  recordId: string,
  intentId: string,
  supersedes?: string,
) =>
  serial(async () =>
    accept(
      await agentRequest<Workspace>(`/records/${recordId}/remember`, {
        intentId,
        supersedes,
      }),
    ),
  );
export const forgetCloudMemory = (id: string) =>
  serial(async () =>
    accept(await agentRequest<Workspace>(`/memories/${id}/forget`, {})),
  );
export function cloudRecordOperation(
  id: string,
  operation: 'retry' | 'delete',
) {
  return serial(async () =>
    accept(await agentRequest<Workspace>(`/records/${id}/${operation}`, {})),
  );
}
export async function cloudRecordingReply(
  file: RingRecording,
): Promise<string | undefined> {
  if (!JAVA_AGENT_ENABLED) return undefined;
  await loadAgentSettings();
  if (!cloudOwnsRecording(file)) return undefined;
  if (!enabled())
    return '云端 Agent 已暂停；已提交的录音不会改由本机重复创建闹钟。请在 agent 中恢复后核对。';
  await serial(async () => {
    await state();
    await upload(file);
    await pump(false);
  });
  const binding = useAgentSettings
    .getState()
    .bindings.find(b => b.key === recordingKey(file.uri));
  const w = useAgentRuntime.getState().workspace;
  const r = w?.records.find(
    x => x.clientId === binding?.clientId && x.revision === binding?.revision,
  );
  if (!r)
    throw new Error(
      '这条历史录音尚未提交云端，请在 agent 的 From your ring 中单独选择分析。',
    );
  if (r.status === 'failed')
    throw new Error(r.error || 'Agent 分析未完成，请在 agent 中重试');
  return cloudCaptureSummary(w!, r);
}
export function isCloudRecordingPending(file: RingRecording) {
  if (!JAVA_AGENT_ENABLED) return false;
  const binding = useAgentSettings
    .getState()
    .bindings.find(
      b =>
        b.key === recordingKey(file.uri) &&
        b.transcript === file.transcript?.trim(),
    );
  return (
    !!binding &&
    !!useAgentRuntime
      .getState()
      .workspace?.records.some(
        r =>
          r.clientId === binding.clientId &&
          r.revision === binding.revision &&
          ['received', 'interpreting'].includes(r.status),
      )
  );
}
export function startCloudAgent() {
  if (!JAVA_AGENT_ENABLED) return () => {};
  let stopped = false,
    timer: ReturnType<typeof setTimeout> | undefined;
  const run = () => {
    if (!stopped)
      serial(() => pump(false))
        .catch(() => {})
        .finally(() => {
          if (
            !stopped &&
            enabled() &&
            AppState.currentState === 'active' &&
            useAgentRuntime
              .getState()
              .workspace?.records.some(r =>
                ['received', 'interpreting'].includes(r.status),
              )
          ) {
            if (timer) clearTimeout(timer);
            timer = setTimeout(run, 3000);
          }
        });
  };
  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(run, 1000);
  };
  loadAgentSettings()
    .then(run)
    .catch(e => useAgentRuntime.setState({ error: e.message }));
  const recording = useRecordingStore.subscribe(schedule),
    ring = useRingStore.subscribe(schedule),
    workspace = useAgentRuntime.subscribe((next, previous) => {
      if (
        next.workspace !== previous.workspace &&
        next.workspace?.records.some(r =>
          ['received', 'interpreting'].includes(r.status),
        )
      )
        schedule();
    });
  const app = AppState.addEventListener('change', s => {
    if (s === 'active') refreshCloudAgent().catch(() => {});
  });
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    recording();
    ring();
    workspace();
    app.remove();
  };
}
