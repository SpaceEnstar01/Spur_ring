import React, { useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { RootStackParamList } from '../navigation/types';
import {
  appCategories,
  AppCategory,
  DemoApp,
  demoApps,
  filterDemoApps,
} from '../integrations/demoApps';
import { IntegrationIcon } from '../components/IntegrationIcon';
import { Icon } from '../components/Icon';
import {
  RealAppConnections,
  matchingRealConnections,
} from '../components/RealAppConnections';
type Props = NativeStackScreenProps<RootStackParamList, 'ConnectApps'>;
export function ConnectAppsScreen({ navigation }: Props) {
  const [apps, setApps] = useState(
    demoApps.filter(app => app.id !== 'youtube' && app.id !== 'notion'),
  );
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<AppCategory>('All');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [managing, setManaging] = useState(false);
  const selected = apps.find(app => app.id === selectedId);
  const matching = filterDemoApps(apps, query, category);
  function update(id: string, added: boolean) {
    setApps(current =>
      current.map(app => (app.id === id ? { ...app, added } : app)),
    );
    setSelectedId(null);
  }
  function remove(app: DemoApp) {
    Alert.alert(
      `Remove ${app.name} from your selected tools?`,
      'This changes the selected tools only. No real account is connected or disconnected.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove from Tools',
          style: 'destructive',
          onPress: () => update(app.id, false),
        },
      ],
    );
  }
  function section(title: string, added: boolean) {
    const items = matching.filter(app => app.added === added);
    if (!items.length) return null;
    return (
      <View style={s.section}>
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>{title}</Text>
          {added && (
            <Pressable
              accessibilityRole="button"
              onPress={() => setManaging(!managing)}
              hitSlop={10}
            >
              <Text style={s.manage}>{managing ? 'Done' : 'Manage'}</Text>
            </Pressable>
          )}
        </View>
        {items.map(app => (
          <View key={app.id} style={s.row}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`View ${app.name} integration`}
              onPress={() => setSelectedId(app.id)}
              style={s.rowInfo}
            >
              <IntegrationIcon id={app.id} />
              <View style={s.rowCopy}>
                <Text style={s.appName}>{app.name}</Text>
                <Text style={s.description}>{app.description}</Text>
              </View>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                added && managing
                  ? `Remove ${app.name} from tools`
                  : added
                  ? `${app.name} selected`
                  : `Select ${app.name}`
              }
              onPress={() =>
                added && managing ? remove(app) : setSelectedId(app.id)
              }
              style={[s.badge, added && !managing && s.added]}
            >
              <Text style={[s.badgeText, added && !managing && s.addedText]}>
                {added ? (managing ? 'Remove' : '✓ Selected') : 'Select'}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Details for ${app.name}`}
              onPress={() => setSelectedId(app.id)}
              hitSlop={6}
            >
              <Icon name="chevron" size={13} color="#BBC0CA" />
            </Pressable>
          </View>
        ))}
      </View>
    );
  }
  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <Text style={s.brand}>
          spur<Text style={s.blue}>.</Text>
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close Connect Apps"
          onPress={() => navigation.goBack()}
          style={s.close}
        >
          <Icon name="close" size={18} />
        </Pressable>
      </View>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={s.content}
      >
        <Text style={s.title}>Connect Apps</Text>
        <Text style={s.subtitle}>
          Connect your tools to let Spur work across your workflow.
        </Text>
        <View style={s.search}>
          <Icon name="search" size={17} color="#929CAB" />
          <TextInput
            style={s.input}
            value={query}
            onChangeText={setQuery}
            placeholder="Search apps and integrations..."
            placeholderTextColor="#99A1AE"
            accessibilityLabel="Search apps and integrations"
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.chips}
          accessibilityRole="tablist"
        >
          {appCategories.map(item => (
            <Pressable
              key={item}
              accessibilityRole="tab"
              accessibilityLabel={item}
              accessibilityState={{ selected: category === item }}
              onPress={() => setCategory(item)}
              style={[s.chip, category === item && s.selectedChip]}
            >
              <Text
                style={[s.chipText, category === item && s.selectedChipText]}
              >
                {item}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        <RealAppConnections query={query} category={category} />
        {section('Selected tools', true)}
        {section('Available', false)}
        {!matching.length &&
          !matchingRealConnections(query, category).length && (
            <View style={s.empty}>
              <Icon name="search" size={29} color="#ADB5C3" />
              <Text style={s.emptyTitle}>No apps found</Text>
              <Text style={s.subtitle}>Try another search or category.</Text>
            </View>
          )}
      </ScrollView>
      <Modal
        visible={!!selected}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelectedId(null)}
      >
        <SafeAreaView style={s.root}>
          <View style={s.header}>
            <Text style={s.demoCaption}>CONNECT APPS</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close integration details"
              onPress={() => setSelectedId(null)}
              style={s.close}
            >
              <Icon name="close" size={18} />
            </Pressable>
          </View>
          {selected && (
            <ScrollView contentContainerStyle={s.content}>
              <IntegrationIcon id={selected.id} />
              <Text style={[s.title, s.detailTitle]}>{selected.name}</Text>
              <Text style={s.subtitle}>{selected.description}</Text>
              <View style={s.detailNotice}>
                <Text style={s.noticeTitle}>
                  {selected.added ? 'Selected tool' : 'Explore this connection'}
                </Text>
                <Text style={s.detailText}>
                  No third-party account is authorized, and Spur cannot access
                  or change any data.
                </Text>
              </View>
              <Text style={s.sectionTitle}>Planned capabilities</Text>
              {selected.capabilities.map(capability => (
                <View key={capability} style={s.capability}>
                  <Icon name="check" size={16} color="#16A36A" />
                  <Text style={s.detailText}>{capability}</Text>
                </View>
              ))}
              <Text style={s.permissionTitle}>Account & permissions</Text>
              <Text style={s.detailText}>
                No account selected. A future real connection will ask you to
                review the provider’s permissions before authorization.
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  selected.added ? remove(selected) : update(selected.id, true)
                }
                style={s.primary}
              >
                <Text style={s.primaryText}>
                  {selected.added ? 'Remove from Tools' : 'Add to Tools'}
                </Text>
              </Pressable>
              <Text style={s.footer}>
                Selection resets when you leave this page
              </Text>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: {
    color: '#171717',
    fontWeight: '800',
    fontSize: 27,
    letterSpacing: -1.3,
  },
  blue: { color: '#3478F6' },
  close: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F3F4F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { paddingHorizontal: 20, paddingBottom: 30 },
  title: {
    fontSize: 25,
    lineHeight: 33,
    fontWeight: '700',
    color: '#132037',
    marginTop: 8,
  },
  subtitle: { fontSize: 12, lineHeight: 19, color: '#8993A4', marginTop: 5 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#E8EBF1',
    borderRadius: 12,
    backgroundColor: '#FCFCFE',
    paddingHorizontal: 12,
    marginTop: 20,
  },
  input: {
    flex: 1,
    minWidth: 0,
    fontSize: 12,
    color: '#172033',
    paddingVertical: 12,
  },
  chips: { flexDirection: 'row', gap: 7, paddingVertical: 10 },
  chip: {
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: '#F4F5F8',
  },
  selectedChip: { backgroundColor: '#E8F0FF' },
  chipText: { fontSize: 10, color: '#8A93A3' },
  selectedChipText: { color: '#3478F6', fontWeight: '700' },
  demo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
    marginBottom: 4,
  },
  demoDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#9BABBD' },
  demoText: { color: '#99A3B2', fontSize: 10 },
  section: { marginTop: 19 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 9,
  },
  sectionTitle: { color: '#162139', fontSize: 12, fontWeight: '700' },
  manage: { color: '#9099AA', fontSize: 11, paddingVertical: 5 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FC',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 7,
    marginBottom: 7,
    minHeight: 60,
  },
  rowInfo: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  rowCopy: { flex: 1, minWidth: 0 },
  appName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1B2435',
    lineHeight: 17,
  },
  description: { fontSize: 9, color: '#8A94A6', lineHeight: 14, marginTop: 1 },
  badge: {
    minWidth: 61,
    paddingHorizontal: 8,
    paddingVertical: 7,
    borderRadius: 7,
    backgroundColor: '#ECEEF3',
  },
  badgeText: {
    fontSize: 10,
    color: '#768297',
    textAlign: 'center',
    fontWeight: '600',
  },
  added: { backgroundColor: '#E3F7EF' },
  addedText: { color: '#16A36A' },
  empty: { alignItems: 'center', paddingVertical: 60, gap: 10 },
  emptyTitle: { fontSize: 17, color: '#293449', fontWeight: '600' },
  demoCaption: { fontSize: 10, letterSpacing: 1.5, color: '#8A94A6' },
  detailTitle: { marginTop: 16 },
  detailNotice: {
    backgroundColor: '#F3F7FC',
    padding: 16,
    borderRadius: 15,
    marginVertical: 22,
    gap: 8,
  },
  noticeTitle: { color: '#3478F6', fontSize: 13, fontWeight: '600' },
  detailText: { color: '#7C8798', fontSize: 13, lineHeight: 21 },
  capability: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingVertical: 10,
  },
  permissionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#162139',
    marginTop: 20,
    marginBottom: 10,
  },
  primary: {
    backgroundColor: '#171717',
    borderRadius: 24,
    padding: 15,
    alignItems: 'center',
    marginTop: 28,
  },
  primaryText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  footer: {
    fontSize: 10,
    color: '#98A2B2',
    textAlign: 'center',
    marginTop: 14,
  },
});
