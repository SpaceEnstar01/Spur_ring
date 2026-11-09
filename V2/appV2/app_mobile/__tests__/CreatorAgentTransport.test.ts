import { postCreatorAgentChat } from '../src/services/creatorAgentTransport';
class Request {
  static last: Request;
  timeout = 0;
  status = 200;
  responseText = '{"response":"ok"}';
  onload = () => {};
  onerror = () => {};
  ontimeout = () => {};
  onabort = () => {};
  open = jest.fn();
  setRequestHeader = jest.fn();
  send = jest.fn();
  abort = jest.fn(() => this.onabort());
  constructor() {
    Request.last = this;
  }
}
const original = global.XMLHttpRequest;
beforeEach(() => {
  global.XMLHttpRequest = Request as unknown as typeof XMLHttpRequest;
});
afterEach(() => {
  global.XMLHttpRequest = original;
});
test('native request survives one minute and has the full task timeout and scoped headers', async () => {
  jest.useFakeTimers();
  const p = postCreatorAgentChat(
    'https://example.test/chat',
    { Authorization: 'Bearer test', 'X-Spur-Connection': 'profile' },
    '{}',
    new AbortController().signal,
    510000,
  );
  expect(Request.last.timeout).toBe(510000);
  jest.advanceTimersByTime(61000);
  expect(Request.last.abort).not.toHaveBeenCalled();
  Request.last.onload();
  expect(await (await p).json()).toEqual({ response: 'ok' });
  expect(Request.last.setRequestHeader).toHaveBeenCalledWith(
    'X-Spur-Connection',
    'profile',
  );
  jest.useRealTimers();
});
test('network interruption reports uncertainty and never resubmits', async () => {
  const p = postCreatorAgentChat(
    'https://example.test/chat',
    {},
    '{}',
    new AbortController().signal,
    510000,
  );
  Request.last.onerror();
  await expect(p).rejects.toThrow('任务可能仍在云端运行');
  expect(Request.last.send).toHaveBeenCalledTimes(1);
});
test('abort settles and removes listener; response can preserve HTTP auth failures', async () => {
  const c = new AbortController();
  const p = postCreatorAgentChat(
    'https://example.test/chat',
    {},
    '{}',
    c.signal,
    510000,
  );
  c.abort();
  await expect(p).rejects.toMatchObject({ name: 'AbortError' });
  const next = postCreatorAgentChat(
    'https://example.test/chat',
    {},
    '{}',
    new AbortController().signal,
    510000,
  );
  Request.last.status = 401;
  Request.last.responseText = '{"error":"Unauthorized"}';
  Request.last.onload();
  expect((await next).status).toBe(401);
});
