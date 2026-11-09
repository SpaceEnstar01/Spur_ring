import { Platform } from 'react-native';
import { phoneAudio } from '../src/services/phoneAudio';
import {
  getOnboardingPermissions,
  requestAudioPermissions,
  requestRingPermission,
} from '../src/services/onboardingPermissions';

jest.mock('../src/services/phoneAudio', () => ({
  phoneAudio: {
    getPermissions: jest.fn(),
    requestPermissions: jest.fn(),
    requestBluetoothPermissions: jest.fn(),
  },
}));
beforeEach(() => {
  jest.clearAllMocks();
  jest.replaceProperty(Platform, 'OS', 'ios');
});
afterEach(() => jest.restoreAllMocks());
test('reading native status normalizes numeric BOOL values without requesting permissions', async () => {
  (phoneAudio.getPermissions as jest.Mock).mockResolvedValue({
    microphone: 1,
    speech: 0,
    onDeviceAvailable: 0,
    bluetooth: 'denied',
  });
  expect(await getOnboardingPermissions()).toEqual({
    microphone: true,
    speech: false,
    onDeviceAvailable: false,
    bluetooth: 'denied',
  });
  expect(phoneAudio.requestPermissions).not.toHaveBeenCalled();
  expect(phoneAudio.requestBluetoothPermissions).not.toHaveBeenCalled();
});
test('audio authorization does not trigger bluetooth and has normalized actual results', async () => {
  (phoneAudio.requestPermissions as jest.Mock).mockResolvedValue({
    microphone: 1,
    speech: 1,
    onDeviceAvailable: 0,
    bluetooth: 'undetermined',
  });
  expect(await requestAudioPermissions()).toMatchObject({
    microphone: true,
    speech: true,
    onDeviceAvailable: false,
  });
  expect(phoneAudio.requestBluetoothPermissions).not.toHaveBeenCalled();
});
test('bluetooth authorization does not trigger microphone, speech or a scan', async () => {
  (phoneAudio.requestBluetoothPermissions as jest.Mock).mockResolvedValue({
    microphone: 0,
    speech: 0,
    onDeviceAvailable: 1,
    bluetooth: 'granted',
  });
  expect(await requestRingPermission()).toEqual({
    microphone: false,
    speech: false,
    onDeviceAvailable: true,
    bluetooth: 'granted',
  });
  expect(phoneAudio.requestPermissions).not.toHaveBeenCalled();
});
