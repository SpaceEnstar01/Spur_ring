import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { IntegrationIcon } from './IntegrationIcon';
import {
  readAppConnections,
  startAppConnection,
  disconnectApp,
} from '../services/appConnections';
import type {
  AppConnection,
  ConnectionProvider,
} from '../services/appConnections';

const providers = [
  {
    id: 'youtube' as const,
    name: 'YouTube',
    detail: '公开视频搜索 · 我的频道 · 只读 Analytics',
  },
  {
    id: 'notion' as const,
    name: 'Notion',
    detail: '读取已授权页面 · 创建报告 · 更新笔记',
  },
];
export function matchingRealConnections(query: string, category: string) {
  return providers.filter(
    p =>
      `${p.name} ${p.detail}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()) &&
      (category === 'All' ||
        category === 'Creator' ||
        (category === 'Analytics' && p.id === 'youtube')),
  );
}
export function RealAppConnections({
  query = '',
  category = 'All',
}: {
  query?: string;
  category?: string;
}) {
  const [connections, setConnections] = useState<AppConnection[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<ConnectionProvider | null>(null);
  const [waiting, setWaiting] = useState<ConnectionProvider | null>(null);
  const [expanded, setExpanded] = useState<ConnectionProvider | null>(null);
  const alive = useRef(true);
  const refreshing = useRef(false);
  const refresh = useCallback(async () => {
    if (refreshing.current) return;
    refreshing.current = true;
    setLoading(true);
    try {
      const result = await readAppConnections();
      if (alive.current) {
        setConnections(result.connections);
        setError('');
      }
    } catch (e) {
      if (alive.current) {
        setConnections([]);
        setError(e instanceof Error ? e.message : '连接检查失败');
      }
    } finally {
      refreshing.current = false;
      if (alive.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    alive.current = true;
    refresh();
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') refresh();
    });
    return () => {
      alive.current = false;
      subscription.remove();
    };
  }, [refresh]);
  useEffect(() => {
    if (!waiting) return;
    const interval = setInterval(() => {
      if (AppState.currentState === 'active') refresh();
    }, 5000);
    const timeout = setTimeout(() => setWaiting(null), 600000);
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [waiting, refresh]);
  useEffect(() => {
    if (
      waiting &&
      connections.some(c => c.provider === waiting && c.state === 'connected')
    )
      setWaiting(null);
  }, [connections, waiting]);
  async function connect(provider: ConnectionProvider) {
    if (busy) return;
    setBusy(provider);
    try {
      const result = await startAppConnection(provider);
      const prefix =
        provider === 'youtube'
          ? 'https://accounts.google.com/'
          : 'https://api.notion.com/';
      if (!result.authorizationUrl.startsWith(prefix))
        throw new Error('授权地址无效');
      await Linking.openURL(result.authorizationUrl);
      if (alive.current) setWaiting(provider);
    } catch (e) {
      Alert.alert('连接未完成', e instanceof Error ? e.message : '请重试');
    } finally {
      if (alive.current) setBusy(null);
    }
  }
  function disconnect(provider: ConnectionProvider) {
    Alert.alert(
      '断开连接？',
      'Spur 将移除此手机连接身份的授权。正在执行的任务可能仍会完成；如需撤销官方授权，请到对应平台的授权管理中操作。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '断开',
          style: 'destructive',
          onPress: async () => {
            setBusy(provider);
            try {
              await disconnectApp(provider);
              setWaiting(null);
              await refresh();
            } catch (e) {
              Alert.alert(
                '断开失败',
                e instanceof Error ? e.message : '请重试',
              );
            } finally {
              if (alive.current) setBusy(null);
            }
          },
        },
      ],
    );
  }
  const visible = matchingRealConnections(query, category);
  if (!visible.length) return null;
  return (
    <View style={s.section}>
      <View style={s.header}>
        <Text style={s.heading}>Your connections</Text>
        <Pressable
          accessibilityRole="button"
          disabled={loading}
          onPress={refresh}
        >
          <Text style={s.link}>{loading ? '检查中…' : '刷新'}</Text>
        </Pressable>
      </View>
      {!!error && (
        <Text accessibilityRole="alert" style={s.error}>
          {error}
        </Text>
      )}
      {visible.map(provider => {
        const connection = connections.find(c => c.provider === provider.id);
        const connected = connection?.state === 'connected';
        const state = error
          ? '无法核验'
          : loading && !connection
          ? '检查中'
          : connected
          ? '已连接'
          : connection?.state === 'needs_reconnect'
          ? '需重新连接'
          : connection?.state === 'unavailable'
          ? '暂时不可用'
          : '未连接';
        return (
          <View key={provider.id} style={s.item}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${provider.name} ${state}`}
              onPress={() =>
                setExpanded(expanded === provider.id ? null : provider.id)
              }
              style={s.row}
            >
              <IntegrationIcon id={provider.id} />
              <View style={s.copy}>
                <Text style={s.name}>{provider.name}</Text>
                <Text style={s.detail}>
                  {connected ? connection.label : provider.detail}
                </Text>
              </View>
              <Text style={[s.state, connected && s.connected]}>{state}</Text>
            </Pressable>
            {expanded === provider.id && (
              <View style={s.panel}>
                <Text style={s.explanation}>
                  {connection?.message ||
                    (provider.id === 'youtube'
                      ? '通过 Google 官方页面选择自己的账号，授权读取频道和 Analytics。不会上传或修改视频。'
                      : '通过 Notion 官方页面选择工作区与允许访问的页面，之后 Agent 才能读取或写入。')}
                </Text>
                {!!connection && !connection.configured && (
                  <Text style={s.error}>
                    管理员尚未配置此平台的官方授权应用。
                  </Text>
                )}
                {waiting === provider.id && (
                  <Text style={s.detail}>
                    请完成官方授权后返回 Spur，点击刷新核验。
                  </Text>
                )}
                <Pressable
                  accessibilityRole="button"
                  disabled={
                    !!busy || loading || !!error || !connection?.configured
                  }
                  accessibilityLabel={`授权连接 ${provider.name}`}
                  onPress={() => connect(provider.id)}
                  style={[
                    s.primary,
                    (!!busy || loading || !!error || !connection?.configured) &&
                      s.disabled,
                  ]}
                >
                  <Text style={s.primaryText}>
                    {busy === provider.id
                      ? '处理中…'
                      : connected
                      ? '更换账号 / 重新授权'
                      : `连接 ${provider.name}`}
                  </Text>
                </Pressable>
                {!!connection && connection.state !== 'disconnected' && (
                  <Pressable
                    accessibilityRole="button"
                    disabled={!!busy}
                    onPress={() => disconnect(provider.id)}
                  >
                    <Text style={s.disconnect}>断开连接</Text>
                  </Pressable>
                )}
                <Text style={s.footnote}>
                  官方授权保存在云端；此手机的连接身份保存在系统安全存储中。
                </Text>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}
const s = StyleSheet.create({
  section: { marginTop: 20 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  heading: { fontSize: 14, fontWeight: '700', color: '#132037' },
  link: { fontSize: 12, color: '#3478F6', padding: 8 },
  item: { borderBottomWidth: 1, borderColor: '#EEF0F4' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 12,
  },
  copy: { flex: 1 },
  name: { fontSize: 14, fontWeight: '600', color: '#172033' },
  detail: { fontSize: 11, color: '#8993A4', lineHeight: 17, marginTop: 4 },
  state: { fontSize: 11, color: '#8993A4' },
  connected: { color: '#168456' },
  panel: { paddingBottom: 18, paddingHorizontal: 4 },
  explanation: { fontSize: 13, lineHeight: 21, color: '#536174' },
  primary: {
    marginTop: 14,
    backgroundColor: '#172033',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  primaryText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  disabled: { opacity: 0.45 },
  disconnect: {
    color: '#A34444',
    textAlign: 'center',
    padding: 14,
    fontSize: 13,
  },
  footnote: { fontSize: 10, color: '#8993A4', lineHeight: 16, marginTop: 8 },
  error: { color: '#A34444', fontSize: 12, lineHeight: 19, marginVertical: 8 },
});
