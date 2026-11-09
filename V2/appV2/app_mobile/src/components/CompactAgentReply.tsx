import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  SafeAreaView,
  SafeAreaProvider,
  initialWindowMetrics,
} from 'react-native-safe-area-context';
export function replyPreview(text: string) {
  const plain = text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^\s*#{1,6}\s+/gm, '')
    .replace(/\*\*|__/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return plain.length > 160 ? plain.slice(0, 160) + '…' : plain;
}
export function CompactAgentReply({
  text,
  pending = false,
  children,
}: {
  text: string;
  pending?: boolean;
  children: React.ReactNode;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <View style={s.card}>
      <Text numberOfLines={3} style={s.preview}>
        {replyPreview(text)}
      </Text>
      {!pending && (
        <Pressable
          accessibilityLabel="查看完整回复"
          accessibilityRole="button"
          onPress={() => setVisible(true)}
        >
          <Text style={s.link}>查看完整回复 ↗</Text>
        </Pressable>
      )}
      <Modal
        visible={visible}
        animationType="slide"
        onRequestClose={() => setVisible(false)}
      >
        <SafeAreaProvider initialMetrics={initialWindowMetrics}>
          <SafeAreaView style={s.page}>
            <View style={s.header}>
              <Text style={s.title}>Spur 回复</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="关闭完整回复"
                onPress={() => setVisible(false)}
              >
                <Text style={s.link}>关闭</Text>
              </Pressable>
            </View>
            <ScrollView
              contentContainerStyle={s.content}
              keyboardShouldPersistTaps="handled"
            >
              {children}
            </ScrollView>
          </SafeAreaView>
        </SafeAreaProvider>
      </Modal>
    </View>
  );
}
const s = StyleSheet.create({
  card: { backgroundColor: '#F5F6F8', borderRadius: 20, padding: 18 },
  preview: { fontSize: 16, lineHeight: 24, color: '#172033' },
  link: { color: '#3472AC', fontSize: 14, paddingVertical: 12 },
  page: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  title: { fontSize: 18, fontWeight: '600', color: '#172033' },
  content: { padding: 20, paddingBottom: 40 },
});
