import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  avatarIds,
  LocalProfile,
  validateProfile,
} from '../profile/profileStore';
import { selectionHaptic } from '../services/haptics';
import {
  getOnboardingPermissions,
  PermissionSnapshot,
  requestAudioPermissions,
  requestRingPermission,
} from '../services/onboardingPermissions';
import { Icon } from './Icon';
import { avatarNames, ProfileAvatar } from './ProfileAvatar';

type Props = {
  initial: LocalProfile;
  onComplete: (profile: LocalProfile) => Promise<void>;
  editing?: boolean;
  onCancel?: () => void;
};
export function OnboardingFlow({
  initial,
  onComplete,
  editing = false,
  onCancel,
}: Props) {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState(initial);
  const [permissions, setPermissions] = useState<PermissionSnapshot | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const locked = useRef(false);
  const mounted = useRef(true);
  const total = editing ? 3 : 4;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (step !== 3) return;
    let active = true;
    const refresh = () =>
      getOnboardingPermissions()
        .then(value => {
          if (active) setPermissions(value);
        })
        .catch(() => {});
    refresh();
    const listener = AppState.addEventListener('change', state => {
      if (state === 'active') refresh();
    });
    return () => {
      active = false;
      listener.remove();
    };
  }, [step]);
  const update = (values: Partial<LocalProfile>) => {
    setDraft(value => ({ ...value, ...values }));
    setError('');
  };
  const run = async (operation: () => Promise<void>) => {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError('');
    try {
      await operation();
    } catch (issue) {
      if (mounted.current)
        setError((issue as Error).message || '暂未完成，请重试');
    } finally {
      locked.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const next = async (skipEmail = false) => {
    if (locked.current) return;
    const profile = { ...draft, email: skipEmail ? '' : draft.email };
    const issue = validateProfile(profile.name, step >= 2 ? profile.email : '');
    if (issue) {
      setError(issue);
      return;
    }
    selectionHaptic();
    if (skipEmail) update({ email: '' });
    if (step < total - 1) {
      setStep(value => value + 1);
      setError('');
    } else await run(() => onComplete({ ...profile, completed: true }));
  };
  const request = (kind: 'audio' | 'bluetooth') =>
    run(async () => {
      const snapshot = await (kind === 'audio'
        ? requestAudioPermissions()
        : requestRingPermission());
      if (!mounted.current) return;
      setPermissions(snapshot);
      if (
        (kind === 'audio' &&
          (!snapshot.microphone ||
            (Platform.OS === 'ios' && !snapshot.speech))) ||
        (kind === 'bluetooth' &&
          ['denied', 'restricted'].includes(snapshot.bluetooth || ''))
      ) {
        Alert.alert(
          '可以稍后再开启',
          '拒绝权限不影响记笔记。需要录音、转写或连接戒指时，可在系统设置中开启对应权限。',
          [
            { text: '知道了' },
            { text: '打开设置', onPress: () => Linking.openSettings() },
          ],
        );
      }
    });
  const titles = [
    '嗨，我该怎么称呼你？',
    `${draft.name.trim() || '你'}，选个喜欢的头像吧。`,
    '留一个联系你的方式。',
    '准备好，留住每一个想法。',
  ];
  const subtitles = [
    '每一个好想法，都从认识你开始。\n让 agent 以你喜欢的方式陪伴你。',
    '选一个属于你的灵感搭子。\n以后也可以在个人资料中更换。',
    '填写常用邮箱，补全你的个人资料。\n仅保存在这台设备，不会发送验证邮件。',
    '只开启你需要的能力。\n你可以先体验，再随时回来设置。',
  ];
  return (
    <LinearGradient
      colors={
        draft.avatarStyle === 'dusk'
          ? ['#BFCBE6', '#E4E4EE', '#FFE1C4']
          : ['#B5D2ED', '#DCE6F1', '#FFE2C4']
      }
      locations={[0, 0.63, 1]}
      style={styles.root}
    >
      <SafeAreaView style={styles.root}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={step ? '上一步' : '关闭个人资料'}
            disabled={busy || (!step && !onCancel)}
            onPress={() => {
              selectionHaptic();
              setError('');
              if (step) setStep(value => value - 1);
              else onCancel?.();
            }}
            style={[styles.back, !step && !onCancel && styles.hidden]}
          >
            <Icon name="back" color="#657E8D" />
          </Pressable>
          <View
            accessibilityLabel={`第 ${step + 1} 步，共 ${total} 步`}
            style={styles.track}
          >
            <View
              style={[
                styles.trackFill,
                { width: `${((step + 1) / total) * 100}%` },
              ]}
            />
          </View>
          <Text style={styles.step}>
            {String(step + 1).padStart(2, '0')} /{' '}
            {String(total).padStart(2, '0')}
          </Text>
        </View>
        <KeyboardAvoidingView
          style={styles.root}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            <View style={styles.eyes}>
              <View style={styles.eye} />
              <View style={styles.eye} />
            </View>
            <Text style={styles.kicker}>SPUR · YOUR EVERYDAY AGENT</Text>
            <Text accessibilityRole="header" style={styles.title}>
              {titles[step]}
            </Text>
            <Text style={styles.subtitle}>{subtitles[step]}</Text>
            {step === 0 && (
              <View style={styles.form}>
                <Text style={styles.fieldLabel}>你的称呼</Text>
                <TextInput
                  accessibilityLabel="你的称呼"
                  value={draft.name}
                  onChangeText={name => update({ name })}
                  placeholder="想让我怎么称呼你…"
                  placeholderTextColor="#8B9DAA"
                  style={styles.nameInput}
                  maxLength={24}
                  autoCorrect={false}
                  autoComplete="nickname"
                  returnKeyType="next"
                  onSubmitEditing={() => next()}
                  editable={!busy}
                />
                <Text style={styles.caption}>不必是真名，喜欢的昵称就好。</Text>
              </View>
            )}
            {step === 1 && (
              <>
                <View style={styles.selectedAvatar}>
                  <ProfileAvatar
                    id={draft.avatarId}
                    variant={draft.avatarStyle}
                    size={112}
                  />
                  <View style={styles.avatarCheck}>
                    <Icon name="check" size={14} color="#FFFFFF" />
                  </View>
                </View>
                <Text style={styles.avatarName}>
                  {avatarNames[draft.avatarId]} · 你的灵感搭子
                </Text>
                <View style={styles.avatarGrid}>
                  {avatarIds.map((id, index) => (
                    <Pressable
                      key={id}
                      accessibilityRole="button"
                      accessibilityLabel={`选择${avatarNames[id]}头像`}
                      accessibilityState={{ selected: draft.avatarId === id }}
                      onPress={() => {
                        selectionHaptic();
                        update({ avatarId: id });
                      }}
                      style={[
                        styles.avatarChoice,
                        index % 2 === 1 && styles.avatarOffset,
                        draft.avatarId === id && styles.avatarSelected,
                      ]}
                    >
                      <ProfileAvatar
                        id={id}
                        size={70}
                        variant={draft.avatarStyle}
                      />
                    </Pressable>
                  ))}
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="切换头像风格"
                  onPress={() => {
                    selectionHaptic();
                    update({
                      avatarStyle:
                        draft.avatarStyle === 'daylight' ? 'dusk' : 'daylight',
                    });
                  }}
                  style={styles.changeStyle}
                >
                  <Icon name="refresh" size={16} color="#677D8B" />
                  <Text style={styles.changeStyleText}>
                    换个氛围 ·{' '}
                    {draft.avatarStyle === 'daylight' ? '晨光' : '暮色'}
                  </Text>
                </Pressable>
              </>
            )}
            {step === 2 && (
              <View style={styles.form}>
                <View style={styles.emailIcon}>
                  <Icon name="mail" size={30} color="#657D90" />
                </View>
                <Text style={styles.fieldLabel}>常用邮箱</Text>
                <TextInput
                  accessibilityLabel="邮箱地址"
                  value={draft.email}
                  onChangeText={email => update({ email })}
                  placeholder="you@example.com"
                  placeholderTextColor="#8B9DAA"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  textContentType="emailAddress"
                  maxLength={254}
                  style={styles.emailInput}
                  returnKeyType="done"
                  onSubmitEditing={() => next()}
                  editable={!busy}
                />
                <View style={styles.privacyRow}>
                  <Icon name="lock" size={14} color="#83919B" />
                  <Text style={styles.caption}>
                    资料填写不等于登录；不会订阅邮件或上传云端。
                  </Text>
                </View>
              </View>
            )}
            {step === 3 && (
              <View style={styles.permissions}>
                <PermissionCard
                  icon="mic"
                  title="声音与本机转写"
                  description={
                    Platform.OS === 'ios'
                      ? '麦克风记录想法，Apple Speech 在本机转成文字，音频不上传。'
                      : '麦克风记录想法；Android 录音文件本机转写暂未接入。'
                  }
                  status={
                    permissions
                      ? `麦克风${permissions.microphone ? '已允许' : '未允许'}${
                          Platform.OS === 'ios'
                            ? ` · 语音识别${
                                permissions.speech ? '已允许' : '未允许'
                              }`
                            : ''
                        }`
                      : '尚未申请权限'
                  }
                  granted={
                    !!permissions?.microphone &&
                    (Platform.OS !== 'ios' || !!permissions?.speech)
                  }
                  disabled={busy}
                  onPress={() => request('audio')}
                />
                {Platform.OS === 'ios' &&
                  !!permissions?.speech &&
                  !permissions.onDeviceAvailable && (
                    <Text style={styles.permissionNote}>
                      中文本机识别资源尚未就绪，可在系统中准备后重试；不会回退上传音频。
                    </Text>
                  )}
                <PermissionCard
                  icon="ring"
                  title="连接录音戒指"
                  description="允许蓝牙发现与连接，随后可在设备页配对。授权不代表已连接戒指。"
                  status={
                    permissions?.bluetooth === 'granted'
                      ? '蓝牙权限已允许'
                      : permissions?.bluetooth === 'unsupported'
                      ? '当前设备不支持蓝牙'
                      : ['denied', 'restricted'].includes(
                          permissions?.bluetooth || '',
                        )
                      ? '蓝牙权限未允许'
                      : '尚未申请权限'
                  }
                  granted={permissions?.bluetooth === 'granted'}
                  disabled={busy}
                  onPress={() => request('bluetooth')}
                />
                <View style={styles.boundary}>
                  <Icon name="lock" size={17} color="#7A8A93" />
                  <Text style={styles.boundaryText}>
                    不申请通讯录、日历、健康或相册权限。AI
                    分析另行确认，只发送你授权的转写文字。
                  </Text>
                </View>
              </View>
            )}
            {!!error && (
              <Text
                accessibilityRole="alert"
                accessibilityLiveRegion="polite"
                style={styles.error}
              >
                {error}
              </Text>
            )}
          </ScrollView>
          <View style={styles.footerBar}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                step === total - 1
                  ? editing
                    ? '保存个人资料'
                    : '进入 agent'
                  : '继续'
              }
              disabled={busy || (step === 0 && !draft.name.trim())}
              onPress={() => next()}
              style={({ pressed }) => [
                styles.continue,
                (busy || (step === 0 && !draft.name.trim())) && styles.disabled,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.continueText}>
                {busy
                  ? '正在准备…'
                  : step === total - 1
                  ? editing
                    ? '保存个人资料'
                    : '开启我的 agent'
                  : '继续'}
              </Text>
              <Icon name="chevron" size={18} color="#42586A" />
            </Pressable>
            {step === 2 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="稍后填写邮箱"
                disabled={busy}
                onPress={() => next(true)}
                style={styles.skip}
              >
                <Text style={styles.skipText}>稍后填写邮箱</Text>
              </Pressable>
            ) : (
              <Text style={styles.footer}>
                {step === 3
                  ? '权限可选，暂不开启也能进入 · 随时在设置中修改'
                  : '属于你的灵感空间，正在慢慢成形。'}
              </Text>
            )}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

function PermissionCard({
  icon,
  title,
  description,
  status,
  granted,
  disabled,
  onPress,
}: {
  icon: string;
  title: string;
  description: string;
  status: string;
  granted: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <View style={styles.permissionCard}>
      <View style={styles.permissionTop}>
        <View style={styles.permissionIcon}>
          <Icon name={icon} size={24} color="#637F90" />
        </View>
        <View style={styles.permissionHeading}>
          <Text style={styles.permissionTitle}>{title}</Text>
          <Text
            accessibilityLiveRegion="polite"
            style={styles.permissionStatus}
          >
            {status}
          </Text>
        </View>
      </View>
      <Text style={styles.permissionDescription}>{description}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`授权${title}`}
        disabled={disabled || granted}
        onPress={onPress}
        style={[styles.connect, granted && styles.connected]}
      >
        <Icon name={granted ? 'check' : 'plus'} size={15} color="#617C8A" />
        <Text style={styles.connectText}>
          {granted ? '已授权' : '开启权限'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 22,
    paddingVertical: 16,
  },
  back: { width: 30, height: 34, justifyContent: 'center' },
  hidden: { opacity: 0 },
  track: {
    flex: 1,
    height: 5,
    borderRadius: 4,
    backgroundColor: '#FFFFFF55',
    overflow: 'hidden',
  },
  trackFill: { height: 5, backgroundColor: '#FFFFFF', borderRadius: 4 },
  step: { fontSize: 10, color: '#718B9C' },
  content: { flexGrow: 1, paddingHorizontal: 28, paddingBottom: 14 },
  eyes: { flexDirection: 'row', gap: 13, marginTop: 27, marginBottom: 24 },
  eye: {
    width: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    shadowColor: '#FFFFFF',
    shadowRadius: 12,
    shadowOpacity: 0.8,
    shadowOffset: { width: 0, height: 0 },
  },
  kicker: {
    fontSize: 9,
    letterSpacing: 2,
    color: '#7791A4',
    marginBottom: 14,
    fontWeight: '600',
  },
  title: {
    fontSize: 29,
    fontWeight: '500',
    color: '#293E50',
    lineHeight: 42,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    color: '#738B9D',
    lineHeight: 23,
    marginTop: 15,
    marginBottom: 20,
  },
  form: { marginTop: 22, marginBottom: 28 },
  fieldLabel: {
    color: '#708A9B',
    fontSize: 11,
    marginBottom: 10,
    letterSpacing: 1,
  },
  nameInput: {
    paddingVertical: 15,
    fontSize: 25,
    color: '#364F62',
    borderBottomWidth: 1,
    borderBottomColor: '#FFFFFFCC',
    marginBottom: 14,
  },
  caption: { fontSize: 11, color: '#8799A5', lineHeight: 20, flexShrink: 1 },
  emailInput: {
    backgroundColor: '#FFFFFF70',
    borderWidth: 1,
    borderColor: '#FFFFFFCC',
    padding: 18,
    borderRadius: 20,
    color: '#364F62',
    fontSize: 18,
  },
  emailIcon: {
    height: 64,
    width: 64,
    borderRadius: 22,
    backgroundColor: '#FFFFFF70',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  privacyRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    marginTop: 14,
  },
  selectedAvatar: {
    alignSelf: 'center',
    padding: 6,
    backgroundColor: '#FFFFFF66',
    borderWidth: 1,
    borderColor: '#FFFFFFCC',
    borderRadius: 70,
    marginTop: 4,
  },
  avatarCheck: {
    position: 'absolute',
    bottom: 8,
    right: 2,
    backgroundColor: '#8097AE',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    borderRadius: 15,
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarName: {
    fontSize: 11,
    color: '#7D90A0',
    textAlign: 'center',
    marginTop: 12,
  },
  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    columnGap: 18,
    rowGap: 12,
    marginTop: 20,
    marginBottom: 22,
  },
  avatarChoice: {
    padding: 4,
    borderRadius: 46,
    borderColor: 'transparent',
    borderWidth: 2,
  },
  avatarOffset: { transform: [{ translateY: 7 }] },
  avatarSelected: { borderColor: '#FFFFFF', backgroundColor: '#FFFFFF77' },
  changeStyle: {
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 7,
    alignItems: 'center',
    padding: 10,
    marginBottom: 12,
  },
  changeStyleText: { fontSize: 12, color: '#748895' },
  permissions: { gap: 12, marginTop: 4 },
  permissionCard: {
    padding: 18,
    backgroundColor: '#FFFFFF60',
    borderWidth: 1,
    borderColor: '#FFFFFFA0',
    borderRadius: 25,
  },
  permissionTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  permissionIcon: {
    backgroundColor: '#FFFFFF99',
    width: 45,
    height: 45,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionHeading: { flex: 1 },
  permissionTitle: { fontSize: 16, fontWeight: '500', color: '#435C6D' },
  permissionStatus: { fontSize: 10, color: '#8A9DA9', marginTop: 5 },
  permissionDescription: {
    color: '#8194A0',
    fontSize: 12,
    lineHeight: 21,
    marginTop: 13,
  },
  connect: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    borderRadius: 17,
    paddingVertical: 9,
    paddingHorizontal: 13,
    backgroundColor: '#E0E9F0',
    marginTop: 12,
  },
  connected: { backgroundColor: '#DEE9E0' },
  connectText: { fontSize: 12, color: '#6A8090' },
  permissionNote: {
    fontSize: 11,
    color: '#94826E',
    lineHeight: 19,
    paddingHorizontal: 8,
  },
  boundary: {
    flexDirection: 'row',
    gap: 9,
    alignItems: 'flex-start',
    padding: 10,
  },
  boundaryText: { flex: 1, fontSize: 11, color: '#8A969C', lineHeight: 20 },
  error: { fontSize: 12, color: '#A36359', lineHeight: 21, marginTop: 12 },
  footerBar: { paddingHorizontal: 28, paddingTop: 12, paddingBottom: 14 },
  continue: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFFE8',
    borderRadius: 30,
    minHeight: 57,
    padding: 15,
  },
  continueText: { color: '#3D5364', fontSize: 16, fontWeight: '600' },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.7 },
  skip: { padding: 17, alignItems: 'center' },
  skipText: { fontSize: 12, color: '#84919A' },
  footer: {
    fontSize: 10,
    textAlign: 'center',
    color: '#94A0A6',
    lineHeight: 19,
    marginTop: 15,
    marginBottom: 8,
  },
});
