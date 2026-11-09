import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { Modal, Text } from 'react-native';
import {
  CompactAgentReply,
  replyPreview,
} from '../src/components/CompactAgentReply';
jest.mock('react-native-safe-area-context', () => {
  const ReactMock = require('react');
  const { View } = require('react-native');
  return {
    SafeAreaView: View,
    SafeAreaProvider: ({ children }: any) =>
      ReactMock.createElement(View, null, children),
    initialWindowMetrics: null,
  };
});
test('preview stays short and full response appears only after opening detail', () => {
  const full = '完整回答。'.repeat(100);
  let tree: Renderer.ReactTestRenderer;
  act(() => {
    tree = Renderer.create(
      <CompactAgentReply text={full}>
        <Text>{full}</Text>
      </CompactAgentReply>,
    );
  });
  expect(replyPreview(full).length).toBeLessThanOrEqual(161);
  expect(tree!.root.findByType(Modal).props.visible).toBe(false);
  act(() =>
    tree!.root
      .findAll(
        n =>
          n.props.accessibilityLabel === '查看完整回复' &&
          typeof n.props.onPress === 'function',
      )[0]
      .props.onPress(),
  );
  expect(tree!.root.findByType(Modal).props.visible).toBe(true);
  act(() =>
    tree!.root
      .findAll(
        n =>
          n.props.accessibilityLabel === '关闭完整回复' &&
          typeof n.props.onPress === 'function',
      )[0]
      .props.onPress(),
  );
  expect(tree!.root.findByType(Modal).props.visible).toBe(false);
  act(() => tree!.unmount());
});
test('preview removes presentation markup while original remains available', () => {
  expect(replyPreview('## 标题\n**结论** [来源](https://example.test)')).toBe(
    '标题 结论 来源',
  );
});
