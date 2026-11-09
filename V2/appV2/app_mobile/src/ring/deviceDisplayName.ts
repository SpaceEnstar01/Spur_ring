import type { RingDevice } from './types';

// Presentation only: keep the SDK name and full connection identifier unchanged.
export function deviceDisplayName(device?: Pick<RingDevice, 'id'> | null) {
  const suffix = device?.id
    .trim()
    .replace(/[:\s-]/g, '')
    .slice(-4)
    .toUpperCase();
  return suffix ? `Spur Ring · …${suffix}` : 'Spur Ring';
}
