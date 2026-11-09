import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { usePreventRemove } from '@react-navigation/native';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, AppState, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrimaryButton } from '../components/PrimaryButton';
import type { RootStackParamList } from '../navigation/types';
import { phoneAudio, startPhoneRecording } from '../services/phoneAudio';
import { useRecordingStore } from '../ring/store/useRecordingStore';

type Props = NativeStackScreenProps<RootStackParamList, 'Recorder'>;
export function RecorderScreen({ navigation }: Props) {
  const [phase, setPhase] = useState<
    'idle' | 'starting' | 'recording' | 'saving'
  >('idle');
  const phaseRef = useRef(phase);
  const alive = useRef(true);
  const started = useRef(0);
  const [seconds, setSeconds] = useState(0);
  const [savedUri, setSavedUri] = useState<string>();
  usePreventRemove(phase !== 'idle', () => {
    Alert.alert('录音处理中', '请先结束并保存录音。');
  });
  useEffect(() => {
    if (savedUri && phase === 'idle') {
      navigation.replace('Note', { recordingUri: savedUri });
    }
  }, [savedUri, phase, navigation]);
  const update = (value: typeof phase) => {
    phaseRef.current = value;
    if (alive.current) {
      setPhase(value);
    }
  };
  const stopRef = useRef<() => Promise<void>>(async () => {});
  stopRef.current = async () => {
    if (phaseRef.current !== 'recording') {
      return;
    }
    update('saving');
    try {
      const file = await phoneAudio.stop();
      useRecordingStore.getState().merge([file]);
      update('idle');
      if (alive.current) {
        setSavedUri(file.uri);
      }
    } catch (error) {
      update('idle');
      if (alive.current) {
        Alert.alert('录音未保存', (error as Error).message);
      }
    }
  };
  useEffect(() => {
    alive.current = true;
    const timer = setInterval(() => {
      if (phaseRef.current === 'recording') {
        const elapsed = Math.floor((Date.now() - started.current) / 1000);
        setSeconds(elapsed);
        if (elapsed >= 600) {
          stopRef.current();
        }
      }
    }, 250);
    const app = AppState.addEventListener('change', state => {
      if (state !== 'active') {
        stopRef.current();
      }
    });
    return () => {
      alive.current = false;
      clearInterval(timer);
      app.remove();
      phoneAudio?.cancel().catch(() => {});
    };
  }, [navigation]);
  return (
    <SafeAreaView style={styles.root} edges={['bottom']}>
      <View style={styles.body}>
        <Text style={styles.icon}>●</Text>
        <Text style={styles.title}>
          {phase === 'recording' ? '正在聆听…' : '语音笔记'}
        </Text>
        <Text style={styles.time}>
          {String(Math.floor(seconds / 60)).padStart(2, '0')}:
          {String(seconds % 60).padStart(2, '0')}
        </Text>
        <Text style={styles.hint}>
          使用手机麦克风，单次最长 10 分钟。{'\n'}切换到后台会结束录音。{'\n'}
          结束后自动在本机识别并生成标题，不上传录音。
        </Text>
      </View>
      <PrimaryButton
        title={
          phase === 'recording'
            ? '结束并保存'
            : phase === 'idle'
            ? '开始录音'
            : '处理中…'
        }
        disabled={phase === 'starting' || phase === 'saving'}
        onPress={async () => {
          if (phase === 'recording') {
            await stopRef.current();
            return;
          }
          update('starting');
          try {
            await startPhoneRecording();
            if (!alive.current) {
              await phoneAudio.cancel();
              return;
            }
            started.current = Date.now();
            setSeconds(0);
            update('recording');
            if (AppState.currentState !== 'active') {
              await stopRef.current();
            }
          } catch (error) {
            update('idle');
            if (alive.current) {
              Alert.alert('无法录音', (error as Error).message);
            }
          }
        }}
      />
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, padding: 24, backgroundColor: '#F4F4F4' },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 22 },
  icon: { color: '#FD613F', fontSize: 64 },
  title: { fontSize: 28, color: '#353B30', fontWeight: '600' },
  time: { fontSize: 48, fontVariant: ['tabular-nums'], color: '#555E4C' },
  hint: { fontSize: 14, lineHeight: 26, textAlign: 'center', color: '#90988A' },
});
