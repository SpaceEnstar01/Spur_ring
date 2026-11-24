import React, { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
export const ink = '#172D28',
  muted = '#54685F',
  green = '#225849',
  paper = '#F4F6F1';
export function Words({
  children,
  kind = 'body',
}: {
  children: ReactNode;
  kind?: 'body' | 'title' | 'meta' | 'section' | 'hero';
}) {
  return <Text style={s[kind]}>{children}</Text>;
}
export function Card({
  children,
  onPress,
  tinted = false,
}: {
  children: ReactNode;
  onPress?: () => void;
  tinted?: boolean;
}) {
  const style = [s.card, tinted && s.tinted];
  return onPress ? (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [...style, pressed && s.pressed]}
    >
      {children}
    </Pressable>
  ) : (
    <View style={style}>{children}</View>
  );
}
export function Button({
  label,
  onPress,
  primary = false,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        primary && s.primary,
        pressed && s.pressed,
      ]}
    >
      <Text style={[s.buttonText, primary && s.white]}>{label}</Text>
    </Pressable>
  );
}
export const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: paper },
  editorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
  },
  editorFooter: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: '#DDE6DF',
    backgroundColor: paper,
  },
  header: {
    height: 49,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  back: {
    minHeight: 44,
    minWidth: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  page: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 44, gap: 13 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  between: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  flex: { flex: 1 },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 19,
    borderWidth: 1,
    borderColor: '#E3E6DE',
    padding: 16,
    gap: 9,
  },
  tinted: { backgroundColor: '#EDF4EE' },
  hero: { fontSize: 26, fontWeight: '700', color: ink, lineHeight: 34 },
  section: { fontSize: 17, fontWeight: '700', color: ink, marginTop: 5 },
  title: { fontSize: 16, fontWeight: '600', lineHeight: 23, color: ink },
  body: { fontSize: 15, lineHeight: 23, color: ink },
  meta: { fontSize: 12, lineHeight: 18, color: muted },
  strong: { fontWeight: '700', color: ink },
  pressed: { opacity: 0.7 },
  button: {
    minHeight: 40,
    borderWidth: 1,
    borderColor: '#BFCEC3',
    borderRadius: 13,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
  },
  buttonText: { fontSize: 14, fontWeight: '600', color: green },
  primary: { backgroundColor: green, borderColor: green },
  white: { color: 'white' },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#E3ECE6',
    borderRadius: 16,
    padding: 4,
  },
  smallTabs: { backgroundColor: paper, padding: 0, gap: 3 },
  tab: {
    flex: 1,
    minHeight: 43,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  activeTab: { backgroundColor: 'white' },
  activeChip: { backgroundColor: '#E8EDDF' },
  tabText: { fontSize: 15, color: muted },
  smallText: { fontSize: 13 },
  quote: { padding: 12, borderRadius: 10, backgroundColor: '#FAEDE2' },
  thumbnail: {
    width: 70,
    height: 87,
    borderRadius: 12,
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    padding: 6,
  },
  duration: {
    fontSize: 12,
    color: 'white',
    backgroundColor: '#3338',
    paddingHorizontal: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#BFCEC3',
    borderRadius: 12,
    padding: 12,
    color: ink,
    fontSize: 15,
    minHeight: 58,
    textAlignVertical: 'top',
  },
});
