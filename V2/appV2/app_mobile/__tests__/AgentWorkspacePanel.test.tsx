jest.mock('../src/config/backend', () => ({ JAVA_AGENT_ENABLED: true }));
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Alert, Text } from 'react-native';
import { AgentWorkspacePanel } from '../src/components/AgentWorkspacePanel';
import { useAgentSettings } from '../src/agent/settings';
import { useAgentRuntime } from '../src/agent/runtime';
import { useAlarmStore } from '../src/services/agentAlarms';
import type { Workspace } from '../src/agent/types';
jest.mock('../src/services/haptics', () => ({ selectionHaptic: jest.fn() }));
const props = {
  entries: [],
  onOpen: jest.fn(),
  onDelete: jest.fn(),
  onRecord: jest.fn(),
};
let view: TestRenderer.ReactTestRenderer;
const content = () => JSON.stringify(view.toJSON());
beforeEach(() => {
  jest.clearAllMocks();
  useAgentSettings.setState({
    enabledAt: null,
    base: '',
    bindings: [],
    loaded: true,
  });
  useAgentRuntime.setState({ workspace: null, busy: false, error: '' });
  useAlarmStore.setState({ actions: [], loaded: true });
});
afterEach(async () => {
  await act(() => view?.unmount());
});
const mount = async () => {
  await act(async () => {
    view = TestRenderer.create(<AgentWorkspacePanel {...props} />);
  });
};
test('cloud agent starts with a consent screen, not an implied authorization', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  await mount();
  expect(content()).toContain('默认关闭');
  await act(() =>
    view.root.findByProps({ title: '了解并开启' }).props.onPress(),
  );
  expect(alert).toHaveBeenCalledWith(
    expect.any(String),
    expect.stringContaining('音频和邮箱不上传'),
    expect.any(Array),
  );
  expect(useAgentSettings.getState().enabledAt).toBeNull();
  alert.mockRestore();
});
test('the three projections separate confirmation, actual system state and raw provenance', async () => {
  const workspace: Workspace = {
    schemaVersion: 1,
    version: 1,
    alarmAuthorizedSince: null,
    matters: [],
    events: [],
    memories: [],
    records: [
      {
        id: 'record',
        clientId: 'client',
        revision: 1,
        transcript: '我刚刚说的原始文字',
        capturedAt: Date.now(),
        status: 'understood',
        error: null,
        source: 'ring',
        timezone: 'Asia/Shanghai',
        timeTrusted: false,
        intents: [],
      },
    ],
    actions: [
      {
        id: 'pending',
        recordId: 'record',
        intentId: null,
        tool: 'alarm.create',
        title: '待确认的十分钟闹钟',
        state: 'needs_user',
        reason: '时间需要确认',
        version: 1,
        fireAt: null,
        targetAlarmId: null,
        dependsOn: null,
        expiresAt: 0,
      },
      {
        id: 'active',
        recordId: 'record',
        intentId: null,
        tool: 'alarm.create',
        title: '系统实际已设置的闹钟',
        state: 'scheduled',
        reason: 'iOS 已确认创建',
        version: 2,
        fireAt: Date.now() + 600000,
        targetAlarmId: null,
        dependsOn: null,
        expiresAt: 0,
      },
    ],
  };
  useAgentSettings.setState({
    enabledAt: Date.now(),
    base: 'https://spur.test',
  });
  useAgentRuntime.setState({ workspace });
  await mount();
  expect(content()).toContain('待确认的十分钟闹钟');
  expect(content()).not.toContain('系统实际已设置的闹钟');
  const switchTab = async (title: string) => {
    await act(() =>
      view.root
        .findAll(
          node =>
            node.props.accessibilityRole === 'tab' &&
            typeof node.props.onPress === 'function' &&
            node.findAllByType(Text).some(t => t.props.children === title),
        )[0]
        .props.onPress(),
    );
  };
  await switchTab('In motion');
  expect(content()).toContain('系统实际已设置的闹钟');
  expect(content()).toContain('创建成功 ≠ 已响铃');
  expect(content()).not.toContain('待确认的十分钟闹钟');
  await switchTab('From your ring');
  expect(content()).toContain('我刚刚说的原始文字');
  expect(content()).toContain('纠正原文');
});
