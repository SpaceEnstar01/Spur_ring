import { PermissionsAndroid, Platform } from 'react-native';
import { phoneAudio } from './phoneAudio';
export type PermissionSnapshot = {
  microphone: boolean;
  speech: boolean;
  onDeviceAvailable: boolean;
  bluetooth?: string;
};
const bluetoothPermissions = () =>
  Number(Platform.Version) >= 31
    ? [
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      ]
    : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];

function normalizePermissions(value: PermissionSnapshot): PermissionSnapshot {
  // Legacy native bridges can serialize Objective-C BOOL values as numeric 0/1.
  const granted = (field: unknown) => field === true || field === 1;
  return {
    ...value,
    microphone: granted(value.microphone),
    speech: granted(value.speech),
    onDeviceAvailable: granted(value.onDeviceAvailable),
  };
}

export async function getOnboardingPermissions(): Promise<PermissionSnapshot> {
  if (Platform.OS === 'ios' && phoneAudio?.getPermissions)
    return normalizePermissions(await phoneAudio.getPermissions());
  if (Platform.OS === 'android') {
    const results = await Promise.all(
      bluetoothPermissions().map(permission =>
        PermissionsAndroid.check(permission),
      ),
    );
    return {
      microphone: await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      ),
      speech: false,
      onDeviceAvailable: false,
      bluetooth: results.every(Boolean) ? 'granted' : 'undetermined',
    };
  }
  return { microphone: false, speech: false, onDeviceAvailable: false };
}
export async function requestAudioPermissions(): Promise<PermissionSnapshot> {
  if (Platform.OS === 'ios' && phoneAudio?.requestPermissions)
    return normalizePermissions(await phoneAudio.requestPermissions());
  if (Platform.OS === 'android') {
    await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
    );
    return getOnboardingPermissions();
  }
  throw new Error('当前版本暂不支持权限申请，请更新原生安装包');
}
export async function requestRingPermission(): Promise<PermissionSnapshot> {
  if (Platform.OS === 'ios' && phoneAudio?.requestBluetoothPermissions)
    return normalizePermissions(await phoneAudio.requestBluetoothPermissions());
  if (Platform.OS === 'android') {
    await PermissionsAndroid.requestMultiple(bluetoothPermissions());
    return getOnboardingPermissions();
  }
  throw new Error('请安装包含新权限模块的版本，或稍后在连接戒指时授权');
}
