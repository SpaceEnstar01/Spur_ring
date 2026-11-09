import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Alert, TextInput } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { OnboardingFlow } from '../src/components/OnboardingFlow';
import {
  emptyProfile,
  loadProfile,
  PROFILE_KEY,
  saveProfile,
  useProfileStore,
  validateProfile,
} from '../src/profile/profileStore';
import {
  getOnboardingPermissions,
  requestAudioPermissions,
  requestRingPermission,
} from '../src/services/onboardingPermissions';

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: 'SafeAreaView',
}));
jest.mock('../src/services/haptics', () => ({ selectionHaptic: jest.fn() }));
jest.mock('../src/services/onboardingPermissions', () => ({
  getOnboardingPermissions: jest.fn(),
  requestAudioPermissions: jest.fn(),
  requestRingPermission: jest.fn(),
}));
let renderer: TestRenderer.ReactTestRenderer;
const complete = jest.fn().mockResolvedValue(undefined);
const snapshot = {
  microphone: false,
  speech: false,
  onDeviceAvailable: false,
  bluetooth: 'undetermined',
};
const label = (name: string) =>
  renderer.root.findAll(node => node.props.accessibilityLabel === name)[0];
async function press(name: string) {
  await act(async () => {
    await label(name).props.onPress();
  });
}
async function fill(name: string, value: string) {
  await act(() =>
    renderer.root
      .findAllByType(TextInput)
      .find(node => node.props.accessibilityLabel === name)!
      .props.onChangeText(value),
  );
}
async function mount(editing = false) {
  await act(() => {
    renderer = TestRenderer.create(
      <OnboardingFlow
        initial={emptyProfile}
        onComplete={complete}
        editing={editing}
        onCancel={jest.fn()}
      />,
    );
  });
}
async function toEmail() {
  await mount();
  await fill('你的称呼', '海鹏');
  await press('继续');
  await press('继续');
}
beforeEach(() => {
  jest.clearAllMocks();
  (getOnboardingPermissions as jest.Mock).mockResolvedValue(snapshot);
  (requestAudioPermissions as jest.Mock).mockResolvedValue({
    ...snapshot,
    microphone: true,
    speech: true,
    onDeviceAvailable: true,
  });
  (requestRingPermission as jest.Mock).mockResolvedValue({
    ...snapshot,
    bluetooth: 'granted',
  });
  complete.mockResolvedValue(undefined);
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  useProfileStore.setState({ profile: emptyProfile, loaded: false });
});
afterEach(async () => {
  await act(() => renderer?.unmount());
  jest.restoreAllMocks();
});

test('four steps retain name, avatar and email without requesting permissions on entry', async () => {
  await mount();
  expect(label('继续').props.disabled).toBe(true);
  await fill('你的称呼', '海鹏');
  await press('继续');
  await press('选择小兔头像');
  await press('切换头像风格');
  expect(label('选择小兔头像').props.accessibilityState.selected).toBe(true);
  await press('继续');
  await fill('邮箱地址', 'demo@example.com');
  await press('继续');
  expect(requestAudioPermissions).not.toHaveBeenCalled();
  expect(requestRingPermission).not.toHaveBeenCalled();
  await press('进入 agent');
  expect(complete).toHaveBeenCalledWith({
    ...emptyProfile,
    name: '海鹏',
    avatarId: 'bunny',
    avatarStyle: 'dusk',
    email: 'demo@example.com',
    completed: true,
  });
});
test('invalid email blocks progress, skip is explicit and stores no invalid address', async () => {
  await toEmail();
  await fill('邮箱地址', 'not-an-email');
  await press('继续');
  expect(JSON.stringify(renderer.toJSON())).toContain('请填写有效的邮箱');
  expect(complete).not.toHaveBeenCalled();
  await press('稍后填写邮箱');
  await press('进入 agent');
  expect(complete.mock.calls[0][0].email).toBe('');
});
test('each permission is requested only from its own control and renders true results', async () => {
  await toEmail();
  await press('稍后填写邮箱');
  expect(requestAudioPermissions).not.toHaveBeenCalled();
  await press('授权声音与本机转写');
  expect(requestAudioPermissions).toHaveBeenCalledTimes(1);
  expect(requestRingPermission).not.toHaveBeenCalled();
  await press('授权连接录音戒指');
  expect(requestRingPermission).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(renderer.toJSON())).toContain('蓝牙权限已允许');
  expect(JSON.stringify(renderer.toJSON())).toContain('授权不代表已连接戒指');
});
test('denial remains visible but does not prevent entry; request errors can be retried', async () => {
  await toEmail();
  await press('稍后填写邮箱');
  (requestRingPermission as jest.Mock).mockRejectedValueOnce(
    new Error('权限申请未完成'),
  );
  await press('授权连接录音戒指');
  expect(JSON.stringify(renderer.toJSON())).toContain('权限申请未完成');
  (requestRingPermission as jest.Mock).mockResolvedValueOnce({
    ...snapshot,
    bluetooth: 'denied',
  });
  await press('授权连接录音戒指');
  expect(Alert.alert).toHaveBeenCalled();
  expect(JSON.stringify(renderer.toJSON())).toContain('蓝牙权限未允许');
  await press('进入 agent');
  expect(complete).toHaveBeenCalledTimes(1);
});
test('editing uses three steps, failure stays editable and permission requests never run', async () => {
  await mount(true);
  await fill('你的称呼', '新称呼');
  await press('继续');
  await press('继续');
  complete.mockRejectedValueOnce(new Error('保存失败'));
  await press('保存个人资料');
  expect(JSON.stringify(renderer.toJSON())).toContain('保存失败');
  await press('保存个人资料');
  expect(complete).toHaveBeenCalledTimes(2);
  expect(requestAudioPermissions).not.toHaveBeenCalled();
  expect(getOnboardingPermissions).not.toHaveBeenCalled();
});
test('profile validation is bounded and rejects malformed data without creating authenticated state', async () => {
  expect(validateProfile('', '')).toBeTruthy();
  expect(validateProfile('a'.repeat(25), '')).toBeTruthy();
  expect(validateProfile('name', 'fake@')).toBeTruthy();
  expect(validateProfile('name', 'demo+notes@example.com')).toBe('');
  expect(validateProfile('name', '')).toBe('');
  await saveProfile({
    ...emptyProfile,
    name: ' 海鹏 ',
    email: ' demo@example.com ',
    completed: true,
  });
  expect(useProfileStore.getState().profile.name).toBe('海鹏');
  expect(useProfileStore.getState().profile).not.toHaveProperty('token');
  (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('{bad json');
  await loadProfile();
  expect(useProfileStore.getState().profile.completed).toBe(false);
  (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(
    new Error('disk full'),
  );
  await expect(
    saveProfile({ ...emptyProfile, name: '海鹏', completed: true }),
  ).rejects.toThrow('disk full');
  expect(useProfileStore.getState().profile.completed).toBe(false);
  expect(AsyncStorage.setItem).toHaveBeenCalledWith(
    PROFILE_KEY,
    expect.any(String),
  );
});
