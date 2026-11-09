import { AgentMailboxScreen } from './src/screens/AgentMailboxScreen';
import { MailNotificationSync } from './src/components/MailNotificationSync';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type { RootStackParamList } from './src/navigation/types';
import { HomeScreen } from './src/screens/HomeScreen';
import { PairingGuideScreen } from './src/screens/PairingGuideScreen';
import { PairingResultScreen } from './src/screens/PairingResultScreen';
import { RingSearchScreen } from './src/screens/RingSearchScreen';
import { colors } from './src/theme/tokens';
import { ChatScreen } from './src/screens/ChatScreen';
import { DeviceScreen } from './src/screens/DeviceScreen';
import { NoteScreen } from './src/screens/NoteScreen';
import { ConnectAppsScreen } from './src/screens/ConnectAppsScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { RecorderScreen } from './src/screens/RecorderScreen';
import { PermissionGate } from './src/components/PermissionGate';

const Stack = createNativeStackNavigator<RootStackParamList>();

function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <PermissionGate>
        <NavigationContainer>
          <MailNotificationSync />
          <Stack.Navigator
            initialRouteName="Home"
            screenOptions={{
              contentStyle: { backgroundColor: colors.background },
              headerStyle: { backgroundColor: colors.background },
              headerShadowVisible: false,
              headerTintColor: colors.text,
              headerTitle: '',
            }}
          >
            <Stack.Screen
              name="Recorder"
              component={RecorderScreen}
              options={{ headerTitle: '手机录音', gestureEnabled: false }}
            />
            <Stack.Screen
              name="Home"
              component={HomeScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="ConnectApps"
              component={ConnectAppsScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="AgentMailbox"
              component={AgentMailboxScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen name="PairingGuide" component={PairingGuideScreen} />
            <Stack.Screen name="RingSearch" component={RingSearchScreen} />
            <Stack.Screen
              name="PairingResult"
              component={PairingResultScreen}
              options={{ headerBackVisible: false, gestureEnabled: false }}
            />
            <Stack.Screen
              name="Device"
              component={DeviceScreen}
              options={{ headerTitle: '我的戒指' }}
            />
            <Stack.Screen
              name="Chat"
              component={ChatScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Note"
              component={NoteScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Settings"
              component={SettingsScreen}
              options={{ headerTitle: '设置' }}
            />
          </Stack.Navigator>
        </NavigationContainer>
      </PermissionGate>
    </SafeAreaProvider>
  );
}

export default App;
