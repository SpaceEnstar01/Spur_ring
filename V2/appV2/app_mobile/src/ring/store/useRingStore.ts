import { create } from 'zustand';

import type { RingConnectionStatus, RingDevice } from '../types';

type RingState = {
  status: RingConnectionStatus;
  devices: RingDevice[];
  selectedDevice: RingDevice | null;
  errorMessage: string | null;
  syncProgress: number;
  syncError: string | null;
  setSyncError: (message: string | null) => void;
  setSyncProgress: (progress: number) => void;
  setStatus: (status: RingConnectionStatus) => void;
  addDevice: (device: RingDevice) => void;
  clearDevices: () => void;
  selectDevice: (device: RingDevice | null) => void;
  setError: (message: string | null) => void;
};

export const useRingStore = create<RingState>(set => ({
  status: 'idle',
  devices: [],
  selectedDevice: null,
  errorMessage: null,
  syncProgress: 0,
  syncError: null,
  setSyncError: syncError => set({ syncError }),
  setSyncProgress: syncProgress => set({ syncProgress }),
  setStatus: status => set({ status }),
  addDevice: device =>
    set(state => ({
      devices: state.devices.some(item => item.id === device.id)
        ? state.devices.map(item => (item.id === device.id ? device : item))
        : [...state.devices, device],
    })),
  clearDevices: () => set({ devices: [] }),
  selectDevice: selectedDevice => set({ selectedDevice }),
  setError: errorMessage => set({ errorMessage }),
}));
