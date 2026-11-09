import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  loadProfile,
  saveProfile,
  useProfileStore,
} from '../profile/profileStore';
import { startAutomaticRecognition } from '../services/automaticRecognition';
import { startRecordingLibraryRepair } from '../services/recordingLibraryRepair';
import { AutomaticReplySetup } from './AutomaticReplySetup';
import { OnboardingFlow } from './OnboardingFlow';
import { startAgentAlarms } from '../services/agentAlarms';
import { startCloudAgent } from '../agent/runtime';

export function PermissionGate({ children }: { children: React.ReactNode }) {
  const profile = useProfileStore(state => state.profile);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => startRecordingLibraryRepair(), []);
  useEffect(() => {
    let active = true;
    setError('');
    loadProfile()
      .then(() => {
        if (active) setReady(true);
      })
      .catch(() => {
        if (active)
          setError('本机资料暂时无法读取，请重试，不会覆盖已有内容。');
      });
    return () => {
      active = false;
    };
  }, [attempt]);
  useEffect(
    () => (ready && profile.completed ? startAgentAlarms() : undefined),
    [ready, profile.completed],
  );
  useEffect(
    () => (ready && profile.completed ? startCloudAgent() : undefined),
    [ready, profile.completed],
  );
  useEffect(
    () =>
      ready && profile.completed ? startAutomaticRecognition() : undefined,
    [ready, profile.completed],
  );
  if (!ready)
    return (
      <View style={styles.loading}>
        {error ? (
          <>
            <Text style={styles.error}>{error}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setAttempt(value => value + 1)}
              style={styles.retry}
            >
              <Text>重试</Text>
            </Pressable>
          </>
        ) : (
          <ActivityIndicator color="#7A93A9" />
        )}
      </View>
    );
  if (!profile.completed)
    return <OnboardingFlow initial={profile} onComplete={saveProfile} />;
  return (
    <>
      <AutomaticReplySetup />
      {children}
    </>
  );
}
const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E1EAF2',
    padding: 28,
  },
  error: { color: '#637587', lineHeight: 23, textAlign: 'center' },
  retry: { padding: 18 },
});
