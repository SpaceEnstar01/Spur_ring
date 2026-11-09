import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrimaryButton } from '../components/PrimaryButton';
import { Icon } from '../components/Icon';
import type { RootStackParamList } from '../navigation/types';
import { ringConnectionService } from '../ring/RingConnectionService';
import { useRingStore } from '../ring/store/useRingStore';
import { deviceDisplayName } from '../ring/deviceDisplayName';
import { colors } from '../theme/tokens';
type Props = NativeStackScreenProps<RootStackParamList, 'PairingResult'>;
export function PairingResultScreen({ navigation, route }: Props) {
  const status = useRingStore(state => state.status);
  const [error, setError] = useState('');
  const connect = useCallback(() => {
    setError('');
    ringConnectionService
      .connect(route.params.device)
      .catch(e => setError(e.message));
  }, [route.params.device]);
  useEffect(() => {
    connect();
  }, [connect]);
  const success = ['connected', 'recording', 'syncing'].includes(status);
  const failed = !!error || status === 'failed' || status === 'disconnected';
  return (
    <SafeAreaView edges={['bottom']} style={styles.root}>
      <View style={styles.content}>
        <Icon name="ring" size={110} color={success ? '#4B885D' : '#858F7A'} />
        <Text style={styles.title}>
          {success
            ? '连接成功'
            : failed
            ? '连接未完成'
            : status === 'authenticating'
            ? '正在验证戒指'
            : '正在连接'}
        </Text>
        <Text style={styles.description}>
          {deviceDisplayName(route.params.device)}
        </Text>
        {!success && !failed && <ActivityIndicator color="#68795A" />}
        <Text style={styles.error}>{error}</Text>
      </View>
      <PrimaryButton
        title={success ? '开始使用' : failed ? '重新连接' : '连接中…'}
        disabled={!success && !failed}
        onPress={success ? () => navigation.popToTop() : connect}
      />
      {!success && (
        <Text
          style={styles.cancel}
          onPress={() => {
            ringConnectionService.disconnect().catch(() => {});
            navigation.popToTop();
          }}
        >
          取消连接
        </Text>
      )}
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, padding: 24, backgroundColor: colors.background },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 30, fontWeight: '700', color: colors.text, marginTop: 32 },
  description: { color: colors.textMuted, marginVertical: 16 },
  error: { color: '#B24738', marginTop: 16, lineHeight: 24 },
  cancel: { padding: 18, textAlign: 'center', color: colors.textMuted },
});
