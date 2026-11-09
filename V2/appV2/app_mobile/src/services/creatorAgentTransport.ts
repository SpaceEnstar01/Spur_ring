export function postCreatorAgentChat(
  url: string,
  headers: Record<string, string>,
  body: string,
  signal: AbortSignal,
  timeoutMs: number,
): Promise<Pick<Response, 'ok' | 'status' | 'json'>> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let done = false;
    const finish = (error?: Error) => {
      if (done) return;
      done = true;
      signal.removeEventListener('abort', abort);
      if (error) reject(error);
      else {
        const text = xhr.responseText;
        resolve({
          ok: xhr.status >= 200 && xhr.status < 300,
          status: xhr.status,
          json: async () => JSON.parse(text),
        });
      }
    };
    const abort = () => {
      xhr.abort();
      finish(
        Object.assign(new Error('任务请求已停止等待'), { name: 'AbortError' }),
      );
    };
    xhr.open('POST', url);
    xhr.timeout = timeoutMs;
    for (const [key, value] of Object.entries(headers))
      xhr.setRequestHeader(key, value);
    xhr.onload = () => finish();
    xhr.onerror = () =>
      finish(
        new Error(
          '与 Personal Agent 的连接中断。任务可能仍在云端运行，请先核对任务状态，避免重复提交。',
        ),
      );
    xhr.ontimeout = () =>
      finish(
        new Error(
          '等待 Personal Agent 超时。任务可能仍在云端运行，请先核对任务状态，避免重复提交。',
        ),
      );
    xhr.onabort = () =>
      finish(
        Object.assign(new Error('任务请求已停止等待'), { name: 'AbortError' }),
      );
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) {
      abort();
      return;
    }
    try {
      xhr.send(body);
    } catch {
      finish(new Error('无法发出 Personal Agent 请求，请检查网络连接。'));
    }
  });
}
