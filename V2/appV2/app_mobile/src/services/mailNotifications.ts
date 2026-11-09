import { create } from 'zustand';
import { emailRequest } from './agentEmailApi';
export type MailNotification = {
  id: string;
  threadId: string;
  sender: string;
  subject: string;
  timestamp: string;
  unread: boolean;
  state: 'pending' | 'summarizing' | 'ready' | 'failed';
  summary: string;
  needsAttention: boolean;
};
export type MailNotificationFeed = {
  enabled: boolean;
  initialized: boolean;
  lastSyncAt: string | null;
  error: string;
  backlog: boolean;
  unreadCount: number;
  notifications: MailNotification[];
};
const empty: MailNotificationFeed = {
  enabled: false,
  initialized: false,
  lastSyncAt: null,
  error: '',
  backlog: false,
  unreadCount: 0,
  notifications: [],
};
export const useMailNotificationStore = create<MailNotificationFeed>(() => ({
  ...empty,
}));
export function resetMailNotifications() {
  useMailNotificationStore.setState({ ...empty });
}
export async function refreshMailNotifications(signal: AbortSignal) {
  const feed = await emailRequest<MailNotificationFeed>(
    '/notifications',
    signal,
  );
  if (
    !Array.isArray(feed.notifications) ||
    typeof feed.unreadCount !== 'number'
  )
    throw new Error('邮件通知格式异常，请确认服务版本');
  if (!signal.aborted) useMailNotificationStore.setState(feed);
}
export async function markMailNotificationRead(
  id: string,
  signal: AbortSignal,
) {
  const feed = await emailRequest<MailNotificationFeed>(
    `/notifications/${encodeURIComponent(id)}/read`,
    signal,
    {},
  );
  if (!feed || !Array.isArray(feed.notifications))
    throw new Error('通知状态格式异常');
  if (!signal.aborted) useMailNotificationStore.setState(feed);
}
