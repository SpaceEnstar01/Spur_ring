import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Linking } from 'react-native';
import { AgentReplyMarkdown } from '../src/components/AgentReplyMarkdown';
let renderer: TestRenderer.ReactTestRenderer;
afterEach(() => {
  if (renderer) act(() => renderer.unmount());
  jest.restoreAllMocks();
});
async function render(content: string) {
  await act(async () => {
    renderer = TestRenderer.create(
      <AgentReplyMarkdown>{content}</AgentReplyMarkdown>,
    );
  });
}
test('renders the screenshot bold and lists without raw markdown delimiters', async () => {
  await render(
    '请回一句就够：\n\n- 回 **「好」** → 建在 **技术推进** 下；\n- 或回复页面名称。\n\n**新建页面：手机语音联调测试**',
  );
  const tree = JSON.stringify(renderer.toJSON());
  expect(tree).toContain('技术推进');
  expect(tree).toContain('手机语音联调测试');
  expect(tree).not.toContain('**');
  expect(tree).toContain('700');
});
test('turns long bare Notion URLs into a short actionable label without changing the target', async () => {
  const href = 'https://app.notion.com/p/40ff8a68d361819ba62ff6f94632bdc5';
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  await render(`报告已完成。\n\n${href}`);
  expect(JSON.stringify(renderer.toJSON())).toContain('打开 Notion 页面');
  const link = renderer.root.findAll(
    n =>
      n.props.accessibilityRole === 'link' &&
      typeof n.props.onPress === 'function',
  )[0];
  await act(async () => link.props.onPress());
  expect(open).toHaveBeenCalledWith(href);
});
test('keeps intentional asterisks inside code and named link labels', async () => {
  await render('公式 `a * b`\n\n[查看报告](https://example.com/report)');
  const tree = JSON.stringify(renderer.toJSON());
  expect(tree).toContain('a * b');
  expect(tree).toContain('查看报告');
});
test('does not auto-load external images', async () => {
  await render('![参考图片](https://example.com/private-tracking.png)');
  const tree = JSON.stringify(renderer.toJSON());
  expect(tree).not.toContain('private-tracking.png');
  expect(tree).toContain('参考图片');
});
