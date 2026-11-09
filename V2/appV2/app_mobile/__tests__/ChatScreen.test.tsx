import { useNotesStore } from '../src/notes/useNotesStore';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { TextInput } from 'react-native';
import { ChatScreen } from '../src/screens/ChatScreen';
import { chat } from '../src/services/chatApi';
import { useRecordingStore } from '../src/ring/store/useRecordingStore';

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: 'SafeAreaView',
}));
jest.mock('react-native-markdown-display', () => 'Markdown');
jest.mock('../src/services/chatApi', () => ({ chat: jest.fn() }));
const navigation = { goBack: jest.fn() };
let renderer: TestRenderer.ReactTestRenderer;
beforeEach(() => {
  jest.clearAllMocks();
  (chat as jest.Mock).mockResolvedValue('建议带上身份证和雨伞。');
});
afterEach(async () => {
  await act(() => renderer?.unmount());
});
async function mount(params: {
  initialText?: string;
  recordingUri?: string;
  autoSend?: boolean;
  requestId?: string;
}) {
  await act(async () => {
    renderer = TestRenderer.create(
      <ChatScreen
        navigation={navigation as never}
        route={{ key: 'chat', name: 'Chat', params }}
      />,
    );
  });
}
test('a voice handoff automatically sends once and renders the actual AI response', async () => {
  await mount({
    initialText: '上海旅行带什么？',
    autoSend: true,
    requestId: 'recording-1',
  });
  expect(chat).toHaveBeenCalledTimes(1);
  expect(chat).toHaveBeenCalledWith(
    [{ role: 'user', content: '上海旅行带什么？' }],
    expect.any(String),
    expect.any(AbortSignal),
    expect.any(Function),
  );
  expect(
    renderer.root.findAll(
      node => node.props.children === '建议带上身份证和雨伞。',
    ).length,
  ).toBeGreaterThan(0);
});
test('prefilling without autoSend allows edits and never sends without a tap', async () => {
  await mount({ initialText: '草稿' });
  await act(async () =>
    renderer.root.findByType(TextInput).props.onChangeText('修改后的问题'),
  );
  expect(renderer.root.findByType(TextInput).props.value).toBe('修改后的问题');
  expect(chat).not.toHaveBeenCalled();
});

test('streams before completion and retries without sending incomplete answer as history', async () => {
  let reject!: (error: Error) => void;
  (chat as jest.Mock).mockImplementationOnce(
    (_messages, _context, _signal, partial) => {
      partial('尚未生成完的回复');
      return new Promise((_resolve, fail) => {
        reject = fail;
      });
    },
  );
  await mount({
    initialText: '测试流式问题',
    autoSend: true,
    requestId: 'stream-test',
  });
  expect(
    renderer.root.findAll(node => node.props.children === '尚未生成完的回复')
      .length,
  ).toBeGreaterThan(0);
  await act(async () => {
    reject(new Error('模型连接中断'));
  });
  expect(
    renderer.root.findAll(node => node.props.children === '尚未生成完的回复')
      .length,
  ).toBeGreaterThan(0);
  expect(chat).toHaveBeenCalledTimes(1);
  const send = renderer.root.findAll(
    node => node.props.accessibilityLabel === '发送消息',
  )[0];
  await act(async () => {
    await send.props.onPress();
  });
  expect(chat).toHaveBeenLastCalledWith(
    [{ role: 'user', content: '测试流式问题' }],
    expect.any(String),
    expect.any(AbortSignal),
    expect.any(Function),
  );
});
test('failed auto reply retains question for manual retry instead of looping', async () => {
  (chat as jest.Mock).mockRejectedValueOnce(new Error('服务连接失败'));
  await mount({
    initialText: '我的问题',
    autoSend: true,
    requestId: 'retry-1',
  });
  expect(chat).toHaveBeenCalledTimes(1);
  expect(renderer.root.findByType(TextInput).props.value).toBe('我的问题');
  const send = renderer.root.findAll(
    node => node.props.accessibilityLabel === '发送消息',
  )[0];
  await act(async () => {
    await send.props.onPress();
  });
  expect(chat).toHaveBeenCalledTimes(2);
});
test('another recording request is sent even when the spoken words are identical', async () => {
  await mount({ initialText: '你好', autoSend: true, requestId: 'first' });
  await act(async () =>
    renderer.update(
      <ChatScreen
        navigation={navigation as never}
        route={{
          key: 'chat',
          name: 'Chat',
          params: { initialText: '你好', autoSend: true, requestId: 'second' },
        }}
      />,
    ),
  );
  expect(chat).toHaveBeenCalledTimes(2);
});

test('continuing a recording reply restores its question and answer without requesting twice', async () => {
  useRecordingStore.setState({
    files: [
      {
        uri: 'file:///recording.m4a',
        name: 'recording.m4a',
        size: 1,
        timestamp: 1,
        transcript: '怎么准备会议？',
        aiReply: '先准备议程和资料。',
        aiReplyState: 'done',
      },
    ],
  });
  await mount({ recordingUri: 'file:///recording.m4a' });
  const tree = JSON.stringify(renderer.toJSON());
  expect(tree).toContain('怎么准备会议？');
  expect(tree).toContain('先准备议程和资料。');
  expect(chat).not.toHaveBeenCalled();
  await act(() =>
    renderer.root.findByType(TextInput).props.onChangeText('详细一点'),
  );
  const send = renderer.root.findAll(
    node => node.props.accessibilityLabel === '发送消息',
  )[0];
  await act(async () => {
    await send.props.onPress();
  });
  expect(chat).toHaveBeenCalledWith(
    [
      { role: 'user', content: '怎么准备会议？' },
      { role: 'assistant', content: '先准备议程和资料。' },
      { role: 'user', content: '详细一点' },
    ],
    expect.any(String),
    expect.any(AbortSignal),
    expect.any(Function),
  );
});

test('ordinary chat does not attach unrelated local notes', async () => {
  useNotesStore.setState({
    notes: [
      {
        id: 'unrelated',
        title: '私人记录',
        text: '不应附带的文字',
        createdAt: 1,
      },
    ],
  });
  await mount({
    initialText: '测试问题',
    autoSend: true,
    requestId: 'isolated-chat',
  });
  expect(chat).toHaveBeenCalledWith(
    [{ role: 'user', content: '测试问题' }],
    '',
    expect.any(AbortSignal),
    expect.any(Function),
  );
});
