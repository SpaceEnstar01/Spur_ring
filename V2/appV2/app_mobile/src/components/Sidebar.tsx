import { useMailNotificationStore } from '../services/mailNotifications';
import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  initialWindowMetrics,
  SafeAreaProvider,
  SafeAreaView,
} from 'react-native-safe-area-context';
import { selectionHaptic } from '../services/haptics';
import { Icon } from './Icon';
import { useProfileStore } from '../profile/profileStore';
import { ProfileAvatar } from './ProfileAvatar';

export type ContentFilter = 'all' | 'notes' | 'recordings';
export const filterLabels: Record<ContentFilter, string> = {
  all: 'Agent Workspace',
  notes: '创作空间',
  recordings: '录音记录',
};
type Destination =
  | 'AgentMailbox'
  | 'ConnectApps'
  | 'Device'
  | 'Chat'
  | 'Note'
  | 'Recorder'
  | 'Settings';
type Props = {
  visible: boolean;
  onClose: () => void;
  filter: ContentFilter;
  counts: Record<ContentFilter, number>;
  onFilter: (filter: ContentFilter) => void;
  onNavigate: (destination: Destination) => void;
  deviceLabel: string;
  online: boolean;
};

export function Sidebar(props: Props) {
  const unreadMail = useMailNotificationStore(state => state.unreadCount);
  const profile = useProfileStore(state => state.profile);
  const { width } = useWindowDimensions();
  const panelWidth = Math.min(width * 0.85, 350);
  const [mounted, setMounted] = useState(props.visible);
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let active = true;
    if (props.visible) {
      setMounted(true);
    }
    AccessibilityInfo.isReduceMotionEnabled().then(reduceMotion => {
      if (!active) {
        return;
      }
      Animated.timing(progress, {
        toValue: props.visible ? 1 : 0,
        duration: reduceMotion ? 0 : props.visible ? 260 : 200,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (active && finished && !props.visible) {
          setMounted(false);
        }
      });
    });
    return () => {
      active = false;
      progress.stopAnimation();
    };
  }, [props.visible, progress]);
  const select = (action: () => void) => {
    selectionHaptic();
    props.onClose();
    action();
  };
  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      onRequestClose={props.onClose}
      statusBarTranslucent
    >
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <View style={styles.overlay} accessibilityViewIsModal>
          <Animated.View
            style={[StyleSheet.absoluteFill, { opacity: progress }]}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="关闭侧边栏"
              onPress={() => select(() => {})}
              style={styles.scrim}
            />
          </Animated.View>
          <Animated.View
            style={[
              styles.panel,
              {
                width: panelWidth,
                transform: [
                  {
                    translateX: progress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-panelWidth, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <SafeAreaView style={styles.safe}>
              <View style={styles.top}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`我的戒指，${props.deviceLabel}`}
                  onPress={() => select(() => props.onNavigate('Device'))}
                  style={({ pressed }) => [
                    styles.device,
                    pressed && styles.pressed,
                  ]}
                >
                  <Icon name="ring" size={17} />
                  <Text style={styles.deviceText}>设备</Text>
                  <View style={[styles.dot, props.online && styles.online]} />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="收起侧边栏"
                  hitSlop={12}
                  onPress={() => select(() => {})}
                >
                  <Icon name="close" size={20} color="#858880" />
                </Pressable>
              </View>
              <ScrollView contentContainerStyle={styles.scroll}>
                <Text style={styles.wordmark}>
                  SPUR<Text style={styles.wordmarkLight}> / </Text>
                </Text>
                <Text style={styles.subtitle}>灵感、声音，都有归处。</Text>
                <Text style={styles.section}>我的内容</Text>
                {(['all', 'notes', 'recordings'] as ContentFilter[]).map(
                  filter => (
                    <Pressable
                      key={filter}
                      accessibilityRole="button"
                      accessibilityLabel={filterLabels[filter]}
                      accessibilityState={{ selected: props.filter === filter }}
                      onPress={() => select(() => props.onFilter(filter))}
                      style={({ pressed }) => [
                        styles.row,
                        props.filter === filter && styles.selected,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Icon
                        name={
                          filter === 'all'
                            ? 'sparkles'
                            : filter === 'notes'
                            ? 'workspace'
                            : 'wave'
                        }
                        size={20}
                      />
                      <Text
                        style={[
                          styles.label,
                          props.filter === filter && styles.selectedLabel,
                        ]}
                      >
                        {filterLabels[filter]}
                      </Text>
                      <Text style={styles.count}>{props.counts[filter]}</Text>
                      {props.filter === filter && (
                        <View style={styles.selectionDot} />
                      )}
                    </Pressable>
                  ),
                )}
                <View style={styles.separator} />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="连接应用"
                  onPress={() => select(() => props.onNavigate('ConnectApps'))}
                  style={({ pressed }) => [
                    styles.row,
                    pressed && styles.pressed,
                  ]}
                >
                  <Icon name="link" size={20} />
                  <Text style={styles.label}>连接应用</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Spur AI"
                  onPress={() => select(() => props.onNavigate('Chat'))}
                  style={({ pressed }) => [
                    styles.row,
                    pressed && styles.pressed,
                  ]}
                >
                  <Icon name="sparkles" size={20} color="#A16C50" />
                  <Text style={styles.label}>Spur AI</Text>
                  <Text style={styles.caption}>一起理清想法</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="新建笔记"
                  onPress={() => select(() => props.onNavigate('Note'))}
                  style={({ pressed }) => [
                    styles.row,
                    pressed && styles.pressed,
                  ]}
                >
                  <Icon name="plus" size={20} />
                  <Text style={styles.label}>新建笔记</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Agent 邮箱"
                  onPress={() => select(() => props.onNavigate('AgentMailbox'))}
                  style={({ pressed }) => [
                    styles.row,
                    pressed && styles.pressed,
                  ]}
                >
                  <Icon name="mail" size={20} />
                  <Text style={styles.label}>Agent 邮箱</Text>
                  {unreadMail > 0 && (
                    <Text style={styles.caption}>{unreadMail} 未读</Text>
                  )}
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="手机录音"
                  onPress={() => select(() => props.onNavigate('Recorder'))}
                  style={({ pressed }) => [
                    styles.row,
                    pressed && styles.pressed,
                  ]}
                >
                  <Icon name="mic" size={20} />
                  <Text style={styles.label}>手机录音</Text>
                </Pressable>
              </ScrollView>
              <View style={styles.footer}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="设置"
                  onPress={() => select(() => props.onNavigate('Settings'))}
                  style={({ pressed }) => [
                    styles.profile,
                    pressed && styles.pressed,
                  ]}
                >
                  <ProfileAvatar
                    id={profile.avatarId}
                    variant={profile.avatarStyle}
                    size={40}
                  />
                  <View style={styles.profileText}>
                    <Text style={styles.profileTitle}>
                      {profile.name || '我的 Spur'}
                    </Text>
                    <Text style={styles.profileDetail}>
                      本地空间 · {props.counts.all} 条记录
                    </Text>
                  </View>
                  <Icon name="settings" size={20} color="#777D70" />
                </Pressable>
                <Text style={styles.localNote}>
                  资料与录音在本机 · AI 经确认后发送文字
                </Text>
              </View>
            </SafeAreaView>
          </Animated.View>
        </View>
      </SafeAreaProvider>
    </Modal>
  );
}
const styles = StyleSheet.create({
  overlay: { flex: 1 },
  scrim: { flex: 1, backgroundColor: '#13181066' },
  panel: {
    flex: 1,
    backgroundColor: '#FAFAF7',
    borderTopRightRadius: 24,
    borderBottomRightRadius: 24,
    overflow: 'hidden',
  },
  safe: { flex: 1 },
  top: {
    paddingHorizontal: 24,
    paddingTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  device: {
    flexDirection: 'row',
    gap: 7,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E7E8E1',
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 20,
  },
  deviceText: { fontSize: 12, color: '#393E33' },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#BABDB5' },
  online: { backgroundColor: '#619573' },
  scroll: { paddingHorizontal: 16, paddingTop: 30, paddingBottom: 24 },
  wordmark: {
    fontSize: 29,
    letterSpacing: 3,
    fontWeight: '800',
    color: '#30382A',
    paddingHorizontal: 12,
  },
  wordmarkLight: { color: '#B6BDAA', fontWeight: '300' },
  subtitle: {
    fontSize: 12,
    color: '#9A9E93',
    marginTop: 9,
    marginBottom: 32,
    paddingHorizontal: 12,
  },
  section: {
    fontSize: 10,
    letterSpacing: 1,
    color: '#969C8F',
    marginBottom: 12,
    paddingHorizontal: 12,
  },
  row: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 13,
    borderRadius: 12,
    marginBottom: 3,
  },
  selected: { backgroundColor: '#E9ECE2' },
  pressed: { opacity: 0.55 },
  label: { flex: 1, fontSize: 14, color: '#41483A' },
  selectedLabel: { fontWeight: '600', color: '#293323' },
  count: { fontSize: 12, color: '#909785', fontVariant: ['tabular-nums'] },
  selectionDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#748466',
  },
  separator: {
    height: 1,
    backgroundColor: '#ECEDE7',
    marginHorizontal: 12,
    marginVertical: 16,
  },
  caption: { fontSize: 10, color: '#9B9D92' },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: '#ECEDE7',
  },
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 12,
    padding: 4,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: '#E7EADB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#5F7052', fontSize: 22, fontWeight: '600' },
  profileText: { flex: 1 },
  profileTitle: { fontSize: 14, fontWeight: '600', color: '#41483A' },
  profileDetail: { fontSize: 10, color: '#969C8F', marginTop: 5 },
  localNote: {
    fontSize: 9,
    color: '#ACB0A4',
    marginTop: 18,
    textAlign: 'center',
  },
});
