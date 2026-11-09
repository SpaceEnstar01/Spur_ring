import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, NativeModules, Platform } from 'react-native';
import { create } from 'zustand';
import { useRecordingStore } from '../ring/store/useRecordingStore';
import { useRingStore } from '../ring/store/useRingStore';
import { recordingKey } from '../ring/recordingIdentity';
import { parseAlarmIntent } from './alarmIntent';
import { cloudOwnsRecording, loadAgentSettings } from '../agent/settings';

export type AlarmAction = {
  id: string;
  key: string;
  transcript: string;
  fireAt?: number;
  title: string;
  state:
    | 'confirm'
    | 'scheduling'
    | 'scheduled'
    | 'failed'
    | 'cancelled'
    | 'ended';
  detail?: string;
};
type Saved = { enabledAt: number | null; actions: AlarmAction[] };
type State = Saved & { loaded: boolean; error: string };
const KEY = 'spur-agent-alarms-v1';
const native = () => {
  if (Platform.OS !== 'ios' || !NativeModules.SpurAlarm)
    throw new Error('系统闹钟需要安装支持 AlarmKit 的 iOS 26 新版 Spur');
  return NativeModules.SpurAlarm as {
    status(): Promise<{ supported: boolean; authorized: boolean }>;
    authorize(): Promise<boolean>;
    schedule(id: string, timestamp: number, title: string): Promise<boolean>;
    list(): Promise<string[]>;
    cancel(id: string): Promise<boolean>;
  };
};
export const useAlarmStore = create<State>(() => ({
  enabledAt: null,
  actions: [],
  loaded: false,
  error: '',
}));
let queue: Promise<unknown> = Promise.resolve();
function serial<T>(job: () => Promise<T>): Promise<T> {
  const next = queue.then(job, job);
  queue = next.catch(() => {});
  return next;
}
async function save(change: Partial<Saved>) {
  const current = useAlarmStore.getState();
  const data = {
    enabledAt: current.enabledAt,
    actions: current.actions,
    ...change,
  };
  await AsyncStorage.setItem(KEY, JSON.stringify(data));
  useAlarmStore.setState({ ...data, error: '' });
}
async function load() {
  if (useAlarmStore.getState().loaded) return;
  const raw = await AsyncStorage.getItem(KEY);
  if (raw) {
    const value = JSON.parse(raw) as Saved;
    if (
      !Array.isArray(value.actions) ||
      !(
        value.enabledAt === null ||
        (typeof value.enabledAt === 'number' &&
          Number.isFinite(value.enabledAt))
      ) ||
      value.actions.some(
        action =>
          !action ||
          typeof action.key !== 'string' ||
          typeof action.transcript !== 'string' ||
          typeof action.title !== 'string' ||
          !/^[0-9a-f-]{36}$/i.test(action.id) ||
          ![
            'confirm',
            'scheduling',
            'scheduled',
            'failed',
            'cancelled',
            'ended',
          ].includes(action.state) ||
          (action.fireAt !== undefined && !Number.isFinite(action.fireAt)),
      )
    )
      throw new Error('闹钟记录读取异常，已停止自动执行，不会覆盖原记录');
    useAlarmStore.setState(value);
  }
  useAlarmStore.setState({ loaded: true, error: '' });
}
// UUID is persisted before reaching the OS; native ledger uses the same ID across retries/reinstalls.
function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'
    .replace(/[xy]/g, c => {
      const n = Math.floor(Math.random() * 16);
      return (c === 'x' ? n : (n % 4) + 8).toString(16);
    })
    .toUpperCase();
}
async function patch(id: string, change: Partial<AlarmAction>) {
  await save({
    actions: useAlarmStore
      .getState()
      .actions.map(action =>
        action.id === id ? { ...action, ...change } : action,
      ),
  });
}
async function execute(action: AlarmAction) {
  if (!action.fireAt || action.fireAt <= Date.now() + 5000) {
    await patch(action.id, {
      state: 'confirm',
      detail: '时间已过，请重新确认日期',
    });
    return;
  }
  // Durable scheduling state is mandatory. If writing fails, no OS call is made.
  await patch(action.id, { state: 'scheduling', detail: undefined });
  try {
    await native().schedule(action.id, action.fireAt, action.title);
    await patch(action.id, {
      state: 'scheduled',
      detail: '已由 iOS 创建系统闹钟，锁屏可响铃',
    });
  } catch (error) {
    // Failure to save an OS success is reconciled using the same UUID, never a fresh alarm.
    await patch(action.id, {
      state: 'failed',
      detail: (error as Error).message,
    });
  }
}

