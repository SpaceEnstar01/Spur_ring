import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrimaryButton } from '../components/PrimaryButton';
import { Icon } from '../components/Icon';
import type { RootStackParamList } from '../navigation/types';
import { ringConnectionService } from '../ring/RingConnectionService';
import { useRingStore } from '../ring/store/useRingStore';
import { deviceDisplayName } from '../ring/deviceDisplayName';
import { connectionLabels } from './HomeScreen';
type Props = NativeStackScreenProps<RootStackParamList, 'Device'>;
export function DeviceScreen({ navigation }: Props) {
  const { status, selectedDevice, errorMessage, syncProgress } = useRingStore();
  const [busy, setBusy] = useState(false);
  const online = ['connected', 'recording', 'syncing'].includes(status);
  const pending = ['connecting', 'authenticating', 'syncing'].includes(status);
  async function action(task: () => Promise<void>) {
    setBusy(true);
    try {
      await task();
    } catch (e) {
      Alert.alert('设备提示', e instanceof Error ? e.message : '操作失败');
    } finally {
      setBusy(false);
    }
  }
  return (
    <SafeAreaView edges={['bottom']} style={styles.root}>
      <View style={styles.hero}>
        <Icon name="ring" size={100} color={online ? '#698158' : '#ACB0A5'} />
        <Text style={styles.title}>{deviceDisplayName(selectedDevice)}</Text>
        <Text style={styles.status}>{connectionLabels[status]}</Text>
        <Text style={styles.address}>{selectedDevice?.id}</Text>
      </View>
      {status === 'syncing' && (
        <Text style={styles.status}>正在下载录音 · {syncProgress}%</Text>
      )}
      {!!errorMessage && <Text style={styles.error}>{errorMessage}</Text>}
      {online ? (
        <PrimaryButton
          title={status === 'syncing' ? '录音同步中…' : '同步戒指录音'}
          disabled={busy || status !== 'connected'}
          onPress={() => action(() => ringConnectionService.syncRecordings())}
        />
      ) : selectedDevice ? (
        <PrimaryButton
          title="重新连接"
          disabled={busy || pending}
          onPress={() =>
            action(() => ringConnectionService.connect(selectedDevice))
          }
        />
      ) : (
        <PrimaryButton
          title="添加录音戒指"
          onPress={() => navigation.navigate('PairingGuide')}
        />
      )}
      {online && (
        <Text
          style={styles.link}
          onPress={() => action(() => ringConnectionService.disconnect())}
        >
          断开连接
        </Text>
      )}
      {selectedDevice && (
        <Text
          style={styles.link}
          onPress={() =>
            Alert.alert('忘记此戒指？', '之后可重新搜索并连接。', [
              { text: '取消' },
              {
                text: '忘记设备',
                onPress: () => action(() => ringConnectionService.forget()),
              },
            ])
          }
        >
          忘记设备
        </Text>
      )}
      {!online && selectedDevice && (
        <Text
          style={styles.link}
          onPress={() => navigation.navigate('RingSearch')}
        >
          搜索其他戒指
        </Text>
      )}
      <Text style={styles.hint}>
        APP
        在前台且戒指已连接时，录音结束会自动同步到首页；重新连接或回到前台时也会检查待同步录音。此处仍可手动补同步。
      </Text>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, padding: 24, backgroundColor: '#F4F4F4' },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '700', marginTop: 28, color: '#252924' },
  status: { color: '#7A896C', fontSize: 16, marginTop: 12 },
  address: { color: '#AAAFA5', fontSize: 11, marginTop: 10 },
  error: { color: '#AA4D3B', marginBottom: 20 },
  link: { padding: 16, textAlign: 'center', color: '#7F8776' },
  hint: {
    color: '#9EA397',
    fontSize: 12,
    lineHeight: 20,
    marginVertical: 20,
    textAlign: 'center',
  },
});
