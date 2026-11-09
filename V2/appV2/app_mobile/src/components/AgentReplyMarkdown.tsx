import React from 'react';
import { Linking, StyleSheet, Text } from 'react-native';
import Markdown, { MarkdownIt } from 'react-native-markdown-display';
import type { RenderRules } from 'react-native-markdown-display';
import { URL } from 'react-native-url-polyfill';

const parser = MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
  typographer: false,
});
function webUrl(value: string) {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url
      : null;
  } catch {
    return null;
  }
}
const rules: RenderRules = {
  link: (node, children, _parent, styles) => {
    const href = String(node.attributes.href || '');
    const url = webUrl(href);
    const rawLabel = (node.children || [])
      .map(child => child.content || '')
      .join('');
    const bare = rawLabel === href || node.markup === 'linkify';
    const label =
      bare && url
        ? /(^|\.)notion\.(com|so)$/.test(url.hostname)
          ? '打开 Notion 页面 ↗'
          : `打开 ${url.hostname} ↗`
        : children;
    return (
      <Text
        key={node.key}
        style={styles.link}
        accessibilityRole={url ? 'link' : undefined}
        accessibilityHint={url ? href : undefined}
        onPress={
          url
            ? () => {
                Linking.openURL(href).catch(() => {});
              }
            : undefined
        }
      >
        {label}
      </Text>
    );
  },
  image: node => (
    <Text key={node.key} style={replyStyles.link}>
      {node.attributes.alt || '图片'}
    </Text>
  ),
};
export function AgentReplyMarkdown({ children }: { children: string }) {
  return (
    <Markdown markdownit={parser} rules={rules} style={replyStyles}>
      {children}
    </Markdown>
  );
}
const replyStyles = StyleSheet.create({
  body: {
    fontSize: 15,
    lineHeight: 24,
    color: '#111827',
    marginTop: 0,
    marginBottom: 0,
  },
  paragraph: {
    marginTop: 0,
    marginBottom: 10,
    flexWrap: 'wrap',
    flexShrink: 1,
  },
  strong: { fontWeight: '700', color: '#111827' },
  heading1: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 8,
  },
  heading2: {
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '700',
    marginTop: 10,
    marginBottom: 8,
  },
  heading3: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 6,
  },
  bullet_list: { marginTop: 0, marginBottom: 10 },
  ordered_list: { marginTop: 0, marginBottom: 10 },
  list_item: { marginBottom: 5 },
  bullet_list_icon: { marginRight: 8, lineHeight: 24 },
  ordered_list_icon: { marginRight: 8, lineHeight: 24 },
  link: { color: '#3165C8', textDecorationLine: 'underline' },
  blockquote: {
    backgroundColor: '#EEF1F5',
    borderLeftColor: '#B7C5D9',
    borderLeftWidth: 3,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginVertical: 8,
  },
  code_inline: { backgroundColor: '#E9EDF2', fontSize: 13, color: '#344154' },
  fence: {
    backgroundColor: '#E9EDF2',
    fontSize: 12,
    lineHeight: 19,
    padding: 12,
    borderRadius: 8,
    marginVertical: 8,
  },
  code_block: {
    backgroundColor: '#E9EDF2',
    fontSize: 12,
    lineHeight: 19,
    padding: 12,
    borderRadius: 8,
    marginVertical: 8,
  },
  hr: { backgroundColor: '#DCE2EA', height: 1, marginVertical: 12 },
  table: {
    borderColor: '#DCE2EA',
    borderWidth: 1,
    borderRadius: 6,
    marginVertical: 8,
  },
  th: { padding: 7, backgroundColor: '#E9EDF2' },
  td: { padding: 7 },
});