export function setAlarmAutomation(enabled: boolean) {
  return serial(async () => {
    await load();
    if (enabled) {
      await native().authorize(); // Only invoked by a user gesture, never by transcript processing.
      await save({ enabledAt: Date.now() });
    } else await save({ enabledAt: null });
  });
}

export function createConfirmedAlarm(id: string, clarification?: string) {
  return serial(async () => {
    await load();
    const action = useAlarmStore
      .getState()
      .actions.find(item => item.id === id);
    if (!action || !['confirm', 'failed'].includes(action.state)) return;
    let updated = action;
    if (clarification !== undefined) {
      const intent = parseAlarmIntent(clarification, Date.now());
      if (intent.kind !== 'alarm')
        throw new Error(
          intent.kind === 'confirm'
            ? intent.reason
            : '请输入明确的设置闹钟指令',
        );
      // Existing failed OS attempts keep the UUID so a retry cannot duplicate an alarm.
      updated = { ...action, fireAt: intent.fireAt, title: intent.title };
      await patch(id, { fireAt: intent.fireAt, title: intent.title });
    }
    await native().authorize();
    const ids = await native().list();
    if (ids.includes(id)) {
      await patch(id, {
        state: 'scheduled',
        detail: '系统闹钟已存在，未重复创建',
      });
      return;
    }
    await execute(updated);
  });
}

export function cancelAgentAlarm(id: string) {
  return serial(async () => {
    await load();
    const action = useAlarmStore
      .getState()
      .actions.find(item => item.id === id);
    if (!action || action.state === 'cancelled') return;
    if (['scheduled', 'scheduling', 'failed'].includes(action.state)) {
      const ids = await native().list();
      if (ids.includes(id)) await native().cancel(id);
    }
    await patch(id, {
      state: 'cancelled',
      detail: '已取消，不会因重新同步或分析而重建',
    });
  });
}

export function refreshAgentAlarms() {
  return serial(async () => {
    await load();
    if (
      !useAlarmStore
        .getState()
        .actions.some(a => ['scheduled', 'scheduling'].includes(a.state))
    )
      return;
    const status = await native().status();
    if (!status.supported || !status.authorized) {
      useAlarmStore.setState({
        error: '系统闹钟权限不可用，请检查系统设置；不会自动重建闹钟',
      });
      return;
    }
    const ids = await native().list();
    await save({
      actions: useAlarmStore.getState().actions.map(action => {
        if (!['scheduled', 'scheduling'].includes(action.state)) return action;
        if (ids.includes(action.id))
          return {
            ...action,
            state: 'scheduled' as const,
            detail: '系统闹钟已确认',
          };
        return {
          ...action,
          state:
            action.state === 'scheduling'
              ? ('failed' as const)
              : ('ended' as const),
          detail:
            action.state === 'scheduling'
              ? '上次创建未确认，请手动重试'
              : '已结束或已从系统移除，不会自动重建',
        };
      }),
    });
  });
}

