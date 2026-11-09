jest.mock('../src/config/backend', () => ({ JAVA_AGENT_ENABLED: true }));
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, NativeModules } from 'react-native';
import { useRecordingStore } from '../src/ring/store/useRecordingStore';
import { useRingStore } from '../src/ring/store/useRingStore';
import {
  AGENT_SETTINGS_KEY,
  cloudOwnsRecording,
  useAgentSettings,
} from '../src/agent/settings';
import {
  enableCloudAgent,
  refreshCloudAgent,
  submitCloudRecording,
  useAgentRuntime,
  validateAgentTicket,
  startCloudAgent,
  isCloudRecordingPending,
} from '../src/agent/runtime';
import type { AgentAction, Ticket, Workspace } from '../src/agent/types';
import type { SecureState } from '../src/agent/client';

jest.mock('../src/services/chatApi', () => ({
  getApiUrl: jest.fn(async () => 'https://spur.test'),
}));
const base = 'https://spur.test',
  deviceId = '10000000-0000-4000-8000-000000000001',
  actionId = '20000000-0000-4000-8000-000000000001';
const key = 'k'.repeat(43),
  attemptToken = 't'.repeat(43);
let secure: SecureState | null,
  w: Workspace,
  ids: string[],
  failReceipt: boolean,
  postBodies: Record<string, unknown>[];
