import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Alert } from 'react-native';
import { AgentExamples } from '../src/components/AgentExamples';
import { agentExamples, useExampleSettings } from '../src/agent/examples';

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: 'SafeAreaView',
}));
jest.mock('../src/services/haptics', () => ({ selectionHaptic: jest.fn() }));
let view: TestRenderer.ReactTestRenderer;
beforeEach(async () => {
  useExampleSettings.setState({ deletedIds: [] });
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  await act(() => {
    view = TestRenderer.create(<AgentExamples />);
  });
});
afterEach(async () => {
  await act(() => view.unmount());
  jest.restoreAllMocks();
});
const button = (label: string) =>
  view.root.findAll(node => node.props.accessibilityLabel === label)[0];
test('both examples open complete offline data and script explanations, clearly distinguished from live work', async () => {
  expect(JSON.stringify(view.toJSON())).toContain('虚构数据');
  for (const example of agentExamples) {
    await act(() => button(`查看示例 ${example.title}`).props.onPress());
    const tree = JSON.stringify(view.toJSON());
    expect(tree).toContain('不是实时搜索结果');
    for (const section of example.sections)
      expect(tree).toContain(section.title);
    await act(() => button('关闭示例详情').props.onPress());
  }
});
test('cancel preserves example; confirmed detail deletion closes it and persists visibility', async () => {
  const example = agentExamples[0];
  await act(() => button(`查看示例 ${example.title}`).props.onPress());
  await act(() => button('删除当前示例').props.onPress());
  expect(useExampleSettings.getState().deletedIds).toEqual([]);
  const actions = (Alert.alert as jest.Mock).mock.calls.at(-1)[2];
  await act(() =>
    actions
      .find((action: { text: string }) => action.text === '删除')
      .onPress(),
  );
  expect(useExampleSettings.getState().deletedIds).toEqual([example.id]);
  expect(button(`查看示例 ${example.title}`)).toBeUndefined();
  expect(button('关闭示例详情')).toBeUndefined();
  await act(() => {
    view.unmount();
    view = TestRenderer.create(<AgentExamples />);
  });
  expect(button(`查看示例 ${example.title}`)).toBeUndefined();
});