export function processRecordingAlarms() {
  return serial(async () => {
    await load();
    await loadAgentSettings();
    for (const file of useRecordingStore.getState().files) {
      if (AppState.currentState !== 'active') break;
      if (!file.transcript?.trim()) continue;
      if (cloudOwnsRecording(file)) continue;
      const key = recordingKey(file.uri);
      if (useAlarmStore.getState().actions.some(action => action.key === key))
        continue;
      if (
        file.source !== 'phone' &&
        useRingStore.getState().status === 'syncing'
      )
        continue;
      const recordedAt =
        file.source === 'phone' ? file.timestamp : file.commandRecordedAt;
      let intent = parseAlarmIntent(
        file.transcript,
        recordedAt ?? file.timestamp,
      );
      if (intent.kind === 'alarm' && !recordedAt)
        intent = {
          kind: 'confirm',
          reason:
            '无法确认这条戒指录音的原始时间，请填写新指令；不会将同步时间当成录音时间',
        };
      if (intent.kind === 'none') continue;
      const action: AlarmAction = {
        id: uuid(),
        key,
        transcript: file.transcript,
        title: 'Spur 录音闹钟',
        state: 'confirm',
        ...(intent.kind === 'alarm'
          ? { fireAt: intent.fireAt }
          : { detail: intent.reason }),
      };
      await save({ actions: [action, ...useAlarmStore.getState().actions] });
      const enabledAt = useAlarmStore.getState().enabledAt;
      if (
        intent.kind === 'alarm' &&
        enabledAt !== null &&
        recordedAt !== undefined &&
        recordedAt >= enabledAt &&
        recordedAt <= Date.now() &&
        AppState.currentState === 'active'
      ) {
        const current = useRecordingStore
          .getState()
          .files.find(item => recordingKey(item.uri) === key);
        if (current?.transcript === action.transcript) await execute(action);
      }
    }
  });
}

export function startAgentAlarms() {
  let stopped = false;
  let pending = false;
  let dirty = false;
  const pump = () => {
    if (stopped || AppState.currentState !== 'active') return;
    if (pending) {
      dirty = true;
      return;
    }
    pending = true;
    dirty = false;
    processRecordingAlarms()
      .catch(error =>
        useAlarmStore.setState({ error: (error as Error).message }),
      )
      .finally(() => {
        pending = false;
        if (dirty) pump();
      });
  };
  const unsubscribe = useRecordingStore.subscribe(pump);
  const ring = useRingStore.subscribe(pump);
  const app = AppState.addEventListener('change', state => {
    if (state === 'active')
      refreshAgentAlarms()
        .catch(error =>
          useAlarmStore.setState({ error: (error as Error).message }),
        )
        .finally(pump);
  });
  refreshAgentAlarms()
    .catch(error => useAlarmStore.setState({ error: (error as Error).message }))
    .finally(pump);
  return () => {
    stopped = true;
    unsubscribe();
    ring();
    app.remove();
  };
}

export function alarmActionText(action: AlarmAction) {
  const label = {
    confirm: '待确认，尚未创建',
    scheduling: '正在创建，尚未确认成功',
    scheduled: '系统已确认创建',
    failed: '创建未完成',
    cancelled: '已取消',
    ended: '已结束或已从系统移除',
  }[action.state];
  return `### 闹钟执行结果（本机）\n\n${label}${
    action.fireAt
      ? `\n\n时间：${new Date(action.fireAt).toLocaleString('zh-CN')}`
      : ''
  }\n\n${
    action.detail || '请在首页 agent 的闹钟执行区确认或取消。'
  }\n\n这是 Spur 的系统闹钟，不在苹果「时钟」APP 列表中。`;
}

// Tool results are rendered from actual local state, not invented by the model.
export async function recordingAlarmReply(
  uri: string,
): Promise<string | undefined> {
  const file = useRecordingStore
    .getState()
    .files.find(item => recordingKey(item.uri) === recordingKey(uri));
  if (
    !file?.transcript ||
    parseAlarmIntent(file.transcript, file.commandRecordedAt ?? file.timestamp)
      .kind === 'none'
  )
    return undefined;
  await processRecordingAlarms();
  await refreshAgentAlarms();
  const action = useAlarmStore
    .getState()
    .actions.find(item => item.key === recordingKey(uri));
  return action
    ? alarmActionText(action)
    : '闹钟指令已收到，等待戒指同步完成后确认执行状态。尚未确认创建成功。';
}
