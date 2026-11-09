import { NativeModules } from 'react-native';

// Native selection feedback respects system settings; never substitute a long vibration.
export function selectionHaptic() {
  NativeModules.SpurFeedback?.selection?.();
}
