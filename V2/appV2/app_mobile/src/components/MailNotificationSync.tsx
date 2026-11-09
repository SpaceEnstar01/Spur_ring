import { useEffect } from 'react';
import { AppState } from 'react-native';
import { getCreatorAgentUrl } from '../services/creatorAgentApi';
import {
  refreshMailNotifications,
  resetMailNotifications,
  useMailNotificationStore,
} from '../services/mailNotifications';
export function MailNotificationSync() {
  useEffect(() => {
    let alive = true;
    let pending: AbortController | null = null;
    let service = '';
    async function poll() {
      if (!alive || pending || AppState.currentState !== 'active') return;
      const controller = new AbortController();
      pending = controller;
      try {
        const current = await getCreatorAgentUrl();
        if (!alive || controller.signal.aborted) return;
        if (current !== service) {
          service = current;
          resetMailNotifications();
        }
        if (!current) return;
        await refreshMailNotifications(controller.signal);
      } catch {
        if (alive && !controller.signal.aborted)
          useMailNotificationStore.setState({
            error: '邮件通知同步暂时不可用，请检查邮箱配置或网络。',
          });
      } finally {
        if (pending === controller) pending = null;
      }
    }
    poll();
    const interval = setInterval(poll, 20000);
    const listener = AppState.addEventListener('change', state => {
      if (state === 'active') poll();
      else {
        pending?.abort();
      }
    });
    return () => {
      alive = false;
      pending?.abort();
      clearInterval(interval);
      listener.remove();
    };
  }, []);
  return null;
}
