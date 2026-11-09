import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useMailNotificationStore } from '../services/mailNotifications';
import { Icon } from './Icon';
export function MailActivitySummary({
  onOpen,
}: {
  onOpen?: (id?: string) => void;
}) {
  const feed = useMailNotificationStore();
  const unread = feed.notifications.filter(item => item.unread);
  const recent = feed.notifications;
  if (!recent.length) return null;
  return (
    <View style={s.root}>
      <View style={s.header}>
        <Icon name="mail" size={17} />
        <Text style={s.title}>Agent 来信 · {unread.length} 封未读</Text>
      </View>
      {recent.slice(0, 5).map(item => (
        <Pressable
          key={item.id}
          accessibilityRole="button"
          accessibilityLabel={`查看来信 ${item.subject}`}
          onPress={() => onOpen?.(item.id)}
          style={s.mail}
        >
          <Text style={s.subject}>{item.subject}</Text>
          <Text style={s.sender}>{item.unread ? '未读' : '已读'}</Text>
          <Text style={s.sender} numberOfLines={1}>{item.sender}</Text>
          <Text numberOfLines={4} style={s.summary}>
            {item.summary || (item.state === 'failed' ? '摘要暂不可用，请查看原信。' : 'Agent 正在整理来信…')}
          </Text>
          {item.needsAttention && <Text style={s.attention}>需要你处理</Text>}
          <Text style={s.action}>查看邮件与回复草稿 ↗</Text>
        </Pressable>
      ))}
      {recent.length > 5 && (
        <Pressable accessibilityRole="button" onPress={() => onOpen?.()}>
          <Text style={s.action}>查看全部近期来信 ↗</Text>
        </Pressable>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    backgroundColor: '#F0F3EC',
    borderRadius: 16,
    padding: 16,
    marginVertical: 12,
  },
  mail: { paddingVertical: 10 },
  sender: { fontSize: 12, color: '#84909E', marginTop: 5 },
  attention: { fontSize: 12, color: '#7B6840', marginTop: 8 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 12, color: '#687950', flex: 1 },
  subject: { fontSize: 15, fontWeight: '600', color: '#172033', marginTop: 12 },
  summary: { fontSize: 14, lineHeight: 21, color: '#536174', marginTop: 7 },
  action: { fontSize: 12, color: '#65784E', marginTop: 12 },
});
