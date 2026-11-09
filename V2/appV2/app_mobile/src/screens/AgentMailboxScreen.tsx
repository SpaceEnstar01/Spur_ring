import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { AgentMailboxPanel } from '../components/AgentMailboxPanel';
import { useMailNotificationStore } from '../services/mailNotifications';
type Props = NativeStackScreenProps<RootStackParamList, 'AgentMailbox'>;
export function AgentMailboxScreen({ navigation, route }: Props) {
  const feed = useMailNotificationStore();
  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="返回"
          onPress={() => navigation.goBack()}
        >
          <Text style={s.back}>‹ 返回</Text>
        </Pressable>
        <Text style={s.title}>Agent 邮箱</Text>
        <Text style={s.count}>
          {feed.unreadCount ? `${feed.unreadCount} 未读` : ''}
        </Text>
      </View>
      <ScrollView
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
      >
        {!!feed.error && <Text style={s.error}>{feed.error}</Text>}
        {feed.backlog && (
          <Text style={s.error}>
            邮件量超过本轮同步窗口，请同时检查完整收件箱，避免遗漏。
          </Text>
        )}
        <AgentMailboxPanel
          initiallyOpen
          initialMessageId={route.params?.messageId}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
  },
  back: { fontSize: 15, color: '#536174' },
  title: { fontSize: 19, fontWeight: '700', color: '#172033' },
  count: { fontSize: 12, color: '#697C50' },
  content: { padding: 20, paddingTop: 0, paddingBottom: 40 },
  section: {
    fontSize: 14,
    fontWeight: '600',
    marginVertical: 12,
    color: '#172033',
  },
  meta: { fontSize: 12, color: '#84909E', lineHeight: 18, marginTop: 5 },
  error: { fontSize: 12, color: '#AC5555', lineHeight: 18, marginVertical: 8 },
  notice: {
    backgroundColor: '#F5F7F4',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
  },
  noticeHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  subject: { fontSize: 14, color: '#172033', fontWeight: '600', flex: 1 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#6F8558' },
  summary: { fontSize: 14, lineHeight: 22, color: '#40505D', marginTop: 8 },
  attention: { fontSize: 11, color: '#7B6840', marginTop: 8 },
});
