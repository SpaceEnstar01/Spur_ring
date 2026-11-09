import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrimaryButton } from '../components/PrimaryButton';
import { Icon } from '../components/Icon';
import type { RootStackParamList } from '../navigation/types';
import { ringConnectionService } from '../ring/RingConnectionService';
import { useRingStore } from '../ring/store/useRingStore';
import { deviceDisplayName } from '../ring/deviceDisplayName';
import { colors } from '../theme/tokens';
type Props = NativeStackScreenProps<RootStackParamList, 'RingSearch'>;
export function RingSearchScreen({ navigation }: Props) {
  const devices = useRingStore(state => state.devices);
  const status = useRingStore(state => state.status);
  const [error, setError] = useState('');
  const scan = () => {
    setError('');
    ringConnectionService.scan().catch(e => setError(e.message));
  };
  useEffect(() => {
    scan();
    return () => ringConnectionService.stopScan();
  }, []);
  return (
    <SafeAreaView edges={['bottom']} style={styles.root}>
      <Text style={styles.title}>寻找你的戒指</Text>
      <Text style={styles.subtitle}>
        保持戒指靠近手机，并按厂商说明激活配对。
      </Text>
      <View style={styles.radar}>
        <Icon name="ring" size={80} color="#738565" />
        {status === 'scanning' && (
          <ActivityIndicator style={styles.indicator} color="#738565" />
        )}
      </View>
      <Text accessibilityRole="alert" style={styles.error}>
        {error}
      </Text>
      <FlatList
        data={devices}
        keyExtractor={item => item.id}
        ListEmptyComponent={
          <Text style={styles.subtitle}>
            {status === 'scanning'
              ? '正在扫描附近设备…'
              : '未发现设备，可重新搜索。'}
          </Text>
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`连接 ${deviceDisplayName(item)}`}
            style={styles.device}
            onPress={() => {
              ringConnectionService.stopScan();
              navigation.replace('PairingResult', { device: item });
            }}
          >
            <Icon name="ring" />
            <View style={styles.deviceText}>
              <Text style={styles.name}>{deviceDisplayName(item)}</Text>
              <Text style={styles.address}>录音戒指 · 轻点连接</Text>
            </View>
            <Text style={styles.address}>
              {item.rssi ? `${item.rssi} dBm` : '连接 ›'}
            </Text>
          </Pressable>
        )}
      />
      <PrimaryButton
        title={status === 'scanning' ? '正在搜索' : '重新搜索'}
        disabled={status === 'scanning'}
        onPress={scan}
      />
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, padding: 24, backgroundColor: colors.background },
  title: { fontSize: 30, color: colors.text, fontWeight: '700', marginTop: 24 },
  subtitle: { color: colors.textMuted, lineHeight: 24, marginTop: 14 },
  radar: { height: 200, alignItems: 'center', justifyContent: 'center' },
  indicator: { marginTop: 15 },
  error: { color: '#B24738', marginBottom: 15 },
  device: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 18,
    borderRadius: 16,
    marginBottom: 12,
  },
  deviceText: { flex: 1, marginLeft: 12 },
  name: { fontSize: 18, fontWeight: '800', color: colors.text },
  address: { fontSize: 11, marginTop: 5, color: colors.textMuted },
});
