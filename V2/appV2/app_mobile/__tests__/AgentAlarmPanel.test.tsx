import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Alert } from 'react-native';
import { AgentAlarmPanel } from '../src/components/AgentAlarmPanel';
import { setAlarmAutomation, useAlarmStore } from '../src/services/agentAlarms';

jest.mock('../src/services/agentAlarms', () => {
  const actual = jest.requireActual('../src/services/agentAlarms');
  return {
    ...actual,
    setAlarmAutomation: jest.fn().mockResolvedValue(undefined),
    createConfirmedAlarm: jest.fn(),
    cancelAgentAlarm: jest.fn(),
    refreshAgentAlarms: jest.fn(),
  };
});
let renderer: TestRenderer.ReactTestRenderer;
beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  useAlarmStore.setState({
    actions: [],
    enabledAt: null,
    loaded: true,
    error: '',
  });
});
afterEach(async () => {
  await act(() => renderer?.unmount());
  jest.restoreAllMocks();
});
test('automation requires explicit consent and shows scope, not an invented execution result', async () => {
  await act(() => {
    renderer = TestRenderer.create(<AgentAlarmPanel />);
  });
  expect(JSON.stringify(renderer.toJSON())).toContain('暂无闹钟指令');
  await act(() =>
    renderer.root
      .findAll(n => n.props.accessibilityLabel === '录音闹钟自动执行')[0]
      .props.onPress(),
  );
  expect(setAlarmAutomation).not.toHaveBeenCalled();
  const [title, message, buttons] = (Alert.alert as jest.Mock).mock.calls[0];
  expect(title).toContain('开启');
  expect(message).toContain('旧录音不自动执行');
  await act(async () => {
    await buttons
      .find((b: { text: string }) => b.text === '授权并开启')
      .onPress();
  });
  expect(setAlarmAutomation).toHaveBeenCalledWith(true);
});
test('failed OS operation remains a failure, not an AI success', async () => {
  useAlarmStore.setState({
    actions: [
      {
        id: 'id',
        key: 'key',
        title: '闹钟',
        transcript: '帮我定明天八点的闹钟',
        state: 'failed',
        detail: '系统权限未开启',
      },
    ],
  });
  await act(() => {
    renderer = TestRenderer.create(<AgentAlarmPanel />);
  });
  const tree = JSON.stringify(renderer.toJSON());
  expect(tree).toContain('未完成');
  expect(tree).toContain('系统权限未开启');
  expect(tree).not.toContain('已设置');
});
