import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

export const PROFILE_KEY = 'spur-local-profile-v1';
export const avatarIds = [
  'cat',
  'bunny',
  'bear',
  'fox',
  'bird',
  'puppy',
] as const;
export type AvatarId = (typeof avatarIds)[number];
export type LocalProfile = {
  name: string;
  email: string;
  avatarId: AvatarId;
  avatarStyle: 'daylight' | 'dusk';
  completed: boolean;
};
export const emptyProfile: LocalProfile = {
  name: '',
  email: '',
  avatarId: 'cat',
  avatarStyle: 'daylight',
  completed: false,
};
export const useProfileStore = create<{
  profile: LocalProfile;
  loaded: boolean;
}>(() => ({ profile: emptyProfile, loaded: false }));

export function validateProfile(name: string, email: string) {
  if (
    !name.trim() ||
    name.trim().length > 24 ||
    Array.from(name).some(
      character =>
        character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
    )
  )
    return '请输入 1～24 个字符的称呼';
  if (
    email.trim() &&
    (email.trim().length > 254 ||
      !/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/.test(
        email.trim(),
      ))
  )
    return '请填写有效的邮箱地址，或选择稍后填写';
  return '';
}

export async function loadProfile() {
  const raw = await AsyncStorage.getItem(PROFILE_KEY);
  let profile = { ...emptyProfile };
  try {
    const saved = raw ? JSON.parse(raw) : null;
    if (
      saved &&
      typeof saved.name === 'string' &&
      typeof saved.email === 'string' &&
      !validateProfile(saved.name, saved.email) &&
      avatarIds.includes(saved.avatarId) &&
      ['daylight', 'dusk'].includes(saved.avatarStyle)
    ) {
      profile = {
        name: saved.name.trim(),
        email: saved.email.trim(),
        avatarId: saved.avatarId,
        avatarStyle: saved.avatarStyle,
        completed: saved.completed === true,
      };
    }
  } catch {
    /* Corrupt local data must not bypass first-run setup. */
  }
  useProfileStore.setState({ profile, loaded: true });
  return profile;
}

export async function saveProfile(profile: LocalProfile) {
  const error = validateProfile(profile.name, profile.email);
  if (error) throw new Error(error);
  if (
    !avatarIds.includes(profile.avatarId) ||
    !['daylight', 'dusk'].includes(profile.avatarStyle)
  )
    throw new Error('请选择有效头像');
  const normalized = {
    ...profile,
    name: profile.name.trim(),
    email: profile.email.trim(),
  };
  // Publish only after persistence succeeds; never silently lose onboarding data.
  await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(normalized));
  useProfileStore.setState({ profile: normalized, loaded: true });
}
