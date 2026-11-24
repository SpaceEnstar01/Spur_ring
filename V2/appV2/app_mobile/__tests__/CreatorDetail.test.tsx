import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { CreatorDetailScreen } from '../src/creatorSpace/CreatorDetailScreen';
import { scriptTitle, suggestedEnding } from '../src/creatorSpace/content';
import { useCreatorSpace } from '../src/creatorSpace/store';

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: 'SafeAreaView',
  SafeAreaProvider: 'SafeAreaProvider',
}));

test('accepting the new ending creates a version and restoring v1 keeps the history', async () => {
  const navigation = { push: jest.fn(), goBack: jest.fn() };
  const screen = (kind: 'script' | 'versions') => (
    <CreatorDetailScreen
      navigation={navigation as never}
      route={{
        key: kind,
        name: 'CreatorDetail',
        params: { detail: { kind, title: scriptTitle } },
      }}
    />
  );
  let renderer!: TestRenderer.ReactTestRenderer;
  const topic = () =>
    useCreatorSpace.getState().topics.find(t => t.title === scriptTitle)!;
  const press = async (label: string) => {
    await act(() =>
      renderer.root
        .findAll(n => n.props.accessibilityLabel === label)[0]
        .props.onPress(),
    );
  };
  await act(() => {
    renderer = TestRenderer.create(screen('script'));
  });
  await press('编辑钩子');
  const editor = renderer.root.findAll(
    n => String(n.type) === 'SafeAreaProvider',
  )[0];
  expect(
    editor.findAll(n => n.props.accessibilityLabel === '钩子').length,
  ).toBeGreaterThan(0);
  await press('取消');
  await press('采用新结尾');
  expect(topic().versions[topic().current]).toMatchObject({
    ending: suggestedEnding,
    pending: false,
  });
  await press('版本管理');
  expect(navigation.push).toHaveBeenCalledWith('CreatorDetail', {
    detail: { kind: 'versions', title: scriptTitle },
    parent: '脚本',
  });
  await act(() => renderer.update(screen('versions')));
  await press('恢复 v1');
  expect(topic().current).toBe(0);
  expect(topic().versions).toHaveLength(5);
  await act(() => renderer.unmount());
});
