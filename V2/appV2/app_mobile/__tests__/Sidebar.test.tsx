import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { AccessibilityInfo, Alert } from 'react-native';
import { Sidebar } from '../src/components/Sidebar';
import { HomeScreen } from '../src/screens/HomeScreen';
import { selectionHaptic } from '../src/services/haptics';
import { useNotesStore } from '../src/notes/useNotesStore';
import { useRecordingStore } from '../src/ring/store/useRecordingStore';
import { phoneAudio } from '../src/services/phoneAudio';
import { useRingStore } from '../src/ring/store/useRingStore';
import { ringConnectionService } from '../src/ring/RingConnectionService';

jest.mock('../src/services/phoneAudio', () => ({
  phoneAudio: {
    deleteRecording: jest.fn().mockResolvedValue(undefined),
    stopPlayback: jest.fn(),
  },
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: 'SafeAreaView',
  SafeAreaProvider: 'SafeAreaProvider',
}));
jest.mock('../src/services/haptics', () => ({ selectionHaptic: jest.fn() }));
jest.mock('../src/ring/RingConnectionService', () => ({
  ringConnectionService: {
    reconnectLast: jest.fn().mockResolvedValue(undefined),
    syncRecordings: jest.fn().mockResolvedValue(undefined),
  },
}));
let renderer: TestRenderer.ReactTestRenderer;
const onClose = jest.fn();
const onFilter = jest.fn();
const onNavigate = jest.fn();
beforeEach(() => {
  jest.clearAllMocks();
  jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockResolvedValue(true);
  useNotesStore.setState({ notes: [] });
  useRecordingStore.setState({ files: [] });
  useRingStore.setState({ status: 'idle', syncError: null, syncProgress: 0 });
});
afterEach(async () => {
  await act(() => renderer?.unmount());
  jest.restoreAllMocks();
});
async function mountSidebar() {
  await act(() => {
    renderer = TestRenderer.create(
      <Sidebar
        visible
        onClose={onClose}
        onFilter={onFilter}
        onNavigate={onNavigate}
        filter="all"
        counts={{ all: 3, notes: 1, recordings: 2 }}
        deviceLabel="未连接"
        online={false}
      />,
    );
  });
}

test('home shows sync progress and retries failures without opening the device page', async () => {
  const navigate = jest.fn();
  useRingStore.setState({ status: 'syncing', syncProgress: 42 });
  await act(() => {
    renderer = TestRenderer.create(
      <HomeScreen
        navigation={{ navigate } as never}
        route={{ key: 'home', name: 'Home' }}
      />,
    );
  });
  expect(JSON.stringify(renderer.toJSON())).toContain('正在同步戒指录音');
  expect(JSON.stringify(renderer.toJSON())).toContain('42');
  await act(() =>
    useRingStore.setState({
      status: 'connected',
      syncError: '录音同步未完成，请重试',
    }),
  );
  await act(async () => {
    await button('重试戒指录音同步').props.onPress();
  });
  expect(ringConnectionService.syncRecordings).toHaveBeenCalledTimes(1);
  expect(navigate).not.toHaveBeenCalled();
});
function button(label: string) {
  return renderer.root
    .findAll(node => node.props.accessibilityLabel === label)
    .find(node => node.props.accessibilityLabel === label)!;
}
test('content selection gives one haptic, selects filter and closes', async () => {
  await mountSidebar();
  await act(() => button('创作空间').props.onPress());
  expect(onFilter).toHaveBeenCalledWith('notes');
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(selectionHaptic).toHaveBeenCalledTimes(1);
  expect(button('Agent Workspace').props.accessibilityState.selected).toBe(true);
});
test('creative workspace replaces text notes without a duplicate placeholder', async () => {
  await mountSidebar();
  const workspace = button('创作空间');
  expect(workspace.props.disabled).not.toBe(true);
  expect(workspace.props.onPress).toBeDefined();
  const rendered = JSON.stringify(renderer.toJSON());
  expect(rendered).not.toContain('文字笔记');
  expect(rendered).not.toContain('即将开放');
  expect(rendered).not.toContain('暂未开放');
});
test('all utility items navigate to real screens', async () => {
  await mountSidebar();
  for (const [label, destination] of [
    ['Spur AI', 'Chat'],
    ['新建笔记', 'Note'],
    ['手机录音', 'Recorder'],
    ['设置', 'Settings'],
    ['我的戒指，未连接', 'Device'],
  ]) {
    await act(() => button(label).props.onPress());
    expect(onNavigate).toHaveBeenLastCalledWith(destination);
  }
});
test('backdrop dismisses without navigation', async () => {
  await mountSidebar();
  await act(() => button('关闭侧边栏').props.onPress());
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(onNavigate).not.toHaveBeenCalled();
  expect(onFilter).not.toHaveBeenCalled();
});
test('home filtering deduplicates recording notes and shows the right content', async () => {
  useNotesStore.setState({
    notes: [
      { id: 'text', title: '文字测试', text: '灵感', createdAt: 1 },
      {
        id: 'audio',
        title: '录音笔记测试',
        text: '转写',
        createdAt: 2,
        recordingUri: 'file:///ring.ogg',
      },
    ],
  });
  useRecordingStore.setState({
    files: [
      { uri: 'file:///ring.ogg', name: '已合并录音', timestamp: 2, size: 1 },
      { uri: 'file:///phone.m4a', name: '手机录音测试', timestamp: 3, size: 1 },
    ],
  });
  await act(() => {
    renderer = TestRenderer.create(
      <HomeScreen
        navigation={{ navigate: jest.fn() } as never}
        route={{ key: 'home', name: 'Home' }}
      />,
    );
  });
  const sidebar = () => renderer.root.findByType(Sidebar);
  expect(sidebar().props.counts).toEqual({ all: 3, notes: 1, recordings: 2 });
  await act(() => button('Open sidebar').props.onPress());
  expect(sidebar().props.visible).toBe(true);
  await act(() => sidebar().props.onFilter('notes'));
  let tree = JSON.stringify(renderer.toJSON());
  expect(tree).toContain('文字测试');
  expect(tree).not.toContain('手机录音测试');
  await act(() => sidebar().props.onFilter('recordings'));
  tree = JSON.stringify(renderer.toJSON());
  expect(tree).toContain('录音笔记测试');
  expect(tree).toContain('手机录音测试');
  expect(tree).not.toContain('文字测试');
});

