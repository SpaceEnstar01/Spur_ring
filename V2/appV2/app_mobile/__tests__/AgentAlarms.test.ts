import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, NativeModules } from 'react-native';
import { useRecordingStore } from '../src/ring/store/useRecordingStore';
import { useRingStore } from '../src/ring/store/useRingStore';
import {
  cancelAgentAlarm,
  createConfirmedAlarm,
  processRecordingAlarms,
  refreshAgentAlarms,
  setAlarmAutomation,
  useAlarmStore,
} from '../src/services/agentAlarms';

const now = new Date(2026, 9, 24, 15).getTime();
const api = {
  authorize: jest.fn(),
  status: jest.fn(),
  schedule: jest.fn(),
  list: jest.fn(),
  cancel: jest.fn(),
};
function recording(
  transcript = '帮我定明天早上八点的闹钟',
  timestamp = now + 1000,
) {
  return {
    source: 'phone' as const,
    uri: 'file:///old/voice-recordings/alarm.m4a',
    name: 'alarm.m4a',
    size: 100,
    timestamp,
    transcript,
  };
}
beforeEach(() => {
  jest.useFakeTimers().setSystemTime(now + 2000);
  jest.clearAllMocks();
  Object.defineProperty(AppState, 'currentState', {
    value: 'active',
    writable: true,
    configurable: true,
  });
  NativeModules.SpurAlarm = api;
  api.authorize.mockResolvedValue(true);
  api.status.mockResolvedValue({ supported: true, authorized: true });
  api.list.mockResolvedValue([]);
  api.schedule.mockResolvedValue(true);
  api.cancel.mockResolvedValue(true);
  (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
  (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
  useAlarmStore.setState({
    enabledAt: null,
    actions: [],
    loaded: true,
    error: '',
  });
  useRecordingStore.setState({ files: [] });
  useRingStore.setState({ status: 'connected' });
});
afterEach(() => jest.useRealTimers());
test('disabled automation extracts action without permission prompts or OS writes', async () => {
  useRecordingStore.setState({ files: [recording()] });
  await processRecordingAlarms();
  expect(useAlarmStore.getState().actions[0]).toMatchObject({
    state: 'confirm',
    fireAt: new Date(2026, 9, 25, 8).getTime(),
  });
  expect(api.schedule).not.toHaveBeenCalled();
  expect(api.authorize).not.toHaveBeenCalled();
});
test('new recording executes once and duplicate synchronization or sandbox relocation cannot recreate', async () => {
  useAlarmStore.setState({ enabledAt: now });
  useRecordingStore.setState({ files: [recording()] });
  await processRecordingAlarms();
  const action = useAlarmStore.getState().actions[0];
  expect(action.state).toBe('scheduled');
  expect(api.schedule).toHaveBeenCalledWith(
    action.id,
    action.fireAt,
    action.title,
  );
  expect(api.authorize).not.toHaveBeenCalled();
  useRecordingStore.setState({
    files: [{ ...recording(), uri: 'file:///new/voice-recordings/alarm.m4a' }],
  });
  await Promise.all([processRecordingAlarms(), processRecordingAlarms()]);
  expect(api.schedule).toHaveBeenCalledTimes(1);
});
test('old recordings and ambiguous commands never auto execute', async () => {
  useAlarmStore.setState({ enabledAt: now + 1500 });
  useRecordingStore.setState({ files: [recording()] });
  await processRecordingAlarms();
  expect(api.schedule).not.toHaveBeenCalled();
  useAlarmStore.setState({ actions: [], enabledAt: now });
  useRecordingStore.setState({ files: [recording('帮我定八点的闹钟')] });
  await processRecordingAlarms();
  expect(useAlarmStore.getState().actions[0].state).toBe('confirm');
  expect(api.schedule).not.toHaveBeenCalled();
});
test('OS permission error cannot be marked scheduled or loop-retried', async () => {
  useAlarmStore.setState({ enabledAt: now });
  api.schedule.mockRejectedValueOnce(new Error('权限未开启'));
  useRecordingStore.setState({ files: [recording()] });
  await processRecordingAlarms();
  await processRecordingAlarms();
  expect(useAlarmStore.getState().actions[0]).toMatchObject({
    state: 'failed',
    detail: '权限未开启',
  });
  expect(api.schedule).toHaveBeenCalledTimes(1);
});
test('persist failure blocks OS side effects', async () => {
  useAlarmStore.setState({ enabledAt: now });
  useRecordingStore.setState({ files: [recording()] });
  (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(
    new Error('磁盘写入失败'),
  );
  await expect(processRecordingAlarms()).rejects.toThrow('磁盘写入失败');
  expect(api.schedule).not.toHaveBeenCalled();
});
test('manual confirmation and cancellation retain tombstone through repeated transcription', async () => {
  useRecordingStore.setState({ files: [recording('帮我定八点的闹钟')] });
  await processRecordingAlarms();
  const { id } = useAlarmStore.getState().actions[0];
  await createConfirmedAlarm(id, '帮我定明天早上九点的闹钟');
  expect(api.authorize).toHaveBeenCalledTimes(1);
  expect(useAlarmStore.getState().actions[0].state).toBe('scheduled');
  api.list.mockResolvedValue([id]);
  await cancelAgentAlarm(id);
  await processRecordingAlarms();
  expect(api.cancel).toHaveBeenCalledWith(id);
  expect(useAlarmStore.getState().actions[0].state).toBe('cancelled');
  expect(api.schedule).toHaveBeenCalledTimes(1);
});
test('permission denial does not enable automation', async () => {
  api.authorize.mockRejectedValueOnce(new Error('未授权'));
  await expect(setAlarmAutomation(true)).rejects.toThrow('未授权');
  expect(useAlarmStore.getState().enabledAt).toBeNull();
});
test('restart reconciles an interrupted scheduling attempt, never automatically reissues it', async () => {
  useRecordingStore.setState({ files: [recording()] });
  await processRecordingAlarms();
  const action = {
    ...useAlarmStore.getState().actions[0],
    state: 'scheduling' as const,
  };
  useAlarmStore.setState({ actions: [action] });
  api.list.mockResolvedValue([action.id]);
  await refreshAgentAlarms();
  expect(useAlarmStore.getState().actions[0].state).toBe('scheduled');
  api.list.mockResolvedValue([]);
  await refreshAgentAlarms();
  expect(useAlarmStore.getState().actions[0].state).toBe('ended');
  await processRecordingAlarms();
  expect(api.schedule).not.toHaveBeenCalled();
});
test('retry checks OS before creating again with the same UUID', async () => {
  useRecordingStore.setState({ files: [recording()] });
  await processRecordingAlarms();
  const action = useAlarmStore.getState().actions[0];
  api.list.mockResolvedValue([action.id]);
  await createConfirmedAlarm(action.id);
  expect(useAlarmStore.getState().actions[0].state).toBe('scheduled');
  expect(api.schedule).not.toHaveBeenCalled();
});
test('corrupt journal fails closed and never overwrites it', async () => {
  useAlarmStore.setState({ loaded: false });
  (AsyncStorage.getItem as jest.Mock).mockResolvedValue('{broken');
  await expect(processRecordingAlarms()).rejects.toThrow();
  expect(api.schedule).not.toHaveBeenCalled();
  expect(AsyncStorage.setItem).not.toHaveBeenCalledWith(
    'spur-agent-alarms-v1',
    expect.any(String),
  );
});
test('background does not create alarms', async () => {
  AppState.currentState = 'background';
  useAlarmStore.setState({ enabledAt: now });
  useRecordingStore.setState({ files: [recording()] });
  await processRecordingAlarms();
  expect(api.schedule).not.toHaveBeenCalled();
});
test('ring file modification timestamp alone can never authorize execution', async () => {
  useAlarmStore.setState({ enabledAt: now });
  useRecordingStore.setState({ files: [{ ...recording(), source: 'ring' }] });
  await processRecordingAlarms();
  expect(api.schedule).not.toHaveBeenCalled();
  expect(useAlarmStore.getState().actions[0]).toMatchObject({
    state: 'confirm',
    detail: expect.stringContaining('原始时间'),
  });
});
test('ring command from a verified live recording executes after synchronization completes', async () => {
  useAlarmStore.setState({ enabledAt: now });
  useRingStore.setState({ status: 'syncing' });
  useRecordingStore.setState({
    files: [{ ...recording(), source: 'ring', commandRecordedAt: now + 1000 }],
  });
  await processRecordingAlarms();
  expect(api.schedule).not.toHaveBeenCalled();
  expect(useAlarmStore.getState().actions).toHaveLength(0);
  useRingStore.setState({ status: 'connected' });
  await processRecordingAlarms();
  expect(api.schedule).toHaveBeenCalledTimes(1);
});
