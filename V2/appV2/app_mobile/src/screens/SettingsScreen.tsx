import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Switch,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { phoneAudio } from '../services/phoneAudio';
import { refreshAutomaticRecognition } from '../services/automaticRecognition';
import { useProfileStore, saveProfile } from '../profile/profileStore';
import { ProfileAvatar } from '../components/ProfileAvatar';
import { OnboardingFlow } from '../components/OnboardingFlow';
import {
  getCreatorAgentUrl,
  getDefaultCreatorAgentUrl,
  hasCreatorAgentToken,
  saveCreatorAgentToken,
  setCreatorAgentUrl,
  testCreatorAgentConnection,
} from '../services/creatorAgentApi';
import { PrimaryButton } from '../components/PrimaryButton';
import {
  confirmEnableAutomaticReplies,
  useReplySettings,
} from '../services/automaticReplies';
export function SettingsScreen() {
  const profile = useProfileStore(state => state.profile);
  const [editingProfile, setEditingProfile] = useState(false);
  const autoReply = useReplySettings(state => state.choice === 'enabled');
  const [creatorUrl, setCreatorUrl] = useState('');
  const [creatorStatus, setCreatorStatus] = useState('');
  const [creatorBusy, setCreatorBusy] = useState(false);
  const [creatorToken, setCreatorToken] = useState('');
  const [creatorTokenSaved, setCreatorTokenSaved] = useState(false);
  const [permissions, setPermissions] = useState('正在检查本机识别…');
  const refreshPermissions = () => {
    if (!phoneAudio?.getPermissions) {
      setPermissions('此版本仅支持 iPhone 录音文件本机识别');
      return;
    }
    return phoneAudio
      .getPermissions()
      .then(result => {
        setPermissions(
          `麦克风${result.microphone ? '已允许' : '未允许'} · 语音识别${
            result.speech ? '已允许' : '未允许'
          }\n中文本机识别${result.onDeviceAvailable ? '可用' : '尚未就绪'}`,
        );
      })
      .catch(() => setPermissions('本机语音识别状态暂不可用'));
  };
  const creatorRequest = useRef<AbortController | null>(null);
  useEffect(() => {
    getCreatorAgentUrl().then(base => {
      setCreatorUrl(base);
      if (base)
        hasCreatorAgentToken(base)
          .then(setCreatorTokenSaved)
          .catch(() => setCreatorTokenSaved(false));
    });
    refreshPermissions();
    const app = AppState.addEventListener('change', state => {
      if (state === 'active') {
        refreshPermissions();
      }
    });
    return () => {
      creatorRequest.current?.abort();
      creatorRequest.current = null;
      app.remove();
    };
  }, []);
  return (
    <ScrollView
      contentContainerStyle={styles.root}
      keyboardShouldPersistTaps="handled"
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="编辑个人资料"
        onPress={() => setEditingProfile(true)}
        style={styles.profileCard}
      >
        <ProfileAvatar
          id={profile.avatarId}
          variant={profile.avatarStyle}
          size={60}
        />
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>{profile.name || '我的 Spur'}</Text>
          <Text style={styles.speechHint}>
            {profile.email || '尚未填写邮箱'}
          </Text>
          <Text style={styles.profilePrivacy}>
            仅本机资料 · 邮箱未验证 · 点击修改
          </Text>
        </View>
      </Pressable>
      <Modal
        visible={editingProfile}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setEditingProfile(false)}
      >
        <OnboardingFlow
          initial={profile}
          editing
          onCancel={() => setEditingProfile(false)}
          onComplete={async value => {
            await saveProfile(value);
            setEditingProfile(false);
          }}
        />
      </Modal>
      <View style={styles.speechCard}>
        <Text style={styles.label}>本机语音识别</Text>
        <Text style={styles.speechHint}>{permissions}</Text>
        <Text style={styles.speechHint}>
          录音仅在 iPhone 本地识别，自动生成标题。AI
          回复会发送文字，不发送音频。
        </Text>
        <Text
          style={styles.action}
          onPress={async () => {
            try {
              if (!phoneAudio?.requestPermissions) {
                throw new Error('此版本仅支持 iPhone 录音文件本机识别');
              }
              await phoneAudio.requestPermissions();
              refreshPermissions();
              refreshAutomaticRecognition();
            } catch (error) {
              Alert.alert('权限申请未完成', (error as Error).message);
            }
          }}
        >
          申请麦克风和语音识别权限
        </Text>
        <Text style={styles.speechHint} onPress={() => Linking.openSettings()}>
          已拒绝权限？打开系统设置 ↗
        </Text>
      </View>
      <View style={styles.speechCard}>
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>转写后自动理解与整理</Text>
          <Switch
            accessibilityLabel="转写后自动理解与整理"
            value={autoReply}
            trackColor={{ true: '#7B9165' }}
            onValueChange={value =>
              value
                ? confirmEnableAutomaticReplies()
                : useReplySettings.getState().choose(false)
            }
          />
        </View>
        <Text style={styles.speechHint}>
          开启后自动发送最新一条已有及后续新增录音的转写文字至 Personal
          Agent，自动整理想法和待办，明确的公开网页研究请求会执行。音频不上传，失败可重试；关闭不会删除已有结果。
        </Text>
      </View>
      <Text style={styles.label}>Personal Agent 服务地址</Text>
      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        value={creatorUrl}
        editable={!creatorBusy}
        onChangeText={value => {
          setCreatorUrl(value);
          setCreatorStatus('');
          setCreatorTokenSaved(false);
        }}
        placeholder="https://你的 Personal Agent 域名"
        style={styles.input}
      />
      <PrimaryButton
        title="保存 Personal Agent 地址"
        disabled={creatorBusy}
        onPress={() =>
          setCreatorAgentUrl(creatorUrl)
            .then(async () => {
              setCreatorTokenSaved(await hasCreatorAgentToken(creatorUrl));
              Alert.alert('已保存');
            })
            .catch(error => Alert.alert('地址错误', error.message))
        }
      />
      <Text
        style={styles.action}
        onPress={() => {
          if (!creatorBusy) {
            setCreatorUrl(getDefaultCreatorAgentUrl());
            setCreatorStatus(
              '已填入本次构建的默认 Personal Agent 地址，保存后生效',
            );
          }
        }}
      >
        使用当前构建的 Personal Agent 默认地址
      </Text>
      <Text style={styles.label}>Personal Agent 访问令牌</Text>
      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        value={creatorToken}
        editable={!creatorBusy}
        onChangeText={setCreatorToken}
        placeholder={
          creatorTokenSaved
            ? '已安全保存；输入新令牌可替换'
            : '粘贴 ECS 配置的访问令牌'
        }
        secureTextEntry
        style={styles.input}
      />
      <PrimaryButton
        title="安全保存访问令牌"
        disabled={creatorBusy || !creatorUrl.trim() || !creatorToken.trim()}
        onPress={() =>
          saveCreatorAgentToken(creatorUrl, creatorToken)
            .then(() => {
              setCreatorToken('');
              setCreatorTokenSaved(true);
              Alert.alert('已安全保存', '访问令牌保存在本机系统安全存储中。');
            })
            .catch(error => Alert.alert('令牌未保存', error.message))
        }
      />
      {creatorTokenSaved ? (
        <Text
          style={styles.action}
          onPress={() =>
            saveCreatorAgentToken(creatorUrl, '')
              .then(() => setCreatorTokenSaved(false))
              .catch(error => Alert.alert('无法清除令牌', error.message))
          }
        >
          清除本机保存的 Personal Agent 令牌
        </Text>
      ) : null}
      <Text style={styles.hint}>
        令牌由 ECS 生成，和模型 API Key 不同。App
        将它存入系统安全存储，不写进普通设置文件。
      </Text>
      <PrimaryButton
        title={creatorBusy ? '检测中…' : '检测 Personal Agent'}
        disabled={creatorBusy || !creatorUrl.trim()}
        onPress={async () => {
          const controller = new AbortController();
          creatorRequest.current = controller;
          setCreatorBusy(true);
          setCreatorStatus('');
          const timer = setTimeout(() => controller.abort(), 10000);
          try {
            await testCreatorAgentConnection(creatorUrl, controller.signal);
            if (!controller.signal.aborted) {
              setCreatorStatus('连接成功：硅谷 Personal Agent 健康检查通过。');
            }
          } catch (error) {
            if (creatorRequest.current === controller) {
              setCreatorStatus(
                controller.signal.aborted
                  ? '连接超时，请检查 Personal Agent 地址和手机网络。'
                  : (error as Error).message,
              );
            }
          } finally {
            clearTimeout(timer);
            if (creatorRequest.current === controller) {
              creatorRequest.current = null;
              setCreatorBusy(false);
            }
          }
        }}
      />
      {!!creatorStatus && (
        <Text selectable accessibilityLiveRegion="polite" style={styles.hint}>
          {creatorStatus}
        </Text>
      )}
      <Text style={styles.hint}>
        这是独立于音频服务的地址。硅谷 ECS 当前只监听本机端口；手机接入前需配置
        HTTPS 和访问鉴权，不要直接开放 4173 端口。
      </Text>
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  profileCard: {
    padding: 18,
    borderRadius: 24,
    backgroundColor: '#EDF2F7',
    borderWidth: 1,
    borderColor: '#DFE7EE',
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
    marginBottom: 24,
  },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 18, fontWeight: '600', color: '#42596D' },
  profilePrivacy: { fontSize: 10, color: '#8D9BA5', marginTop: 6 },
  root: { flexGrow: 1, padding: 24, backgroundColor: '#F4F4F4' },
  speechCard: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 20,
    marginBottom: 28,
  },
  speechHint: {
    fontSize: 12,
    lineHeight: 21,
    color: '#909A83',
    marginBottom: 10,
  },
  label: { color: '#333A2D', fontSize: 17, marginBottom: 16 },
  input: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    color: '#333A2D',
    marginBottom: 24,
  },
  hint: { color: '#929A87', lineHeight: 23, marginTop: 20 },
  action: { color: '#606D51', paddingVertical: 20 },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    gap: 12,
  },
  toggleLabel: { color: '#43513B', fontSize: 15, flex: 1 },
});
