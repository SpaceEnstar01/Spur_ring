import {
  getConnectionCredential,
  getCreatorAgentToken,
  getCreatorAgentUrl,
} from './creatorAgentApi';
export type ConnectionProvider = 'youtube' | 'notion';
export type AppConnection = {
  provider: ConnectionProvider;
  state: 'connected' | 'disconnected' | 'needs_reconnect' | 'unavailable';
  configured: boolean;
  label: string;
  message: string;
  connectedAt: string | null;
};
async function request<T>(path: string, method = 'GET'): Promise<T> {
  const base = await getCreatorAgentUrl();
  if (!base) throw new Error('请先在设置中配置 Personal Agent 服务');
  if (!__DEV__ && !base.startsWith('https://'))
    throw new Error('应用连接仅支持 HTTPS');
  const token = await getCreatorAgentToken(base);
  if (!token) throw new Error('请先配置 Personal Agent 访问令牌');
  const connection = await getConnectionCredential(base, token);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 65000);
  try {
    const r = await fetch(`${base}/api/creator-agent/connections${path}`, {
      method,
      signal: controller.signal,
      redirect: 'error',
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Spur-Connection': connection,
        Accept: 'application/json',
      },
    });
    const data = await r.json().catch(() => null);
    if (!r.ok || !data)
      throw new Error(
        data?.error || `连接服务不可用（${r.status}），请确认云端已更新`,
      );
    return data;
  } finally {
    clearTimeout(timer);
  }
}
export const readAppConnections = () =>
  request<{ connections: AppConnection[] }>('');
export const startAppConnection = (provider: ConnectionProvider) =>
  request<{ authorizationUrl: string }>(`/${provider}/start`, 'POST');
export const disconnectApp = (provider: ConnectionProvider) =>
  request(`/${provider}/disconnect`, 'POST');
