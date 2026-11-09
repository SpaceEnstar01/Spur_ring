import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Alert, AppState } from 'react-native';
import { RecorderScreen } from '../src/screens/RecorderScreen';
import { PrimaryButton } from '../src/components/PrimaryButton';
import { phoneAudio, startPhoneRecording } from '../src/services/phoneAudio';
import { useRecordingStore } from '../src/ring/store/useRecordingStore';

jest.mock('@react-navigation/native', () => ({ usePreventRemove: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: 'SafeAreaView',
}));
jest.mock('../src/services/phoneAudio', () => ({
  startPhoneRecording: jest.fn(),
  phoneAudio: {
    stop: jest.fn(),
    cancel: jest.fn().mockResolvedValue(undefined),
  },
}));
const navigation = { replace: jest.fn() };
let renderer: TestRenderer.ReactTestRenderer;
beforeEach(() => {
  jest.clearAllMocks();
  useRecordingStore.setState({ files: [] });
  Object.defineProperty(AppState, 'currentState', {
    configurable: true,
    value: 'active',
  });
});
afterEach(async () => {
  if (renderer) {
    await act(() => renderer.unmount());
  }
});
async function mount() {
  await act(() => {
    renderer = TestRenderer.create(
      <RecorderScreen
        navigation={navigation as never}
        route={{ key: 'test', name: 'Recorder' }}
      />,
    );
  });
}
test('microphone failure does not create an audio file or navigate', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  (startPhoneRecording as jest.Mock).mockRejectedValue(
    new Error('麦克风权限被拒绝'),
  );
  try {
    await mount();
    await act(async () => {
      await renderer.root.findByType(PrimaryButton).props.onPress();
    });
    expect(alert).toHaveBeenCalledWith('无法录音', '麦克风权限被拒绝');
    expect(useRecordingStore.getState().files).toHaveLength(0);
    expect(navigation.replace).not.toHaveBeenCalled();
    expect(renderer.root.findByType(PrimaryButton).props.title).toBe(
      '开始录音',
    );
  } finally {
    alert.mockRestore();
  }
});
test('completed recording is stored once and opens its note editor', async () => {
  (startPhoneRecording as jest.Mock).mockResolvedValue(undefined);
  const file = {
    uri: 'file:///voice-recordings/test.m4a',
    name: 'test.m4a',
    size: 1024,
    timestamp: 1,
    source: 'phone',
  };
  (phoneAudio.stop as jest.Mock).mockResolvedValue(file);
  await mount();
  await act(async () => {
    await renderer.root.findByType(PrimaryButton).props.onPress();
  });
  expect(renderer.root.findByType(PrimaryButton).props.title).toBe(
    '结束并保存',
  );
  await act(async () => {
    await renderer.root.findByType(PrimaryButton).props.onPress();
  });
  expect(useRecordingStore.getState().files).toEqual([file]);
  expect(navigation.replace).toHaveBeenCalledWith('Note', {
    recordingUri: file.uri,
  });
  expect(phoneAudio.stop).toHaveBeenCalledTimes(1);
});
