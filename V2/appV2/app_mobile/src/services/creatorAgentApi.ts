import { postCreatorAgentChat } from './creatorAgentTransport';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeModules } from 'react-native';
import { URL } from 'react-native-url-polyfill';

const CREATOR_AGENT_URL_KEY = 'spur-v2-creator-agent-url';
const PRODUCTION_CREATOR_AGENT_URL = '';
const CREATOR_AGENT_TOKEN_SCOPE = 'spur-creator-agent-bearer-v1:';
const CREATOR_AGENT_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const POLL_INTERVAL_MS = 2000;
const TASK_TIMEOUT_MS = 8 * 60 * 1000 + 30_000;

export type CreatorAgentProgress = {
  status?: 'running' | 'finished' | 'failed';
  progress: string;
};

export type CreatorAgentSource = { title: string; url: string };
export type CreatorAgentArtifact = { title: string; url: string };

export type CreatorAgentResult = {
  requestId: string;
  response: string;
  sources: CreatorAgentSource[];
  artifacts: CreatorAgentArtifact[];
};

function identityStore() {
  const identity = NativeModules.SpurIdentity;
  if (!identity?.read || !identity?.write) {
    throw new Error('此版本没有安全凭据存储模块，请更新 Spur App');
  }
  return identity as {
    read(scope: string): Promise<string | null>;
    write(scope: string, value: string): Promise<boolean>;
  };
}

function tokenScope(base: string) {
  return `${CREATOR_AGENT_TOKEN_SCOPE}${normalizeCreatorAgentUrl(base)}`;
}

export async function getCreatorAgentToken(base: string) {
  const token = await identityStore().read(tokenScope(base));
  if (!token) return '';
  if (!CREATOR_AGENT_TOKEN_PATTERN.test(token)) {
    throw new Error('Personal Agent 安全凭据无效，请重新保存访问令牌');
  }
  return token;
}

export async function hasCreatorAgentToken(base: string) {
  return Boolean(await getCreatorAgentToken(base));
}

export async function saveCreatorAgentToken(base: string, value: string) {
  const token = value.trim();
  if (token && !CREATOR_AGENT_TOKEN_PATTERN.test(token)) {
    throw new Error('访问令牌格式无效，请粘贴 ECS 配置的 43 位令牌');
  }
  const saved = await identityStore().write(tokenScope(base), token);
  if (!saved) throw new Error('访问令牌未能保存到系统安全存储');
}