test('home tap opens detail; long press requires confirmation before deleting audio and linked notes', async () => {
  const navigate = jest.fn();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const file = {
    uri: 'file:///phone.m4a',
    name: 'phone.m4a',
    timestamp: 3,
    size: 10,
    source: 'phone' as const,
    transcript: '今天的新想法。继续完善。',
  };
  useRecordingStore.setState({ files: [file], deletedUris: [] });
  useNotesStore.setState({
    notes: [
      {
        id: 'linked',
        title: 'phone.m4a',
        text: file.transcript,
        recordingUri: file.uri,
        createdAt: 3,
      },
    ],
  });
  await act(() => {
    renderer = TestRenderer.create(
      <HomeScreen
        navigation={{ navigate } as never}
        route={{ key: 'home', name: 'Home' }}
      />,
    );
  });
  await act(() =>
    renderer.root.findByType(Sidebar).props.onFilter('recordings'),
  );
  const card = button('查看 今天的新想法');
  await act(() => card.props.onPress());
  expect(navigate).toHaveBeenCalledWith('Note', { recordingUri: file.uri });
  expect(Alert.alert).not.toHaveBeenCalled();
  await act(() => card.props.onLongPress());
  expect(selectionHaptic).toHaveBeenCalledTimes(1);
  expect(phoneAudio.deleteRecording).not.toHaveBeenCalled();
  const actions = (Alert.alert as jest.Mock).mock.calls.at(-1)[2];
  expect(actions[0].style).toBe('cancel');
  await act(async () => {
    await actions
      .find((item: { style: string }) => item.style === 'destructive')
      .onPress();
  });
  expect(phoneAudio.deleteRecording).toHaveBeenCalledWith(file.uri);
  expect(useRecordingStore.getState().files).toEqual([]);
  expect(useNotesStore.getState().notes).toEqual([]);
});

test('home long press deletes an ordinary note only after confirmation', async () => {
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  useNotesStore.setState({
    notes: [{ id: 'draft', title: '文字灵感', text: '内容', createdAt: 1 }],
  });
  await act(() => {
    renderer = TestRenderer.create(
      <HomeScreen
        navigation={{ navigate: jest.fn() } as never}
        route={{ key: 'home', name: 'Home' }}
      />,
    );
  });
  await act(() => renderer.root.findByType(Sidebar).props.onFilter('notes'));
  await act(() => button('查看 文字灵感').props.onLongPress());
  expect(useNotesStore.getState().notes).toHaveLength(1);
  const actions = (Alert.alert as jest.Mock).mock.calls.at(-1)[2];
  await act(async () => {
    await actions
      .find((item: { style: string }) => item.style === 'destructive')
      .onPress();
  });
  expect(useNotesStore.getState().notes).toEqual([]);
  expect(phoneAudio.deleteRecording).not.toHaveBeenCalled();
});
