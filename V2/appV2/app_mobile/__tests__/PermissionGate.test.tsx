import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PermissionGate } from '../src/components/PermissionGate';
import { OnboardingFlow } from '../src/components/OnboardingFlow';
import {
  emptyProfile,
  PROFILE_KEY,
  useProfileStore,
} from '../src/profile/profileStore';
import { phoneAudio } from '../src/services/phoneAudio';
import { startAutomaticRecognition } from '../src/services/automaticRecognition';

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: 'SafeAreaView',
}));
jest.mock('../src/services/phoneAudio', () => ({
  phoneAudio: { requestPermissions: jest.fn() },
}));
jest.mock('../src/services/automaticRecognition', () => ({
  startAutomaticRecognition: jest.fn(() => jest.fn()),
}));
jest.mock('../src/services/agentAlarms', () => ({
  startAgentAlarms: jest.fn(() => jest.fn()),
}));
jest.mock('../src/ring/RingConnectionService', () => ({
  ringConnectionService: { initialize: jest.fn().mockResolvedValue(undefined) },
}));
let renderer: TestRenderer.ReactTestRenderer;
beforeEach(() => {
  jest.clearAllMocks();
  useProfileStore.setState({ profile: emptyProfile, loaded: false });
  (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
  (phoneAudio.requestPermissions as jest.Mock).mockResolvedValue({
    microphone: true,
    speech: true,
    onDeviceAvailable: true,
  });
});
afterEach(async () => {
  await act(() => renderer?.unmount());
});
async function mount() {
  await act(async () => {
    renderer = TestRenderer.create(
      <PermissionGate>
        <Text>APP 内容</Text>
      </PermissionGate>,
    );
  });
}
test('first entry shows profile onboarding before permissions, completion persists and starts worker', async () => {
  await mount();
  expect(JSON.stringify(renderer.toJSON())).toContain('嗨，我该怎么称呼你');
  expect(phoneAudio.requestPermissions).not.toHaveBeenCalled();
  expect(startAutomaticRecognition).not.toHaveBeenCalled();
  await act(async () => {
    await renderer.root.findByType(OnboardingFlow).props.onComplete({
      ...emptyProfile,
      name: '海鹏',
      email: 'demo@example.com',
      completed: true,
    });
  });
  expect(phoneAudio.requestPermissions).not.toHaveBeenCalled();
  expect(AsyncStorage.setItem).toHaveBeenCalledWith(
    PROFILE_KEY,
    expect.stringContaining('demo@example.com'),
  );
  expect(JSON.stringify(renderer.toJSON())).toContain('APP 内容');
  expect(startAutomaticRecognition).toHaveBeenCalledTimes(1);
});
test('remembered completed profile enters without asking permissions again', async () => {
  (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) =>
    Promise.resolve(
      key === PROFILE_KEY
        ? JSON.stringify({ ...emptyProfile, name: '海鹏', completed: true })
        : null,
    ),
  );
  await mount();
  expect(JSON.stringify(renderer.toJSON())).toContain('APP 内容');
  expect(phoneAudio.requestPermissions).not.toHaveBeenCalled();
});

test('old permission setup does not bypass new profile onboarding', async () => {
  (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) =>
    Promise.resolve(key === 'spur-local-speech-setup-v1' ? 'done' : null),
  );
  await mount();
  expect(renderer.root.findByType(OnboardingFlow)).toBeDefined();
  expect(startAutomaticRecognition).not.toHaveBeenCalled();
});

test('storage read failure does not overwrite a profile or silently enter', async () => {
  (AsyncStorage.getItem as jest.Mock).mockRejectedValue(
    new Error('storage failure'),
  );
  await mount();
  expect(JSON.stringify(renderer.toJSON())).toContain('本机资料暂时无法读取');
  expect(AsyncStorage.setItem).not.toHaveBeenCalledWith(
    PROFILE_KEY,
    expect.any(String),
  );
});
