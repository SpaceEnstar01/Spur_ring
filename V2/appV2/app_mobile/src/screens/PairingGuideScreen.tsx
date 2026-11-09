import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '../components/PrimaryButton';
import type { RootStackParamList } from '../navigation/types';
import { colors, radius, spacing } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'PairingGuide'>;

export function PairingGuideScreen({ navigation }: Props) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.step}>01 / 03</Text>
        <Text style={styles.title}>让戒指进入配对状态</Text>
        <Text style={styles.description}>
          请确认戒指有足够电量，并按录音戒指的说明唤醒设备、进入配对状态。
        </Text>
        <View style={styles.illustration}>
          <View style={styles.caseTop} />
          <View style={styles.caseBody}>
            <View style={styles.ring} />
            <View style={styles.indicator} />
          </View>
        </View>
        <PrimaryButton
          title="开始搜索"
          onPress={() => navigation.navigate('RingSearch')}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 },
  container: { flex: 1, padding: spacing.lg },
  step: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '800',
    marginTop: spacing.lg,
  },
  title: {
    color: colors.text,
    fontSize: 32,
    fontWeight: '800',
    marginTop: spacing.lg,
  },
  description: {
    color: colors.textMuted,
    fontSize: 16,
    lineHeight: 25,
    marginTop: spacing.md,
  },
  illustration: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  caseTop: {
    backgroundColor: colors.surfaceStrong,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    height: 56,
    marginBottom: 8,
    width: 210,
  },
  caseBody: {
    alignItems: 'center',
    backgroundColor: colors.surfaceStrong,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    height: 180,
    justifyContent: 'center',
    width: 230,
  },
  ring: {
    borderColor: colors.primary,
    borderRadius: 45,
    borderWidth: 13,
    height: 86,
    width: 86,
  },
  indicator: {
    backgroundColor: colors.success,
    borderRadius: 4,
    height: 7,
    marginTop: spacing.lg,
    width: 7,
  },
});
