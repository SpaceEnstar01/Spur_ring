import AsyncStorage from '@react-native-async-storage/async-storage';
import { agentRequest } from '../src/agent/client';
import {
  startCloudAgent,
  isCloudRecordingPending,
  cloudRecordingReply,
} from '../src/agent/runtime';
import { cloudOwnsRecording, useAgentSettings } from '../src/agent/settings';
const file = {
  uri: 'file:///voice-recordings/a.m4a',
  name: 'a.m4a',
  size: 1,
  timestamp: Date.now(),
  transcript: '已有录音',
  source: 'phone' as const,
};

test('retained Java settings cannot start network requests or claim recordings in the audio-agent build', async () => {
  useAgentSettings.setState({
    loaded: true,
    enabledAt: Date.now(),
    bindings: [
      { key: 'a.m4a', clientId: 'old-id', revision: 1, transcript: '已有录音' },
    ],
  });
  const request = jest.spyOn(globalThis, 'fetch');
  const stop = startCloudAgent();
  expect(cloudOwnsRecording(file)).toBe(false);
  expect(isCloudRecordingPending(file)).toBe(false);
  await expect(cloudRecordingReply(file)).resolves.toBeUndefined();
  await expect(agentRequest('/workspace')).rejects.toThrow('尚未接入');
  expect(request).not.toHaveBeenCalled();
  stop();
  request.mockRestore();
});

test('unreadable legacy Java settings do not block ordinary recording replies', async () => {
  const previous = useAgentSettings.getState();
  await AsyncStorage.setItem('spur-cloud-agent-v1', '{invalid legacy state');
  useAgentSettings.setState({ loaded: false });
  try {
    await expect(cloudRecordingReply(file)).resolves.toBeUndefined();
    expect(await AsyncStorage.getItem('spur-cloud-agent-v1')).toBe(
      '{invalid legacy state',
    );
  } finally {
    await AsyncStorage.removeItem('spur-cloud-agent-v1');
    useAgentSettings.setState(previous);
  }
});
