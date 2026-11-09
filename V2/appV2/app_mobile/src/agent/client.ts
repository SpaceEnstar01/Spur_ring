import { JAVA_AGENT_ENABLED, JAVA_AGENT_UNAVAILABLE } from '../config/backend';
import { NativeModules } from 'react-native';
import { getApiUrl } from '../services/chatApi';
import type { Receipt, Ticket } from './types';
import { useAgentSettings } from './settings';

export type SecureState = {
  deviceId: string;
  token: string;
  pending?: { ticket: Ticket; receipt?: Receipt };
};
const identity = () => {
  if (!NativeModules.SpurIdentity)
    throw new Error('请安装包含安全身份模块的新版 Spur');
  return NativeModules.SpurIdentity as {
    read(scope: string): Promise<string | null>;
    write(scope: string, value: string): Promise<boolean>;
    newId(): Promise<string>;
  };
};
export const newAgentId = () => identity().newId();
export async function readSecure(base: string): Promise<SecureState | null> {
  const raw = await identity().read(base);
  if (!raw) return null;
  const s = JSON.parse(raw) as SecureState;
  if (
    !/^[0-9a-f-]{36}$/i.test(s.deviceId) ||
    !/^[A-Za-z0-9_-]{43}$/.test(s.token)
  )
    throw new Error('安全身份无效，请勿重置凭据，先联系维护人员');
  return s;
}
export const writeSecure = (base: string, state: SecureState) =>
  identity().write(base, JSON.stringify(state));
export async function agentRequest<T>(
  path: string,
  body?: unknown,
  publicBase?: string,
): Promise<T> {
  if (!JAVA_AGENT_ENABLED) throw new Error(JAVA_AGENT_UNAVAILABLE);
  const base = publicBase || useAgentSettings.getState().base;
  if (!base || base !== (await getApiUrl()))
    throw new Error(
      '服务地址已改变，请先恢复原 Agent 地址，避免身份和执行状态错配',
    );
  if (!__DEV__ && !base.startsWith('https://'))
    throw new Error('Agent 仅允许 HTTPS 服务');
  const credential = publicBase ? null : await readSecure(base);
  if (!publicBase && !credential) throw new Error('本机身份尚未建立');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 75000);
  try {
    const response = await fetch(`${base}/api/agent${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      signal: controller.signal,
      redirect: 'error',
      headers: {
        'Content-Type': 'application/json',
        ...(path === '/records' || /^\/records\/[^/]+\/retry$/.test(path)
          ? { 'X-Spur-Async': 'true' }
          : {}),
        ...(credential ? { Authorization: `Bearer ${credential.token}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(
        data.message ||
          `Agent 服务不可用（${response.status}），未确认执行成功`,
      );
    }
    return (await response.json()) as T;
  } catch (e) {
    if (controller.signal.aborted)
      throw new Error('Agent 请求超时，原文保留；请刷新核对，不会盲目重复执行');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