const connectionEnrollments = new Map<string, Promise<string>>();
export async function getConnectionCredential(
  base: string,
  bearer: string,
): Promise<string> {
  const scope = `spur-app-connections-v1:${normalizeCreatorAgentUrl(base)}`;
  const stored = await identityStore().read(scope);
  if (stored) {
    if (!CREATOR_AGENT_TOKEN_PATTERN.test(stored))
      throw new Error('应用连接身份损坏，请联系管理员');
    return stored;
  }
  const existing = connectionEnrollments.get(scope);
  if (existing) return existing;
  const pending = (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const r = await fetch(`${base}/api/creator-agent/connections/profile`, {
        method: 'POST',
        redirect: 'error',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${bearer}`,
          Accept: 'application/json',
        },
      });
      const data = await r.json().catch(() => null);
      if (!r.ok || !CREATOR_AGENT_TOKEN_PATTERN.test(data?.credential || ''))
        throw new Error('无法建立应用连接身份，请确认云端已更新连接服务');
      if (!(await identityStore().write(scope, data.credential)))
        throw new Error('无法安全保存应用连接身份');
      return data.credential as string;
    } finally {
      clearTimeout(timer);
    }
  })();
  connectionEnrollments.set(scope, pending);
  try {
    return await pending;
  } finally {
    connectionEnrollments.delete(scope);
  }
}

function isLocalService(value: string) {
  try {
    const host = new URL(value).hostname.toLowerCase();
    return (
      host === 'localhost' ||
      host.endsWith('.localhost') ||
      host.endsWith('.local') ||
      /^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(host) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
      /^\[?(::1|fe80:|fc[0-9a-f]{2}:|fd[0-9a-f]{2}:)/.test(host)
    );
  } catch {
    return false;
  }
}

export function normalizeCreatorAgentUrl(value: string) {
  try {
    const url = new URL(value.trim());
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      !url.hostname ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      throw new Error();
    }
    return url.toString().replace(/\/+$/, '');
  } catch {
    throw new Error('请输入有效的 Personal Agent http:// 或 https:// 服务地址');
  }
}

export function getDefaultCreatorAgentUrl() {
  if (__DEV__) {
    const configured = NativeModules.SuprConfig?.creatorAgentApiUrl;
    if (typeof configured === 'string' && configured.trim()) {
      try {
        return normalizeCreatorAgentUrl(configured);
      } catch {
        // Use the explicit Settings override when a build setting is invalid.
      }
    }
  }
  return PRODUCTION_CREATOR_AGENT_URL;
}

export async function getCreatorAgentUrl() {
  const stored = await AsyncStorage.getItem(CREATOR_AGENT_URL_KEY);
  if (__DEV__) return stored || getDefaultCreatorAgentUrl();
  if (stored) {
    try {
      const normalized = normalizeCreatorAgentUrl(stored);
      if (
        new URL(normalized).protocol === 'https:' &&
        !isLocalService(normalized)
      ) {
        return normalized;
      }
    } catch {
      // Discard a development-only address in a Release build.
    }
    await AsyncStorage.removeItem(CREATOR_AGENT_URL_KEY);
  }
  return getDefaultCreatorAgentUrl();
}

export async function setCreatorAgentUrl(value: string) {
  const normalized = normalizeCreatorAgentUrl(value);
  if (
    !__DEV__ &&
    (new URL(normalized).protocol !== 'https:' || isLocalService(normalized))
  ) {
    throw new Error('正式版本的 Personal Agent 必须使用公网 HTTPS 地址');
  }
  await AsyncStorage.setItem(CREATOR_AGENT_URL_KEY, normalized);
}

export async function testCreatorAgentConnection(
  value: string,
  signal: AbortSignal,
) {
  const base = normalizeCreatorAgentUrl(value);
  const token = await getCreatorAgentToken(base);
  if (!token) throw new Error('请先保存 Personal Agent 访问令牌');
  let response: Response;
  try {
    response = await fetch(`${base}/api/creator-agent/health`, {
      signal,
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new Error(`无法连接 Personal Agent（${base}），请检查地址和网络`);
  }
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.status !== 'ready') {
    throw new Error(
      data?.error || `Personal Agent 暂不可用（${response.status}）`,
    );
  }
}

export function newCreatorAgentRequestId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, char => {
    const random = Math.floor(Math.random() * 16);
    return (char === 'x' ? random : (random % 4) + 8).toString(16);
  });
}

function progressLabel(task: any) {
  const tool = task?.activity?.tool;
  const labels: Record<string, string> = {
    update_plan: '正在制定执行步骤',
    web_search: '正在搜索公开资料',
    web_fetch: '正在读取网页资料',
    browser_navigate: '正在浏览网页',
    browser_snapshot: '正在核对网页内容',
    creator_video_metadata: '正在查找视频资料',
    creator_transcript: '正在读取视频字幕',
    research_capabilities: '正在检查研究工具',
    research_search: '正在检索公开内容',
    save_document: '正在整理交付文件',
    image_generate: '正在生成图片',
    video_generate: '正在提交视频生成任务',
  };
  if (tool && labels[tool]) return labels[tool];
  const activeStep = task?.plan?.steps?.find(
    (step: { status?: string }) => step.status === 'in_progress',
  );
  if (activeStep?.title) return activeStep.title;
  if (task?.status === 'finished') return '任务完成，正在整理结果';
  if (task?.status === 'failed') return '任务未完成';
  return 'Personal Agent 正在处理任务';
}

async function readTaskStatus(
  base: string,
  requestId: string,
  token: string,
  signal: AbortSignal,
  connection: string,
) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener('abort', abort, { once: true });
  if (signal.aborted) controller.abort();
  const timer = setTimeout(abort, 15000);
  try {
    const response = await fetch(
      `${base}/api/creator-agent/tasks/${requestId}`,
      {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
          'X-Spur-Connection': connection,
        },
      },
    );
    if (response.status === 404) return null;
    if (!response.ok)
      throw Object.assign(new Error(`读取任务进度失败（${response.status}）`), {
        status: response.status,
      });
    return await response.json();
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', abort);
  }
}

export async function runCreatorAgentTask(input: {
  message: string;
  requestId: string;
  signal: AbortSignal;
  onProgress?: (progress: CreatorAgentProgress) => void;
}): Promise<CreatorAgentResult> {
  const base = await getCreatorAgentUrl();
  if (!base) throw new Error('尚未配置 Personal Agent 服务地址');
  const token = await getCreatorAgentToken(base);
  if (!token) throw new Error('请先在设置中保存 Personal Agent 访问令牌');
  if (!__DEV__ && !base.startsWith('https://')) {
    throw new Error('正式版本的 Personal Agent 仅允许 HTTPS');
  }
  const connection = await getConnectionCredential(base, token);
  const controller = new AbortController();
  const abort = () => controller.abort();
  input.signal.addEventListener('abort', abort, { once: true });
  if (input.signal.aborted) controller.abort();
  const timedOut = setTimeout(() => controller.abort(), TASK_TIMEOUT_MS);
  let result: any = null;
  try {
    try {
      const response = await postCreatorAgentChat(
        `${base}/api/creator-agent/chat`,
        {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
          'X-Spur-Connection': connection,
        },
        JSON.stringify({
          requestId: input.requestId,
          message: input.message,
          history: [],
          async: true,
        }),
        controller.signal,
        15000,
      );
      const data = await response.json().catch(() => null);
      if (response.status === 202 || response.status === 409) {
        if (data?.runId !== input.requestId)
          throw new Error('服务返回的任务编号不一致');
      } else if (response.ok) result = data;
      else
        throw Object.assign(
          new Error(data?.error || `任务提交失败（${response.status}）`),
          { status: response.status },
        );
    } catch (error) {
      if (controller.signal.aborted || (error as { status?: number }).status)
        throw error;
      // A lost acknowledgement does not imply the task was not created. Poll the same ID; never POST again.
      input.onProgress?.({ progress: '提交回执中断，正在核对云端任务…' });
    }
    let missing = 0;
    while (!result && !controller.signal.aborted) {
      let task;
      try {
        task = await readTaskStatus(
          base,
          input.requestId,
          token,
          controller.signal,
          connection,
        );
      } catch (error) {
        if (
          [401, 403, 500].includes((error as { status?: number }).status || 0)
        )
          throw error;
        if (controller.signal.aborted) break;
        input.onProgress?.({ progress: '连接暂时中断，正在恢复任务进度…' });
      }
      if (task) {
        missing = 0;
        input.onProgress?.({
          status: task.status,
          progress: progressLabel(task),
        });
        if (task.status === 'failed')
          throw new Error(task.error || '云端任务执行失败');
        if (task.status === 'finished') {
          if (!task.result)
            throw new Error(
              '云端任务已完成，但服务尚未提供可领取的结果，请保留任务编号。',
            );
          result = task.result;
          break;
        }
      } else if (task === null && ++missing >= 5)
        throw new Error(
          '未查询到云端任务，提交可能未成功；请保留任务编号核对。',
        );
      await new Promise<void>(resolve => {
        const done = () => {
          clearTimeout(timer);
          controller.signal.removeEventListener('abort', done);
          resolve();
        };
        const timer = setTimeout(done, POLL_INTERVAL_MS);
        controller.signal.addEventListener('abort', done, { once: true });
        if (controller.signal.aborted) done();
      });
    }
    if (controller.signal.aborted) throw new Error('停止等待任务');
    if (typeof result?.response !== 'string' || !result.response.trim()) {
      throw new Error('Personal Agent 没有返回有效结果');
    }
    return {
      requestId: result.runId || input.requestId,
      response: result.response,
      sources: Array.isArray(result.sources) ? result.sources : [],
      artifacts: Array.isArray(result.artifacts)
        ? result.artifacts.map((artifact: CreatorAgentArtifact) => ({
            ...artifact,
            url: artifact.url.startsWith('http')
              ? artifact.url
              : `${base}${artifact.url}`,
          }))
        : [],
    };
  } catch (error) {
    if (controller.signal.aborted) {
      throw Object.assign(
        new Error(
          input.signal.aborted
            ? '已停止等待 Personal Agent。任务可能仍在云端运行，请先核对任务状态再重试。'
            : 'Personal Agent 执行超时。请先核对任务状态再重试。',
        ),
        { name: 'AbortError' },
      );
    }
    throw new Error(
      `${error instanceof Error ? error.message : '任务连接失败'}\n任务编号：${
        input.requestId
      }`,
    );
  } finally {
    clearTimeout(timedOut);
    input.signal.removeEventListener('abort', abort);
  }
}
