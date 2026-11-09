import { getCreatorAgentToken, getCreatorAgentUrl } from './creatorAgentApi';
export type AgentEmail = {
  id: string;
  threadId: string;
  sender: string;
  subject: string;
  timestamp: string;
  preview: string;
  body: string;
  labels: string[];
};
export type EmailDraft = {
  id: string;
  messageId: string;
  inboxId: string;
  recipient: string;
  subject: string;
  text: string;
  analysis: string;
  version: number;
  status: 'draft' | 'approved' | 'sending' | 'accepted' | 'unknown';
  acceptedAt?: string;
  error?: string;
};
export type MailStatus = {
  configured: boolean;
  inboxId: string | null;
  workflowVersion?: number;
  sendingEnabled?: boolean;
};
export async function emailRequest<T>(
  path: string,
  signal: AbortSignal,
  payload?: unknown,
): Promise<T> {
  const base = await getCreatorAgentUrl();
  if (!base) throw new Error('请先配置 Personal Agent 服务地址');
  const token = await getCreatorAgentToken(base);
  if (!token) throw new Error('请先保存 Personal Agent 访问令牌');
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener('abort', abort, { once: true });
  if (signal.aborted) controller.abort();
  const timer = setTimeout(abort, path === '/analyze' ? 510000 : 30000);
  try {
    const response = await fetch(`${base}/api/creator-agent/email${path}`, {
      method: payload === undefined ? 'GET' : 'POST',
      redirect: 'error',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok)
      throw new Error(
        result?.error || `邮件服务请求失败（${response.status}）`,
      );
    if (!result || controller.signal.aborted)
      throw new Error('邮件请求未完成，请刷新核对状态');
    return result as T;
  } catch (error) {
    if (controller.signal.aborted)
      throw new Error('邮件请求已停止等待，请刷新核对发送状态，不要直接重发。');
    throw error;
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', abort);
  }
}
