import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Markdown from 'react-native-markdown-display';
import type { RingRecording } from '../ring/types';
import { generateRecordingReply } from '../services/automaticReplies';
import { Icon } from './Icon';
import { useAlarmStore, alarmActionText } from '../services/agentAlarms';
import { recordingKey } from '../ring/recordingIdentity';
import { useAgentRuntime } from '../agent/runtime';
import { useAgentSettings } from '../agent/settings';
import { cloudCaptureSummary } from '../agent/types';
import { confirmGroups } from '../adaptive/confirmChoices';
import { ConfirmOptions } from '../adaptive/ConfirmOptions';

export function PersonalAgentSection({
  file,
  onChoose,
}: {
  file: RingRecording;
  onChoose?: (value: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  if (!file.transcript?.trim() || !file.personalAgentState) return null;
  return (
    <View style={styles.personalAgent}>
      <View style={styles.personalAgentHeader}>
        <Text style={styles.personalAgentTitle}>Personal Agent</Text>
        {file.personalAgentState === 'done' && (
          <Text style={styles.personalAgentStatus}>已完成</Text>
        )}
      </View>
      {file.personalAgentState === 'running' ? (
        <View style={styles.row}>
          <ActivityIndicator color="#748762" />
          <Text style={styles.hint}>
            {file.personalAgentProgress || '云端 Agent 正在处理…'}
          </Text>
        </View>
      ) : file.personalAgentState === 'failed' ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            file.personalAgentState === 'failed'
              ? '重试 Personal Agent 任务'
              : '将录音转写交给 Personal Agent'
          }
          style={styles.personalAgentButton}
          onPress={() =>
            generateRecordingReply(file.uri).catch(error =>
              Alert.alert(
                'Personal Agent 未完成',
                error instanceof Error ? error.message : String(error),
              ),
            )
          }
        >
          <Text style={styles.personalAgentButtonText}>
            {file.personalAgentState === 'failed'
              ? '重试 Personal Agent ↗'
              : file.personalAgentState === 'done'
              ? '重新分析并执行 ↗'
              : '自动理解录音 ↗'}
          </Text>
        </Pressable>
      ) : null}
      {file.personalAgentError ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {file.personalAgentError}
        </Text>
      ) : null}
      {file.personalAgentReply ? (
        <View style={styles.personalAgentAnswer}>
          {!expanded && <Text numberOfLines={3} style={styles.hint}>{file.personalAgentReply.replace(/[#*`]/g, '')}</Text>}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              expanded ? 'Collapse Agent result' : 'View Agent result'
            }
            onPress={() => setExpanded(!expanded)}
            style={styles.resourceLink}
          >
            <Text style={styles.resourceLinkText}>
              {expanded ? '收起结果 ↑' : '查看完整结果 ↗'}
            </Text>
          </Pressable>
          {expanded && (
            <Markdown style={markdownStyles}>
              {file.personalAgentReply}
            </Markdown>
          )}
          {onChoose && file.personalAgentReply ? (
            <ConfirmOptions
              groups={confirmGroups(file.personalAgentReply)}
              onSelect={onChoose}
            />
          ) : null}
          {expanded &&
            file.personalAgentSources?.map((source, index) => (
              <Pressable
                key={`${source.url}-${index}`}
                onPress={() => {
                  Linking.openURL(source.url).catch(() => undefined);
                }}
                style={styles.resourceLink}
              >
                <Text style={styles.resourceLinkText}>
                  来源：{source.title || source.url} ↗
                </Text>
              </Pressable>
            ))}
          {expanded &&
            file.personalAgentArtifacts?.map((artifact, index) => (
              <Pressable
                key={`${artifact.url}-${index}`}
                onPress={() => {
                  Linking.openURL(artifact.url).catch(() => undefined);
                }}
                style={styles.resourceLink}
              >
                <Text style={styles.resourceLinkText}>
                  打开成果：{artifact.title || '文件'} ↗
                </Text>
              </Pressable>
            ))}
          <Text style={styles.disclaimer}>
            已发送本条录音的本机转写文字；没有上传录音音频。
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export function RecordingReplyCard({
  file,
  onChoose,
}: {
  file: RingRecording;
  onChoose?: (value: string) => void;
}) {
  const workspace = useAgentRuntime(state => state.workspace);
  const binding = useAgentSettings(state =>
    state.bindings.find(b => b.key === recordingKey(file.uri)),
  );
  const capture = workspace?.records.find(
    r => r.clientId === binding?.clientId && r.revision === binding?.revision,
  );
  const alarmAction = useAlarmStore(state =>
    state.actions.find(action => action.key === recordingKey(file.uri)),
  );
  if (capture && workspace)
    return (
      <>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.label}>Spur agent · 实时状态</Text>
            <Text style={styles.status}>
              {['received', 'interpreting'].includes(capture.status)
                ? '正在分析'
                : capture.status === 'failed'
                ? '待重试'
                : '已完成'}
            </Text>
          </View>
          <Markdown style={markdownStyles}>
            {cloudCaptureSummary(workspace, capture)}
          </Markdown>
          <Text style={styles.disclaimer}>
            操作以设备回执为准，可在首页 agent 确认、取消或纠错。
          </Text>
        </View>
        <PersonalAgentSection file={file} onChoose={onChoose} />
      </>
    );
  if (
    !file.aiReply &&
    !file.aiReplyState &&
    !file.personalAgentState &&
    !alarmAction &&
    !file.transcript?.trim()
  )
    return null;
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.badge}>
          <Icon name="sparkles" size={18} color="#7D9069" />
        </View>
        <View style={styles.heading}>
          <Text style={styles.label}>Spur agent</Text>
          <Text style={styles.caption}>
            {alarmAction ? '真实系统执行状态' : '灵感的下一步'}
          </Text>
        </View>
        <Text style={styles.status}>
          {alarmAction
            ? {
                confirm: '待确认',
                scheduling: '执行中',
                scheduled: '已设置',
                failed: '未完成',
                cancelled: '已取消',
                ended: '已结束',
              }[alarmAction.state]
            : file.aiReplyState === 'working'
            ? file.aiReply
              ? '生成中'
              : '思考中'
            : file.aiReplyState === 'failed'
            ? '待重试'
            : '已回复'}
        </Text>
      </View>
      {!alarmAction && file.aiReplyState === 'working' && (
        <View style={styles.row}>
          <ActivityIndicator color="#748762" />
          <Text style={styles.hint}>
            {file.aiReply
              ? 'AI 正在继续生成…'
              : '文字已识别，正在等待 AI 回复…'}
          </Text>
        </View>
      )}
      {(alarmAction || file.aiReply) && (
        <View style={styles.answer}>
          <Markdown style={markdownStyles}>
            {alarmAction ? alarmActionText(alarmAction) : file.aiReply}
          </Markdown>
          {!alarmAction && onChoose && file.aiReply ? (
            <ConfirmOptions
              groups={confirmGroups(file.aiReply)}
              onSelect={onChoose}
            />
          ) : null}
          <Text style={styles.disclaimer}>
            {alarmAction
              ? '以首页刷新后的系统状态为准，可在首页取消闹钟'
              : 'AI 生成内容，请结合实际核对'}
          </Text>
        </View>
      )}
      {!alarmAction && file.aiReplyState === 'failed' && (
        <>
          <Text style={styles.error}>
            {file.aiReplyError || 'AI 暂未回复，原始文字已保留'}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="重试录音 AI 回复"
            onPress={() => {
              generateRecordingReply(file.uri).catch(error =>
                Alert.alert('AI 回复未完成', error.message),
              );
            }}
            style={styles.retry}
          >
            <Text style={styles.retryText}>重新获取回复 ↗</Text>
          </Pressable>
        </>
      )}
      {!alarmAction && <PersonalAgentSection file={file} onChoose={onChoose} />}
    </View>
  );
}
const styles = StyleSheet.create({
  card: {
    marginTop: 18,
    padding: 20,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8EDDF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 18,
  },
  badge: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: '#EFF3E8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: { flex: 1 },
  caption: { color: '#A5AF99', fontSize: 10, marginTop: 5 },
  status: {
    color: '#92A37E',
    fontSize: 10,
    backgroundColor: '#F2F5ED',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 10,
  },
  answer: { borderTopWidth: 1, borderTopColor: '#EFF1EB', paddingTop: 18 },
  personalAgent: {
    borderTopWidth: 1,
    borderTopColor: '#EFF1EB',
    marginTop: 18,
    paddingTop: 18,
  },
  personalAgentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  personalAgentTitle: { color: '#405735', fontSize: 14, fontWeight: '700' },
  personalAgentStatus: { color: '#748762', fontSize: 11 },
  personalAgentButton: { alignSelf: 'flex-start', paddingVertical: 10 },
  personalAgentButtonText: {
    color: '#5F774B',
    fontSize: 13,
    fontWeight: '600',
  },
  personalAgentAnswer: {
    borderTopWidth: 1,
    borderTopColor: '#EFF1EB',
    paddingTop: 14,
  },
  resourceLink: { paddingVertical: 7 },
  resourceLinkText: { color: '#506E9B', fontSize: 12, lineHeight: 18 },
  disclaimer: { color: '#B2BAA8', fontSize: 10, marginTop: 20 },
  label: {
    color: '#6E815B',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
  },
  hint: { color: '#879879', fontSize: 12 },
  error: { color: '#AA6956', fontSize: 12, lineHeight: 20 },
  retry: { paddingTop: 14, paddingBottom: 4 },
  retryText: { color: '#5F774B', fontSize: 13, fontWeight: '600' },
});
const markdownStyles = StyleSheet.create({
  body: { color: '#4B5842', fontSize: 15, lineHeight: 27 },
  paragraph: { marginTop: 0, marginBottom: 14 },
  heading1: {
    color: '#34442C',
    fontSize: 22,
    lineHeight: 32,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 16,
  },
  heading2: {
    color: '#3B4B32',
    fontSize: 18,
    lineHeight: 28,
    fontWeight: '600',
    marginTop: 18,
    marginBottom: 10,
  },
  heading3: {
    color: '#43533A',
    fontSize: 16,
    lineHeight: 26,
    fontWeight: '600',
    marginTop: 14,
    marginBottom: 8,
  },
  hr: { backgroundColor: '#E9EEDF', height: 1, marginVertical: 18 },
  bullet_list: { marginBottom: 12 },
  ordered_list: { marginBottom: 12 },
  table: {
    borderColor: '#E3E9DC',
    borderWidth: 1,
    borderRadius: 10,
    marginVertical: 12,
  },
  tr: { borderColor: '#E3E9DC' },
  th: { padding: 8, backgroundColor: '#F2F5ED' },
  td: { padding: 8 },
  blockquote: {
    borderLeftColor: '#CAD7BB',
    backgroundColor: '#F5F7F0',
    borderLeftWidth: 3,
    padding: 12,
  },
});
