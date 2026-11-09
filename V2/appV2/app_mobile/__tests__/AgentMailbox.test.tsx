import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Alert } from 'react-native';
import { AgentMailboxPanel } from '../src/components/AgentMailboxPanel';
import { emailRequest } from '../src/services/agentEmailApi';
jest.mock('../src/services/agentEmailApi', () => ({ emailRequest: jest.fn() }));
const message = {
  id: 'msg',
  threadId: 'thread',
  sender: 'partner@example.test',
  subject: '合作来信',
  preview: '请讨论合作',
  body: '请讨论合作',
  labels: ['received'],
};
const draft = {
  id: 'draft',
  messageId: 'msg',
  version: 1,
  recipient: message.sender,
  subject: '回复',
  text: '请补充预算',
  status: 'draft',
};
let renderer: TestRenderer.ReactTestRenderer;
const tree = () => JSON.stringify(renderer.toJSON());
async function mount() {
  await act(async () => {
    renderer = TestRenderer.create(<AgentMailboxPanel />);
  });
}
async function press(label: string) {
  const b = renderer.root.findAll(
    n =>
      n.props.accessibilityLabel === label &&
      typeof n.props.onPress === 'function',
  )[0];
  if (!b) throw new Error(label);
  await act(async () => {
    b.props.onPress();
    for (let i = 0; i < 30; i++) await Promise.resolve();
  });
}
beforeEach(() => {
  jest.clearAllMocks();
  (emailRequest as jest.Mock).mockImplementation(
    async (path, _signal, body) => {
      if (path === '/status')
        return {
          configured: true,
          workflowVersion: 1,
          inboxId: 'agent@example.test',
          sendingEnabled: true,
        };
      if (path.startsWith('/messages')) return { messages: [message] };
      if (path === '/drafts') return body ? { draft } : { drafts: [] };
      if (path === '/analyze') return { response: '合作分析', draft };
      if (path.endsWith('/approve'))
        return {
          draft: { ...draft, status: 'approved' },
          approvalId: 'approval',
        };
      if (path === '/reply') return { draft: { ...draft, status: 'accepted' } };
    },
  );
});
afterEach(async () => {
  await act(async () => renderer?.unmount());
  jest.restoreAllMocks();
});
test('mail is read only after opening the mailbox, and analysis does not send', async () => {
  await mount();
  expect(emailRequest).not.toHaveBeenCalled();
  await press('打开 Agent 工作邮箱');
  await press('查看来信 合作来信');
  await press('分析这封邮件');
  expect(tree()).toContain('请补充预算');
  expect(
    (emailRequest as jest.Mock).mock.calls.some(([p]) => p === '/reply'),
  ).toBe(false);
});
test('unconfigured cloud is explained without requesting private inbox data', async () => {
  (emailRequest as jest.Mock).mockResolvedValue({ configured: false });
  await mount();
  await press('打开 Agent 工作邮箱');
  expect(tree()).toContain('云端尚未配置');
  expect(emailRequest).toHaveBeenCalledTimes(1);
});
test('explicit alert approval binds the saved draft and is separate from accepted delivery', async () => {
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  await mount();
  await press('打开 Agent 工作邮箱');
  await press('查看来信 合作来信');
  await press('分析这封邮件');
  await press('审阅并允许发送邮件');
  expect(
    (emailRequest as jest.Mock).mock.calls.some(([p]) => p === '/reply'),
  ).toBe(false);
  const actions = (Alert.alert as jest.Mock).mock.calls.at(-1)[2];
  await act(async () => {
    actions
      .find((a: { text: string }) => a.text === '允许并提交发送')
      .onPress();
    for (let i = 0; i < 40; i++) await Promise.resolve();
  });
  expect(emailRequest).toHaveBeenCalledWith('/reply', expect.any(AbortSignal), {
    draftId: 'draft',
    version: 1,
    approvalId: 'approval',
    confirm: true,
  });
  expect(tree()).toContain('已提交发送，未核验送达');
});
test('unknown sending state disables editing and retry sending', async () => {
  const base = (emailRequest as jest.Mock).getMockImplementation()!;
  (emailRequest as jest.Mock).mockImplementation(async (p, ...rest) =>
    p === '/drafts'
      ? { drafts: [{ ...draft, status: 'unknown' }] }
      : base(p, ...rest),
  );
  await mount();
  await press('打开 Agent 工作邮箱');
  await press('查看来信 合作来信');
  expect(tree()).toContain('发送状态待核对');
  expect(tree()).not.toContain('审阅并允许发送邮件');
});
