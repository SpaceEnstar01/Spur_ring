import React, { useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import {
  agentExamples,
  AgentExample,
  useExampleSettings,
} from '../agent/examples';
import { selectionHaptic } from '../services/haptics';
import { Icon } from './Icon';

export function AgentExamples() {
  const deleted = useExampleSettings(state => state.deletedIds);
  const [selected, setSelected] = useState<AgentExample | null>(null);
  const examples = agentExamples.filter(item => !deleted.includes(item.id));
  const remove = (item: AgentExample) => {
    selectionHaptic();
    Alert.alert(
      '删除这张示例卡片？',
      `“${item.title}”\n只移除此示例，不影响任何真实录音、笔记或 Agent 事项。`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: () => {
            useExampleSettings.getState().remove(item.id);
            if (selected?.id === item.id) setSelected(null);
          },
        },
      ],
    );
  };
  if (!examples.length) return null;
  return (
    <View style={s.root}>
      <View style={s.heading}>
        <View>
          <Text style={s.eyebrow}>EXPLORE WITH SPUR</Text>
          <Text style={s.title}>先看看，一个想法可以走多远</Text>
        </View>
        <Icon name="sparkles" size={22} color="#73847D" />
      </View>
      <Text style={s.note}>示例内容 · 虚构数据 · 不读取你的录音</Text>
      {examples.map(item => (
        <View key={item.id} style={[s.card, { backgroundColor: item.color }]}>
          <View style={s.row}>
            <Text style={s.label}>{item.label}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`删除示例 ${item.title}`}
              hitSlop={10}
              onPress={() => remove(item)}
              style={s.delete}
            >
              <Icon name="trash" size={17} color="#69736F" />
            </Pressable>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`查看示例 ${item.title}`}
            onPress={() => {
              selectionHaptic();
              setSelected(item);
            }}
            onLongPress={() => remove(item)}
          >
            <Text style={s.cardTitle}>{item.title}</Text>
            <Text style={s.summary}>{item.summary}</Text>
            <View style={s.footer}>
              <Text style={s.link}>查看示例分析</Text>
              <Icon name="chevron" size={16} color="#52665D" />
            </View>
          </Pressable>
        </View>
      ))}
      <Modal
        visible={!!selected}
        animationType="slide"
        onRequestClose={() => setSelected(null)}
      >
        {selected && (
          <LinearGradient colors={['#E4EEE8', '#F7F7F2']} style={s.fill}>
            <SafeAreaView style={s.fill}>
              <View style={s.nav}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="关闭示例详情"
                  onPress={() => setSelected(null)}
                  style={s.navButton}
                >
                  <Icon name="back" />
                </Pressable>
                <Text style={s.label}>agent / 示例</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="删除当前示例"
                  onPress={() => remove(selected)}
                  style={s.navButton}
                >
                  <Icon name="trash" size={20} />
                </Pressable>
              </View>
              <ScrollView contentContainerStyle={s.content}>
                <Text style={s.eyebrow}>ONE IDEA, MORE POSSIBILITIES</Text>
                <Text style={s.detailTitle}>{selected.title}</Text>
                <Text style={s.summary}>{selected.summary}</Text>
                <View style={s.warning}>
                  <Text style={s.note}>
                    离线演示 ·
                    数据和脚本均为虚构示例，不是实时搜索结果，也不是已完成的外部任务。
                  </Text>
                </View>
                <View style={s.request}>
                  <Text style={s.label}>你可以这样说</Text>
                  <Text style={s.quote}>“{selected.request}”</Text>
                </View>
                <View style={s.metrics}>
                  {selected.metrics.map(metric => (
                    <View key={metric.label} style={s.metric}>
                      <Text style={s.metricValue}>{metric.value}</Text>
                      <Text style={s.note}>{metric.label}</Text>
                    </View>
                  ))}
                </View>
                {selected.sections.map((section, index) => (
                  <View key={section.title} style={s.section}>
                    <Text style={s.sectionIndex}>0{index + 1}</Text>
                    <Text style={s.sectionTitle}>{section.title}</Text>
                    <Text selectable style={s.body}>
                      {section.text}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            </SafeAreaView>
          </LinearGradient>
        )}
      </Modal>
    </View>
  );
}
const s = StyleSheet.create({
  root: { marginBottom: 24 },
  fill: { flex: 1 },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  eyebrow: {
    fontSize: 9,
    letterSpacing: 2,
    color: '#7C8E84',
    fontWeight: '700',
    marginBottom: 9,
  },
  title: { fontSize: 17, fontWeight: '700', color: '#2A3A32', lineHeight: 25 },
  note: { fontSize: 11, color: '#7B867E', lineHeight: 18 },
  card: { borderRadius: 23, padding: 19, marginTop: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    fontSize: 11,
    color: '#66776E',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  delete: { padding: 5 },
  cardTitle: {
    fontSize: 21,
    lineHeight: 30,
    color: '#283A32',
    fontWeight: '700',
    marginTop: 8,
  },
  summary: { fontSize: 13, color: '#6C7C72', lineHeight: 22, marginTop: 8 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 17,
  },
  link: { fontSize: 12, color: '#52665D', fontWeight: '600' },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  navButton: { padding: 10, backgroundColor: '#FFFFFF99', borderRadius: 22 },
  content: { padding: 24, paddingBottom: 50 },
  detailTitle: {
    fontSize: 30,
    fontWeight: '700',
    color: '#25372D',
    lineHeight: 41,
    marginTop: 8,
  },
  warning: {
    backgroundColor: '#F3EEDC',
    padding: 12,
    borderRadius: 13,
    marginTop: 18,
  },
  request: {
    padding: 20,
    backgroundColor: '#FFFFFFB3',
    borderRadius: 20,
    marginTop: 18,
  },
  quote: { fontSize: 16, lineHeight: 27, color: '#405D4C', marginTop: 10 },
  metrics: { flexDirection: 'row', gap: 8, marginVertical: 20 },
  metric: {
    flex: 1,
    backgroundColor: '#FFFFFFB3',
    paddingVertical: 17,
    paddingHorizontal: 9,
    borderRadius: 17,
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 17,
    color: '#3C5948',
    fontWeight: '700',
    marginBottom: 5,
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 23,
    padding: 20,
    marginBottom: 13,
  },
  sectionIndex: {
    fontSize: 12,
    letterSpacing: 2,
    color: '#A3B5A7',
    marginBottom: 9,
  },
  sectionTitle: {
    fontSize: 18,
    color: '#2B4034',
    fontWeight: '700',
    marginBottom: 13,
  },
  body: { fontSize: 14, lineHeight: 25, color: '#647268' },
});