const file = {
  uri: 'file:///voice-recordings/a.m4a',
  name: 'a.m4a',
  timestamp: Date.now(),
  source: 'phone' as const,
  transcript: '帮我定十分钟后的闹钟',
  size: 100,
};
const api = {
  status: jest.fn(),
  authorize: jest.fn(),
  schedule: jest.fn(),
  list: jest.fn(),
  cancel: jest.fn(),
};
const nativeIdentity = { read: jest.fn(), write: jest.fn(), newId: jest.fn() };
let fixtureAction: AgentAction | undefined;
const ticket = (a: AgentAction): Ticket => ({
  deviceId,
  actionId: a.id,
  actionVersion: a.version,
  attemptId: '30000000-0000-4000-8000-000000000001',
  token: attemptToken,
  expiresAt: Date.now() + 60000,
  mode: 'execute',
  tool: a.tool,
  fireAt: a.fireAt,
  targetAlarmId: a.targetAlarmId,
  title: a.title,
});
const request = jest.fn(async (url: string, init?: RequestInit) => {
  const path = url.replace(`${base}/api/agent`, '');
  const body = init?.body ? JSON.parse(init.body as string) : null;
  let result: unknown = w;
  if (path === '/capabilities') result = { enabled: true, schemaVersion: 1 };
  else if (path === '/devices') result = { deviceId, token: key };
  else if (path === '/records') {
    postBodies.push(body);
    w.records = [
      {
        id: '40000000-0000-4000-8000-000000000001',
        clientId: body.clientRecordId,
        revision: body.revision,
        transcript: body.transcript,
        capturedAt: body.capturedAt,
        status: 'understood',
        error: null,
        source: body.source,
        timezone: body.timezone,
        timeTrusted: body.timeTrusted,
        intents: [],
      },
    ];
    if (fixtureAction) w.actions = [fixtureAction];
  } else if (path.endsWith('/claim')) {
    const a = w.actions.find(x => path.includes(x.id))!;
    result = ticket(a);
    a.state = 'dispatched';
  } else if (path.endsWith('/validate')) result = { valid: true };
  else if (path.endsWith('/receipt')) {
    if (failReceipt) throw new Error('离线');
    w.actions[0].state = body.outcome;
    w.actions[0].version++;
  }
  return {
    ok: true,
    json: async () => JSON.parse(JSON.stringify(result)),
  } as Response;
});
beforeEach(() => {
  jest.clearAllMocks();
  secure = { deviceId, token: key };
  ids = [];
  failReceipt = false;
  fixtureAction = undefined;
  postBodies = [];
  w = {
    schemaVersion: 1,
    version: 1,
    alarmAuthorizedSince: null,
    records: [],
    actions: [],
    matters: [],
    events: [],
    memories: [],
  };
  useAgentSettings.setState({
    base,
    enabledAt: Date.now() - 10000,
    excluded: [],
    bindings: [],
    explicitActions: [],
    loaded: true,
  });
  useAgentRuntime.setState({ workspace: null, busy: false, error: '' });
  useRecordingStore.setState({ files: [], deletedUris: [] });
  useRingStore.setState({ status: 'connected' });
  Object.defineProperty(AppState, 'currentState', {
    value: 'active',
    writable: true,
    configurable: true,
  });
  NativeModules.SpurAlarm = api;
  NativeModules.SpurIdentity = nativeIdentity;
  nativeIdentity.read.mockImplementation(async () =>
    secure ? JSON.stringify(secure) : null,
  );
  nativeIdentity.write.mockImplementation(
    async (_scope: string, value: string) => {
      secure = JSON.parse(value);
      return true;
    },
  );
  nativeIdentity.newId.mockResolvedValue(
    '50000000-0000-4000-8000-000000000001',
  );
  api.status.mockResolvedValue({ supported: true, authorized: true });
  api.authorize.mockResolvedValue(true);
  api.list.mockImplementation(async () => [...ids]);
  api.schedule.mockImplementation(async (id: string) => {
    ids.push(id);
    return true;
  });
  api.cancel.mockResolvedValue(true);
  (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
  (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
  global.fetch = request as typeof fetch;
});
function ready() {
  fixtureAction = {
    id: actionId,
    recordId: '40000000-0000-4000-8000-000000000001',
    intentId: null,
    tool: 'alarm.create',
    title: 'Spur 闹钟',
    state: 'ready',
    reason: 'authorized',
    version: 1,
    fireAt: Date.now() + 600000,
    targetAlarmId: null,
    dependsOn: null,
    expiresAt: 0,
  };
  return fixtureAction;
}
test('explicit enable creates secure identity, excludes existing history and never stores bearer in AsyncStorage', async () => {
  secure = null;
  useAgentSettings.setState({ enabledAt: null });
  useRecordingStore.setState({ files: [file] });
  await enableCloudAgent();
  expect(secure).toEqual({ deviceId, token: key });
  expect(useAgentSettings.getState().excluded).toHaveLength(1);
  expect(
    JSON.stringify((AsyncStorage.setItem as jest.Mock).mock.calls),
  ).not.toContain(key);
  expect(api.authorize).not.toHaveBeenCalled();
  expect(postBodies).toHaveLength(0);
});
test('Keychain write failure prevents enable, transcript upload and OS writes', async () => {
  secure = null;
  useAgentSettings.setState({ enabledAt: null });
  nativeIdentity.write.mockRejectedValueOnce(new Error('Keychain不可写'));
  await expect(enableCloudAgent()).rejects.toThrow('Keychain不可写');
  expect(useAgentSettings.getState().enabledAt).toBeNull();
  expect(postBodies).toHaveLength(0);
  expect(api.schedule).not.toHaveBeenCalled();
});
test('same source is uploaded once; a transcript correction retains client ID and increments revision', async () => {
  await submitCloudRecording(file);
  await submitCloudRecording(file);
  expect(postBodies).toHaveLength(1);
  await submitCloudRecording({ ...file, transcript: '我决定先写脚本' });
  expect(postBodies).toHaveLength(2);
  expect(postBodies[1].clientRecordId).toBe(postBodies[0].clientRecordId);
  expect(postBodies[1].revision).toBe(2);
});
test('pending analysis polls read-only until complete without posting the source again', async () => {
  jest.useFakeTimers();
  let stop: (() => void) | undefined;
  const settle = async () => {
    for (let i = 0; i < 120; i++) await Promise.resolve();
  };
  try {
    useRecordingStore.setState({ files: [file] });
    await submitCloudRecording(file);
    w.records[0].status = 'interpreting';
    await refreshCloudAgent();
    expect(isCloudRecordingPending(file)).toBe(true);
    expect(useRecordingStore.getState().files[0]).toMatchObject({
      aiReplyState: 'working',
      aiReply: expect.stringContaining('正在分析'),
    });
    stop = startCloudAgent();
    await settle();
    const before = request.mock.calls.length;
    jest.advanceTimersByTime(3100);
    await settle();
    expect(request.mock.calls.length).toBeGreaterThan(before);
    expect(postBodies).toHaveLength(1);
    w.records[0].status = 'understood';
    jest.advanceTimersByTime(3100);
    await settle();
    expect(isCloudRecordingPending(file)).toBe(false);
    expect(useRecordingStore.getState().files[0].aiReplyState).toBe('done');
    // One previously scheduled refresh may drain; polling must then stop.
    jest.advanceTimersByTime(3100);
    await settle();
    const completed = request.mock.calls.length;
    jest.advanceTimersByTime(10000);
    await settle();
    expect(request.mock.calls.length).toBe(completed);
    expect(api.schedule).not.toHaveBeenCalled();
    expect(postBodies).toHaveLength(1);
  } finally {
    stop?.();
    jest.useRealTimers();
  }
});
test('cloud analysis is mirrored into recording details without enabling the separate legacy reply switch', async () => {
  useRecordingStore.setState({ files: [file] });
  await submitCloudRecording(file);
  expect(useRecordingStore.getState().files[0]).toMatchObject({
    aiReplyState: 'done',
    aiReply: expect.stringContaining('Spur agent'),
  });
  expect(postBodies).toHaveLength(1);
  w.records[0].status = 'failed';
  w.records[0].error = '模型服务超时';
  await refreshCloudAgent();
  expect(useRecordingStore.getState().files[0]).toMatchObject({
    aiReplyState: 'failed',
    aiReplyError: '模型服务超时',
  });
});

test('cloud results never overwrite a locally revised transcript or reply', async () => {
  useRecordingStore.setState({ files: [file] });
  await submitCloudRecording(file);
  useRecordingStore.getState().setTranscript(file.uri, '新的未提交原文');
  useRecordingStore
    .getState()
    .setReply(file.uri, { aiReply: '保留的新回复', aiReplyState: 'done' });
  // Do not upload while a ring sync is in progress, but still refresh old workspace.
  useRingStore.setState({ status: 'syncing' });
  await refreshCloudAgent();
  expect(useRecordingStore.getState().files[0]).toMatchObject({
    transcript: '新的未提交原文',
    aiReply: '保留的新回复',
  });
  expect(postBodies).toHaveLength(1);
});
test('a persisted source binding remains cloud owned when paused, preventing duplicate local fallback', async () => {
  await submitCloudRecording(file);
  useAgentSettings.setState({ enabledAt: null });
  expect(cloudOwnsRecording(file)).toBe(true);
});
test('only a validated lease reaches native OS and the durable ticket precedes scheduling', async () => {
  ready();
  api.schedule.mockImplementationOnce(async (id: string) => {
    expect(secure?.pending?.ticket.actionId).toBe(actionId);
    expect(request.mock.calls.some(([url]) => url.endsWith('/validate'))).toBe(
      true,
    );
    ids.push(id);
    return true;
  });
  await submitCloudRecording(file);
  expect(api.schedule).toHaveBeenCalledTimes(1);
  expect(api.schedule.mock.calls[0][0]).toBe(actionId.toUpperCase());
  expect(useAgentRuntime.getState().workspace?.actions[0].state).toBe(
    'scheduled',
  );
  expect(secure?.pending).toBeUndefined();
  expect(api.authorize).not.toHaveBeenCalled();
});
test('a lost receipt is retried without repeating the already successful native operation', async () => {
  ready();
  failReceipt = true;
  await expect(submitCloudRecording(file)).rejects.toThrow('离线');
  expect(secure?.pending?.receipt?.outcome).toBe('scheduled');
  failReceipt = false;
  await refreshCloudAgent();
  expect(api.schedule).toHaveBeenCalledTimes(1);
  expect(secure?.pending).toBeUndefined();
});
test('restart with an incomplete native attempt reconciles actual system state, never reschedules', async () => {
  const a = ready();
  await submitCloudRecording(file);
  secure!.pending = { ticket: ticket(a) };
  w.actions[0].state = 'dispatched';
  w.actions[0].expiresAt = Date.now() + 60000;
  api.schedule.mockClear();
  await refreshCloudAgent();
  expect(api.schedule).not.toHaveBeenCalled();
  expect(w.actions[0].state).toBe('scheduled');
});
test('unowned pending cloud actions cannot be executed on this installation', async () => {
  const a = ready();
  w.actions = [a];
  fixtureAction = undefined;
  await refreshCloudAgent();
  expect(api.schedule).not.toHaveBeenCalled();
  expect(request.mock.calls.some(([url]) => url.endsWith('/claim'))).toBe(
    false,
  );
});
test('permission denial in a worker never triggers a prompt or falsely records success', async () => {
  ready();
  api.status.mockResolvedValue({ supported: true, authorized: false });
  await expect(submitCloudRecording(file)).rejects.toThrow('权限');
  expect(api.schedule).not.toHaveBeenCalled();
  expect(api.authorize).not.toHaveBeenCalled();
  expect(w.actions[0].state).toBe('ready');
});
test('tickets reject changed parameters, expired leases, different device and unsupported tools', () => {
  const a = ready(),
    t = ticket(a);
  expect(() => validateAgentTicket(t, a, deviceId)).not.toThrow();
  for (const change of [
    { deviceId: 'other' },
    { expiresAt: 0 },
    { fireAt: t.fireAt! + 60000 },
    { tool: 'mail.send' },
    { actionVersion: 99 },
    { token: 'bad' },
  ])
    expect(() => validateAgentTicket({ ...t, ...change }, a, deviceId)).toThrow(
      '不匹配',
    );
});
test('failed durable source journal blocks submission rather than generating an untracked duplicate', async () => {
  (AsyncStorage.setItem as jest.Mock).mockImplementationOnce(
    async (keyName: string) => {
      if (keyName === AGENT_SETTINGS_KEY) throw new Error('磁盘满');
    },
  );
  await expect(submitCloudRecording(file)).rejects.toThrow('磁盘满');
  expect(postBodies).toHaveLength(0);
  expect(api.schedule).not.toHaveBeenCalled();
});
