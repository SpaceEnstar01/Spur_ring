import React, { useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  cancelAgentAlarm,
  createConfirmedAlarm,
  refreshAgentAlarms,
  setAlarmAutomation,
  useAlarmStore,
  type AlarmAction,
} from '../services/agentAlarms';

export function AgentAlarmPanel({
  legacyOnly = false,
}: { legacyOnly?: boolean } = {}) {
  const { actions, enabledAt, error } = useAlarmStore();
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const run = async (job: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    try {
      await job();
    } catch (e) {
      Alert.alert('闹钟操作未完成', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const toggle = () => {
    if (enabledAt !== null) {
      run(() => setAlarmAutomation(false));
      return;
    }
    Alert.alert(
      '开启录音闹钟执行？',
      '仅对开启后新录音中的明确闹钟指令自动执行。时间含糊时等待确认；旧录音不自动执行。需要 iOS 26 的闹钟权限，与 AI 自动分析开关独立。关闭后不取消已创建闹钟。',
      [
        { text: '暂不开启', style: 'cancel' },
        {
          text: '授权并开启',
          onPress: () => run(() => setAlarmAutomation(true)),
        },
      ],
    );
  };
  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <View style={styles.heading}>
          <Text style={styles.eyebrow}>AGENT · ACTIONS</Text>
          <Text style={styles.title}>
            {legacyOnly ? '切换前的本机闹钟' : '让一句话，真正发生'}
          </Text>
        </View>
        {!legacyOnly && (
          <Pressable
            accessibilityRole="switch"
            accessibilityLabel="录音闹钟自动执行"
            accessibilityState={{ checked: enabledAt !== null, disabled: busy }}
            disabled={busy}
            onPress={toggle}
            style={styles.toggle}
          >
            <Text style={styles.link}>
              {enabledAt !== null ? '已开启 · 关闭' : '开启执行'}
            </Text>
          </Pressable>
        )}
      </View>
      <Text style={styles.hint}>
        试着说：“帮我定明天早上八点的闹钟”。由 iOS
        系统响铃，不写入苹果时钟列表；暂支持单次、单个闹钟。
      </Text>
      {!!error && <Text style={styles.error}>{error}</Text>}
      {actions.length === 0 && (
        <Text style={styles.empty}>暂无闹钟指令 · 转写后会出现在这里</Text>
      )}
      {(expanded ? actions : actions.slice(0, 3)).map(action => (
        <AlarmRow key={action.id} action={action} busy={busy} run={run} />
      ))}
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="刷新系统闹钟状态"
          disabled={busy}
          onPress={() => run(refreshAgentAlarms)}
        >
          <Text style={styles.link}>刷新系统状态</Text>
        </Pressable>
        {actions.length > 3 && (
          <Pressable
            accessibilityRole="button"
            onPress={() => setExpanded(!expanded)}
          >
            <Text style={styles.link}>
              {expanded ? '收起' : `全部 ${actions.length} 项`}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
function AlarmRow({
  action,
  busy,
  run,
}: {
  action: AlarmAction;
  busy: boolean;
  run: (job: () => Promise<unknown>) => void;
}) {
  const [text, setText] = useState('');
  const stateLabel = {
    confirm: '待确认',
    scheduling: '正在创建',
    scheduled: '已设置',
    failed: '未完成',
    cancelled: '已取消',
    ended: '已结束 / 已移除',
  }[action.state];
  const canCreate = ['confirm', 'failed'].includes(action.state);
  const confirm = () =>
    Alert.alert(
      '创建这个系统闹钟？',
      text.trim() ||
        (action.fireAt
          ? new Date(action.fireAt).toLocaleString('zh-CN')
          : '请先填写明确的日期和时间'),
      [
        { text: '返回', style: 'cancel' },
        {
          text: '创建闹钟',
          onPress: () =>
            run(() =>
              createConfirmedAlarm(action.id, text.trim() || undefined),
            ),
        },
      ],
    );
  return (
    <View style={styles.row}>
      <View style={styles.header}>
        <Text style={styles.time}>
          {action.fireAt
            ? new Date(action.fireAt).toLocaleString('zh-CN', {
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })
            : '需要明确时间'}
        </Text>
        <Text style={styles.status}>{stateLabel}</Text>
      </View>
      <Text numberOfLines={2} style={styles.source}>
        {action.transcript}
      </Text>
      {!!action.detail && <Text style={styles.hint}>{action.detail}</Text>}
      {canCreate && (
        <TextInput
          accessibilityLabel={`确认闹钟指令 ${action.id}`}
          placeholder="填写新指令，如：帮我定明天早上八点的闹钟"
          placeholderTextColor="#8D9CAC"
          value={text}
          onChangeText={setText}
          style={styles.input}
          editable={!busy}
        />
      )}
      <View style={styles.header}>
        {canCreate && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`创建闹钟 ${action.id}`}
            disabled={busy || (!action.fireAt && !text.trim())}
            onPress={confirm}
          >
            <Text style={styles.link}>确认并创建</Text>
          </Pressable>
        )}
        {!['cancelled', 'ended', 'scheduling'].includes(action.state) && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`取消闹钟 ${action.id}`}
            disabled={busy}
            onPress={() =>
              Alert.alert(
                '取消这个闹钟？',
                '已创建的系统闹钟会停止，不会因重新同步而恢复。删除录音不会自动取消闹钟。',
                [
                  { text: '保留', style: 'cancel' },
                  {
                    text: '取消闹钟',
                    style: 'destructive',
                    onPress: () => run(() => cancelAgentAlarm(action.id)),
                  },
                ],
              )
            }
          >
            <Text style={styles.link}>取消闹钟</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  panel: {
    padding: 20,
    marginBottom: 24,
    backgroundColor: '#F8FBFF',
    borderColor: '#DCE6F0',
    borderWidth: 1,
    borderRadius: 24,
    gap: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  heading: { flex: 1, gap: 7 },
  eyebrow: { color: '#7A91AA', fontSize: 10, letterSpacing: 1.6 },
  title: { color: '#334960', fontSize: 19, fontWeight: '600' },
  toggle: { borderRadius: 14, padding: 10, backgroundColor: '#E8EFF7' },
  link: {
    color: '#52769B',
    fontSize: 12,
    fontWeight: '600',
    paddingVertical: 8,
  },
  hint: { color: '#7C8FA2', fontSize: 12, lineHeight: 20 },
  empty: { color: '#93A3B4', fontSize: 12, paddingVertical: 12 },
  error: { color: '#A45D49', fontSize: 12, lineHeight: 20 },
  row: { padding: 16, borderRadius: 18, backgroundColor: '#FFFFFF', gap: 10 },
  time: { color: '#334960', fontSize: 17, fontWeight: '600', flex: 1 },
  status: {
    color: '#52769B',
    fontSize: 11,
    backgroundColor: '#EAF1F8',
    borderRadius: 8,
    padding: 6,
  },
  source: { color: '#657C91', fontSize: 13, lineHeight: 21 },
  input: {
    backgroundColor: '#F1F5FA',
    borderRadius: 10,
    padding: 12,
    color: '#334960',
    fontSize: 12,
  },
});
