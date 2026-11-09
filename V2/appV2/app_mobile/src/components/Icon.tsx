import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

export function Icon({
  name,
  size = 24,
  color = '#222622',
}: {
  name: string;
  size?: number;
  color?: string;
}) {
  const paths: Record<string, string> = {
    search: 'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
    link: 'M10 13a5 5 0 0 0 7 0l4-4a5 5 0 0 0-7-7l-3 3M14 11a5 5 0 0 0-7 0l-4 4a5 5 0 0 0 7 7l3-3',
    bell: 'M6 9a6 6 0 0 1 12 0v6l2 3H4l2-3V9ZM10 21h4',
    analytics: 'M4 20h16M6 16v-5M12 16V4M18 16V8',
    users:
      'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 4a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.87M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
    like: 'M7 10v11H3V10h4ZM7 10l5-8 2 1v6h6l1 3-3 9H7',
    send: 'M22 2L9 15M22 2l-8 20-5-7-7-5L22 2Z',
    trash: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7',
    menu: 'M4 6h16M4 12h16M4 18h16',
    mail: 'M3 5h18v14H3V5ZM3 6l9 7 9-7',
    lock: 'M7 10V7a5 5 0 0 1 10 0v3M5 10h14v11H5V10ZM12 14v3',
    grid: 'M3 3h7v7H3ZM14 3h7v7h-7ZM3 14h7v7H3ZM14 14h7v7h-7Z',
    chevron: 'M9 5l7 7-7 7',
    back: 'M15 5l-7 7 7 7',
    play: 'M9 5l11 7-11 7V5Z',
    check: 'M5 12l4 4L19 6',
    sparkles:
      'M12 3l2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3ZM20 2v4M18 4h4',
    workspace: 'M3 7h7l2-3h9v16H3V7ZM3 11h18',
    settings: 'M4 7h16M4 17h16M8 4v6M16 14v6',
    close: 'M5 5l14 14M19 5L5 19',
    clock: 'M12 5v7H7',
    arrow: 'M12 19V5M6 11l6-6 6 6',
    plus: 'M12 4v16M4 12h16',
    mic: 'M8 5a4 4 0 0 1 8 0v7a4 4 0 0 1-8 0V5ZM5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8',
    wave: 'M4 10v4M8 6v12M12 3v18M16 7v10M20 10v4',
    refresh: 'M20 7V3m0 4h-4M20 7a9 9 0 1 0 1 8',
    ring: 'M8 6c-5 2-6 9-2 13s10 2 12-2c3-5 1-11-4-12-2-1-4 0-6 1ZM8 9c-3 2-3 6-1 8s6 1 8-1c2-3 1-7-2-8-2 0-3 0-5 1Z',
    note: 'M7 3h10a2 2 0 0 1 2 2v16H5V5a2 2 0 0 1 2-2ZM9 8h6M9 12h6M9 16h3',
  };
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {name === 'clock' && <Circle cx="12" cy="12" r="9" />}
      {name === 'stop' ? (
        <Rect x="6" y="6" width="12" height="12" rx="2" />
      ) : (
        <Path d={paths[name] || paths.note} />
      )}
    </Svg>
  );
}
