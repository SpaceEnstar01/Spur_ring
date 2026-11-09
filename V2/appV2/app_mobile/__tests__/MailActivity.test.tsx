import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { MailActivitySummary } from '../src/components/MailActivitySummary';
import {
  useMailNotificationStore,
  resetMailNotifications,
  refreshMailNotifications,
  markMailNotificationRead,
} from '../src/services/mailNotifications';
import { emailRequest } from '../src/services/agentEmailApi';
jest.mock('../src/services/agentEmailApi', () => ({ emailRequest: jest.fn() }));
let renderer: TestRenderer.ReactTestRenderer;
beforeEach(() => {
  resetMailNotifications();
  jest.clearAllMocks();
});
afterEach(() => {
  if (renderer) act(() => renderer.unmount());
});
const item = {
  id: 'message',
  threadId: 'thread',
  sender: 'sender@example.test',
  subject: '确认拍摄时间',
  timestamp: '2026-11-06',
  unread: true,
  state: 'ready' as const,
  summary: '对方请求确认周五拍摄时间。',
  needsAttention: true,
};
test('workspace surfaces a real unread email and opens that same message', async () => {
  const onOpen = jest.fn();
  await act(async () => {
    renderer = TestRenderer.create(<MailActivitySummary onOpen={onOpen} />);
  });
  expect(renderer.toJSON()).toBeNull();
  await act(async () => {
    useMailNotificationStore.setState({
      notifications: [item],
      unreadCount: 1,
    });
  });
  expect(JSON.stringify(renderer.toJSON())).toContain('对方请求确认');
  const target = renderer.root.findAll(
    n =>
      n.props.accessibilityLabel === '查看来信 确认拍摄时间' &&
      typeof n.props.onPress === 'function',
  )[0];
  target.props.onPress();
  expect(onOpen).toHaveBeenCalledWith('message');
  await act(async () => {
    useMailNotificationStore.setState({
      notifications: [{ ...item, unread: false }],
      unreadCount: 0,
    });
  });
  expect(JSON.stringify(renderer.toJSON())).toContain('对方请求确认');
  expect(JSON.stringify(renderer.toJSON())).toContain('已读');
});
test('notification read state comes from server and never calls draft approval or sending', async () => {
  const feed = {
    enabled: true,
    initialized: true,
    lastSyncAt: null,
    error: '',
    backlog: false,
    unreadCount: 1,
    notifications: [item],
  };
  (emailRequest as jest.Mock)
    .mockResolvedValueOnce(feed)
    .mockResolvedValueOnce({
      ...feed,
      unreadCount: 0,
      notifications: [{ ...item, unread: false }],
    });
  const signal = new AbortController().signal;
  await refreshMailNotifications(signal);
  expect(useMailNotificationStore.getState().unreadCount).toBe(1);
  await markMailNotificationRead('message', signal);
  expect(useMailNotificationStore.getState().unreadCount).toBe(0);
  expect((emailRequest as jest.Mock).mock.calls.map(c => c[0])).toEqual([
    '/notifications',
    '/notifications/message/read',
  ]);
});

test('workspace shows multiple unread emails including pending and non-urgent messages', async () => {
  useMailNotificationStore.setState({ notifications: [
    { ...item, id: 'english', subject: 'Business', summary: 'Please confirm the delivery date.', needsAttention: false },
    { ...item, id: 'pending', subject: 'New inquiry', summary: '', state: 'pending' },
    { ...item, id: 'read', subject: 'Already read', unread: false },
  ], unreadCount: 2 });
  await act(async () => { renderer = TestRenderer.create(<MailActivitySummary />); });
  const output = JSON.stringify(renderer.toJSON());
  expect(output).toContain('Please confirm the delivery date.');
  expect(output).toContain('New inquiry');
  expect(output).toContain('Already read');
});
