import { NativeModules } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { runCreatorAgentTask } from '../src/services/creatorAgentApi';
import { postCreatorAgentChat } from '../src/services/creatorAgentTransport';
jest.mock('../src/services/creatorAgentTransport', () => ({
  postCreatorAgentChat: jest.fn(),
}));
const id = '12345678-1234-4234-8234-123456789abc';
const result = {
  runId: id,
  response: 'Actual saved answer',
  sources: [],
  artifacts: [],
};
beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
    'https://agent.example.test',
  );
  NativeModules.SpurIdentity = {
    read: jest.fn(async () => 'a'.repeat(43)),
    write: jest.fn(async () => true),
  };
});
afterEach(() => jest.useRealTimers());
function response(status: number, data: unknown) {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => data,
  } as Response;
}
test('submits once, polls through a long task and receives its persisted answer', async () => {
  (postCreatorAgentChat as jest.Mock).mockResolvedValue(
    response(202, { runId: id }),
  );
  let count = 0;
  global.fetch = jest.fn(async () => {
    count++;
    return response(
      200,
      count < 40 ? { status: 'running' } : { status: 'finished', result },
    );
  });
  const p = runCreatorAgentTask({
    requestId: id,
    message: 'research',
    signal: new AbortController().signal,
  });
  await jest.advanceTimersByTimeAsync(85000);
  expect((await p).response).toBe('Actual saved answer');
  expect(postCreatorAgentChat).toHaveBeenCalledTimes(1);
  expect(
    JSON.parse((postCreatorAgentChat as jest.Mock).mock.calls[0][2]).async,
  ).toBe(true);
});
test('lost submit acknowledgement recovers same task without duplicate POST', async () => {
  (postCreatorAgentChat as jest.Mock).mockRejectedValue(
    new Error('connection lost'),
  );
  global.fetch = jest.fn(async () =>
    response(200, { status: 'finished', result }),
  );
  const p = runCreatorAgentTask({
    requestId: id,
    message: 'research',
    signal: new AbortController().signal,
  });
  await jest.advanceTimersByTimeAsync(1);
  expect((await p).requestId).toBe(id);
  expect(postCreatorAgentChat).toHaveBeenCalledTimes(1);
  expect((global.fetch as jest.Mock).mock.calls[0][0]).toContain(
    '/tasks/' + id,
  );
});
test('duplicate ID resumes its existing result; failed task reports its real error', async () => {
  (postCreatorAgentChat as jest.Mock).mockResolvedValue(
    response(409, { runId: id }),
  );
  global.fetch = jest.fn(async () =>
    response(200, { status: 'finished', result }),
  );
  await expect(
    runCreatorAgentTask({
      requestId: id,
      message: 'research',
      signal: new AbortController().signal,
    }),
  ).resolves.toMatchObject({ response: 'Actual saved answer' });
  (postCreatorAgentChat as jest.Mock).mockResolvedValue(
    response(202, { runId: id }),
  );
  global.fetch = jest.fn(async () =>
    response(200, { status: 'failed', error: 'Source unavailable' }),
  );
  await expect(
    runCreatorAgentTask({
      requestId: id,
      message: 'research',
      signal: new AbortController().signal,
    }),
  ).rejects.toThrow('Source unavailable');
});
