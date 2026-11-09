import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Platform } from 'react-native';

import { AgentFlowScreen } from '@/screens/assistant/AgentFlowScreen';
import { YanqiangVoiceDebugScreen } from '@/screens/device/YanqiangVoiceDebugScreen';
import { YanqiangRecordingDebugScreen } from '@/screens/device/YanqiangRecordingDebugScreen';
import { MeScreen } from '@/screens/me/MeScreen';
import { VoiceAgentScreen } from '@/screens/voice-agent/VoiceAgentScreen';
import { LocalRecordingResultScreen } from '@/screens/recordings/LocalRecordingResultScreen';
import { TranscriptScreen } from '@/screens/recordings/TranscriptScreen';
import type { RootStackParamList } from '@/types/navigation';

// Store 1.0: ConnectLaptop / CloudOffice / YanqiangButtonDebug unregistered for App Review.
// Source files kept. Restore steps: app/docs/appstore/store/2026-09-12-Laptop-Office-Debug-下架与恢复备份.md

const Stack = createNativeStackNavigator<RootStackParamList>();

export function AppNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={AgentFlowScreen} />
      {__DEV__ && Platform.OS === 'ios' ? <Stack.Screen name="VoiceAgent" component={VoiceAgentScreen} /> : null}
      <Stack.Screen name="Device" component={YanqiangVoiceDebugScreen} />
      <Stack.Screen name="Me" component={MeScreen} />
      <Stack.Screen name="RecordingSummary" component={LocalRecordingResultScreen} />
      <Stack.Screen name="Transcript" component={TranscriptScreen} />
      <Stack.Screen name="YanqiangRecordingDebug" component={YanqiangRecordingDebugScreen} />
    </Stack.Navigator>
  );
}

