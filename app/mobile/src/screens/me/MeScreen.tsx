import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft, ChevronRight, Crown, Info, User } from 'lucide-react-native';

import { AppScreen } from '@/components/AppScreen';
import { colors } from '@/theme/colors';
import { t } from '@/locales';

const FREE_MINUTES = 300;

export function MeScreen() {
  const navigation = useNavigation();

  function comingSoon(title: string) {
    Alert.alert(title, t.me.comingSoon);
  }

  return (
    <AppScreen tone="plain" bottomInset={32}>
      <View style={styles.topBar}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()} hitSlop={8}>
          <ChevronLeft color={colors.text} size={22} strokeWidth={2.2} />
        </Pressable>
        <Text style={styles.topTitle}>{t.me.title}</Text>
        <View style={styles.backButton} />
      </View>

      <Pressable style={styles.profileCard} onPress={() => comingSoon(t.me.account)}>
        <View style={styles.avatar}>
          <User color={colors.text} size={28} strokeWidth={1.8} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.name}>{t.me.guestName}</Text>
          <Text style={styles.caption}>{t.me.tapToEditProfile}</Text>
        </View>
        <ChevronRight color={colors.textTertiary} size={18} />
      </Pressable>

      <View style={styles.quotaCard}>
        <Text style={styles.quotaLabel}>{t.me.freeQuota}</Text>
        <Text style={styles.quotaValue}>
          {FREE_MINUTES}
          <Text style={styles.quotaUnit}> {t.me.minutes}</Text>
        </Text>
        <Text style={styles.quotaHint}>{t.me.freeQuotaHint}</Text>
      </View>

      <Pressable style={styles.memberButton} onPress={() => comingSoon(t.me.unlockMember)}>
        <Crown color="#fff" size={18} strokeWidth={2} />
        <Text style={styles.memberText}>{t.me.unlockMember}</Text>
      </Pressable>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t.me.settings}</Text>
        <Pressable style={styles.row} onPress={() => comingSoon(t.me.account)}>
          <Text style={styles.rowLabel}>{t.me.account}</Text>
          <ChevronRight color={colors.textTertiary} size={18} />
        </Pressable>
        <Pressable style={styles.row} onPress={() => comingSoon(t.me.notifications)}>
          <Text style={styles.rowLabel}>{t.me.notifications}</Text>
          <ChevronRight color={colors.textTertiary} size={18} />
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t.me.about}</Text>
        <Pressable style={styles.row} onPress={() => Alert.alert(t.me.aboutSpur, t.me.aboutSpurBody)}>
          <View style={styles.rowLeft}>
            <Info color={colors.text} size={16} />
            <Text style={styles.rowLabel}>{t.me.aboutSpur}</Text>
          </View>
          <ChevronRight color={colors.textTertiary} size={18} />
        </Pressable>
        <View style={styles.versionRow}>
          <Text style={styles.versionLabel}>{t.me.version}</Text>
          <Text style={styles.versionValue}>1.0.0</Text>
        </View>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center'
  },
  topTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700'
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 18,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 14
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f3f3',
    borderWidth: 1,
    borderColor: colors.border
  },
  name: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800'
  },
  caption: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 4
  },
  quotaCard: {
    padding: 18,
    borderRadius: 18,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12
  },
  quotaLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600'
  },
  quotaValue: {
    color: colors.text,
    fontSize: 36,
    fontWeight: '900',
    marginTop: 6
  },
  quotaUnit: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textSecondary
  },
  quotaHint: {
    color: colors.textTertiary,
    fontSize: 12,
    marginTop: 8,
    lineHeight: 17
  },
  memberButton: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: colors.text,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 22
  },
  memberText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800'
  },
  section: {
    marginBottom: 18,
    borderRadius: 18,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden'
  },
  sectionTitle: {
    color: colors.textTertiary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
    textTransform: 'uppercase'
  },
  row: {
    minHeight: 50,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  rowLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600'
  },
  versionRow: {
    minHeight: 46,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border
  },
  versionLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600'
  },
  versionValue: {
    color: colors.textTertiary,
    fontSize: 13,
    fontWeight: '600'
  }
});
