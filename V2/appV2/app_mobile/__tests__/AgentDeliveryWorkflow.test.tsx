import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Alert } from 'react-native';
import {
  CorrectionControl,
  DeliveryTaskCard,
  NewMatterControl,
} from '../src/components/AgentDeliveryWorkflow';
import {
  applyCloudCorrection,
  createCloudMatter,
  updateCloudTask,
} from '../src/agent/runtime';
import type {
  AgentIntent,
  Capture,
  DeliveryTask,
  Workspace,
} from '../src/agent/types';
jest.mock('../src/services/haptics', () => ({ selectionHaptic: jest.fn() }));
jest.mock('../src/agent/runtime', () => ({
  applyCloudCorrection: jest.fn().mockResolvedValue(undefined),
  createCloudMatter: jest.fn().mockResolvedValue(undefined),
  updateCloudTask: jest.fn().mockResolvedValue(undefined),
}));
const task: DeliveryTask = {
  id: 'task',
  recordId: 'r',
  intentId: 'i',
  matterId: 'm',
  counterparty: '摄影师',
  deliverable: '脚本',
  direction: 'user_owes',
  dateText: '周五',
  dueDate: null,
  dateOmitted: false,
  timezone: 'Asia/Shanghai',
  state: 'needs_user',
  reason: '周五是哪一天？',
  version: 2,
  history: [],
};
const intent: AgentIntent = {
  id: 'correction',
  type: 'correction',
  span: '上一版不要了',
  summary: '撤回上一版',
  matterId: null,
  question: '哪个版本？',
  confidence: 0.9,
  processingStatus: 'needs_user',
  targetActionId: null,
};
const record: Capture = {
  id: 'r',
  clientId: 'c',
  revision: 1,
  transcript: '上一版不要了',
  capturedAt: Date.now(),
  status: 'understood',
  error: null,
  source: 'ring',
  intents: [intent],
  timezone: 'Asia/Shanghai',
  timeTrusted: true,
};
const workspace: Workspace = {
  schemaVersion: 1,
  version: 1,
  alarmAuthorizedSince: null,
  records: [record],
  actions: [],
  memories: [],
  tasks: [task],
  matters: [
    {
      id: 'm',
      title: '眼镜视频',
      status: 'active',
      direction: '做参数对比',
      sourceIds: ['r'],
      version: 3,
    },
  ],
  events: [
    {
      id: 'decision',
      type: 'DecisionRecorded',
      matterId: 'm',
      recordId: 'r',
      value: '做参数对比',
      reason: '明确决定',
      recordedAt: Date.now(),
    },
  ],
};
let view: TestRenderer.ReactTestRenderer;
const content = () => JSON.stringify(view.toJSON());
const click = async (title: string) => {
  await act(async () => view.root.findByProps({ title }).props.onPress());
};
const mount = async (node: React.ReactElement) => {
  await act(async () => {
    view = TestRenderer.create(node);
  });
};
beforeEach(() => jest.clearAllMocks());
afterEach(async () => {
  await act(() => view?.unmount());
});

test('a commitment retains relative date, asks for a calendar date and submits the displayed version', async () => {
  await mount(
    <DeliveryTaskCard task={task} workspace={workspace} busy={false} />,
  );
  expect(content()).toContain('原话「周五」');
  expect(content()).not.toContain('已发送');
  await click('补充并确认任务');
  await act(async () =>
    view.root
      .findByProps({ accessibilityLabel: '截止日期' })
      .props.onChangeText('2026-10-30'),
  );
  await click('确认任务');
  expect(updateCloudTask).toHaveBeenCalledWith(
    'task',
    expect.objectContaining({
      version: 2,
      operation: 'confirm',
      dueDate: '2026-10-30',
      counterparty: '摄影师',
      deliverable: '脚本',
    }),
  );
});
test('the user can intentionally leave a task without a date, not accept a guessed Friday', async () => {
  await mount(
    <DeliveryTaskCard task={task} workspace={workspace} busy={false} />,
  );
  await click('补充并确认任务');
  await click('暂不设截止日期');
  await click('确认任务');
  expect(updateCloudTask).toHaveBeenCalledWith(
    'task',
    expect.objectContaining({ dateOmitted: true, dueDate: '' }),
  );
});
test('mark complete requires a user confirmation and never claims a send receipt', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  await mount(
    <DeliveryTaskCard
      task={{ ...task, state: 'open' }}
      workspace={workspace}
      busy={false}
    />,
  );
  await click('标记完成');
  expect(updateCloudTask).not.toHaveBeenCalled();
  expect(alert).toHaveBeenCalledWith(
    '确认已完成交付？',
    expect.stringContaining('不是文件发送回执'),
    expect.any(Array),
  );
  const buttons = alert.mock.calls[0][2]!;
  await act(async () => buttons[1].onPress?.());
  expect(updateCloudTask).toHaveBeenCalledWith('task', {
    version: 2,
    operation: 'complete',
  });
  alert.mockRestore();
});
test('ambiguous correction cannot submit without selecting an owned, versioned target', async () => {
  await mount(
    <CorrectionControl
      record={record}
      intent={intent}
      workspace={workspace}
      busy={false}
    />,
  );
  await click('选择并确认修正');
  expect(
    view.root.findByProps({ title: '确认撤回决定并暂停旧计划' }).props.disabled,
  ).toBe(true);
  expect(applyCloudCorrection).not.toHaveBeenCalled();
  await click('眼镜视频 · 做参数对比');
  await act(async () =>
    view.root
      .findByProps({ accessibilityLabel: '替代决定（选填，留空仅撤回）' })
      .props.onChangeText('改成真人体验'),
  );
  await click('确认替换决定并暂停旧计划');
  expect(applyCloudCorrection).toHaveBeenCalledWith(
    'r',
    expect.objectContaining({
      intentId: 'correction',
      targetKind: 'decision',
      targetId: 'decision',
      version: 3,
      replacement: '改成真人体验',
    }),
  );
});
test('a withdrawn task remains visible as the correction target and history, not a new executable task', async () => {
  await mount(
    <CorrectionControl
      record={record}
      intent={{ ...intent, processingStatus: 'updated', targetTaskId: 'task' }}
      workspace={{ ...workspace, tasks: [{ ...task, state: 'superseded' }] }}
      busy={false}
    />,
  );
  expect(content()).toContain('已修正对象');
  expect(content()).toContain('脚本');
  expect(view.root.findAllByProps({ title: '选择并确认修正' })).toHaveLength(0);
});
test('an idea may get its own emerging Matter only after the user asks', async () => {
  await mount(
    <NewMatterControl
      record={record}
      intent={{ ...intent, type: 'idea', summary: 'AI 眼镜值得拍' }}
      busy={false}
    />,
  );
  expect(createCloudMatter).not.toHaveBeenCalled();
  await click('为想法新建 Matter');
  expect(content()).toContain('不会把灵感变成决定');
  await click('新建并关联');
  expect(createCloudMatter).toHaveBeenCalledWith(
    'r',
    'correction',
    'AI 眼镜值得拍',
  );
});
