import React from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRecordingStore } from '../ring/store/useRecordingStore';
import { useReplySettings } from '../services/automaticReplies';
import {
  retryLocalRecognition,
  useRecognitionRuntime,
} from '../services/automaticRecognition';
import { useAgentSettings } from '../agent/settings';
import { Icon } from './Icon';

export function RecordingPipelineNotice({
  onSettings,
}: {
  onSettings: () => void;
}) {
  const files = useRecordingStore(state => state.files);
  const issue = useRecognitionRuntime(state => state.issue);
  const choice = useReplySettings(state => state.choice);
  const cloud = useAgentSettings(state => state.enabledAt !== null);
  const missing = files.filter(file => !file.transcript?.trim());
  const failed = missing.filter(file => file.recognitionState === 'failed');
  const aiFailed = files.filter(file => file.aiReplyState === 'failed');
  if (!files.length) return null;
  const message = missing.length
    ? issue ||
      (failed.length
        ? `${failed.length} 条录音转写未完成，AI 需要先拿到文字。原音频仍在本机。`
        : `${missing.length} 条录音等待本机转写，请保持 APP 在前台。`)
    : aiFailed.length
    ? `${aiFailed.length} 条 AI 分析未完成，点击对应录音查看原因并重试。`
    : !cloud && choice !== 'enabled'
    ? '录音已转成文字，自动理解尚未开启。到设置确认后，新录音可自动分析。'
    : '本机转写 → 自动理解 → 工作区事项／录音摘要。仅处理你已授权的录音文字。';
  return (
    <View style={s.panel} accessibilityLiveRegion="polite">
      <View style={s.row}>
        <Icon name="sparkles" size={18} color="#637B72" />
        <Text style={s.title}>录音处理进度</Text>
      </View>
      <Text style={s.body}>{message}</Text>
      <View style={s.row}>
        <Pressable
          accessibilityRole="button"
          onPress={onSettings}
          style={s.button}
        >
          <Text style={s.action}>检查权限与自动理解 ↗</Text>
        </Pressable>
        {!!failed.length && (
          <Pressable
            accessibilityRole="button"
            style={s.button}
            onPress={() =>
              Alert.alert(
                '重新转写未完成的录音？',
                '仅在本机重新识别，音频不上传。文字识别成功后，按你已有的 AI 授权设置处理；不会改变授权或重试失败的 AI 请求。',
                [
                  { text: '取消', style: 'cancel' },
                  { text: '重新转写', onPress: retryLocalRecognition },
                ],
              )
            }
          >
            <Text style={s.action}>重试本机转写</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
const s = StyleSheet.create({
  panel: {
    backgroundColor: '#EFF3EE',
    padding: 16,
    borderRadius: 20,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#DFE6DC',
  },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 9 },
  title: { fontSize: 13, fontWeight: '700', color: '#455E53' },
  body: { color: '#69756D', fontSize: 13, lineHeight: 21, marginTop: 8 },
  button: { paddingVertical: 10, paddingRight: 7 },
  action: { color: '#4D6C59', fontSize: 12, fontWeight: '600' },
});
