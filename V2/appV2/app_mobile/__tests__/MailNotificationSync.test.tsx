import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { AppState } from 'react-native';
import { MailNotificationSync } from '../src/components/MailNotificationSync';
import { getCreatorAgentUrl } from '../src/services/creatorAgentApi';
import { emailRequest } from '../src/services/agentEmailApi';
import {
  resetMailNotifications,
  useMailNotificationStore,
} from '../src/services/mailNotifications';
jest.mock('../src/services/creatorAgentApi', () => ({
  getCreatorAgentUrl: jest.fn(),
}));
jest.mock('../src/services/agentEmailApi', () => ({ emailRequest: jest.fn() }));
let renderer: TestRenderer.ReactTestRenderer;
beforeEach(() => {
  jest.useFakeTimers();
  resetMailNotifications();
  jest.clearAllMocks();
  AppState.currentState = 'active';
  (getCreatorAgentUrl as jest.Mock).mockResolvedValue(
    'https://agent.example.test',
  );
  (emailRequest as jest.Mock).mockResolvedValue({
    enabled: true,
    initialized: true,
    lastSyncAt: null,
    error: '',
    backlog: false,
    unreadCount: 1,
    notifications: [],
  });
});
afterEach(() => {
  if (renderer) act(() => renderer.unmount());
  jest.restoreAllMocks();
  jest.useRealTimers();
});
test('automatically refreshes in foreground, pauses in background and syncs on return', async () => {
  let change: (state: any) => void = () => {};
  const remove = jest.fn();
  jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation((_event, listener) => {
      change = listener;
      return { remove };
    });
  await act(async () => {
    renderer = TestRenderer.create(<MailNotificationSync />);
  });
  expect(emailRequest).toHaveBeenCalledTimes(1);
  expect(useMailNotificationStore.getState().unreadCount).toBe(1);
  await act(async () => {
    jest.advanceTimersByTime(20000);
  });
  expect(emailRequest).toHaveBeenCalledTimes(2);
  AppState.currentState = 'background';
  await act(async () => {
    change('background');
    jest.advanceTimersByTime(40000);
  });
  expect(emailRequest).toHaveBeenCalledTimes(2);
  AppState.currentState = 'active';
  await act(async () => {
    change('active');
  });
  expect(emailRequest).toHaveBeenCalledTimes(3);
  act(() => renderer.unmount());
  expect(remove).toHaveBeenCalledTimes(1);
});
