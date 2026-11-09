import { chat, buildAudioAgentMessage } from '../src/services/chatApi';
import { runCreatorAgentTask } from '../src/services/creatorAgentApi';
jest.mock('../src/services/creatorAgentApi', () => ({
  newCreatorAgentRequestId: () => 'request',
  runCreatorAgentTask: jest.fn(),
}));
beforeEach(() => jest.clearAllMocks());
test('conversation and selected context go directly to Personal Agent', async () => {
  (runCreatorAgentTask as jest.Mock).mockResolvedValue({ response: '回答' });
  const publish = jest.fn();
  await expect(
    chat(
      [{ role: 'user', content: '研究公开信息' }],
      '所选上下文',
      new AbortController().signal,
      publish,
    ),
  ).resolves.toBe('回答');
  expect(runCreatorAgentTask).toHaveBeenCalledWith(
    expect.objectContaining({ message: expect.stringContaining('所选上下文') }),
  );
  expect(publish).toHaveBeenCalledWith('回答');
});
test('late completion after cancellation never publishes', async () => {
  const controller = new AbortController();
  (runCreatorAgentTask as jest.Mock).mockImplementation(async () => {
    controller.abort();
    return { response: '迟到' };
  });
  const publish = jest.fn();
  await expect(
    chat([{ role: 'user', content: '测试' }], '', controller.signal, publish),
  ).rejects.toMatchObject({ name: 'AbortError' });
  expect(publish).not.toHaveBeenCalled();
});
test('no fallback when Personal Agent configuration fails', async () => {
  (runCreatorAgentTask as jest.Mock).mockRejectedValue(
    new Error('请配置 Personal Agent'),
  );
  const fetchMock = jest.spyOn(globalThis, 'fetch');
  await expect(
    chat([{ role: 'user', content: '测试' }], '', new AbortController().signal),
  ).rejects.toThrow('请配置');
  expect(fetchMock).not.toHaveBeenCalled();
  fetchMock.mockRestore();
});
test('empty or oversized input is rejected without sending', () => {
  expect(() => buildAudioAgentMessage([], '')).toThrow('请输入');
  expect(() =>
    buildAudioAgentMessage([{ role: 'user', content: '字'.repeat(33000) }], ''),
  ).toThrow('过长');
});
