import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import type { Presentation } from '../intent/presentation';
// Editorial illustrations, not photographs or evidence of an event.
export function IntentArtwork({
  type,
  color,
  glasses = false,
}: {
  type: Presentation;
  color: string;
  glasses?: boolean;
}) {
  return (
    <Svg
      width={104}
      height={90}
      viewBox="0 0 104 90"
      fill="none"
      accessibilityElementsHidden
    >
      <Circle cx={58} cy={44} r={34} fill={color} opacity={0.08} />
      <Circle cx={87} cy={14} r={4} fill={color} opacity={0.22} />
      <Path
        d="M9 64h9M14 59v10"
        stroke={color}
        strokeWidth={1.5}
        opacity={0.4}
      />
      {glasses ? (
        <>
          <Path
            d="M15 40h29l-3 18H24l-9-18ZM60 40h29l-9 18H63l-3-18ZM44 43c5-5 11-5 16 0M15 40l-3-9M89 40l3-9"
            stroke={color}
            strokeWidth={2.5}
            strokeLinejoin="round"
          />
          <Path
            d="M64 22l3-7 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z"
            fill={color}
            opacity={0.35}
          />
        </>
      ) : type === 'report' ? (
        <>
          <Rect
            x={29}
            y={14}
            width={49}
            height={61}
            rx={7}
            fill="white"
            stroke={color}
            opacity={0.85}
          />
          <Path
            d="M39 29h22M39 38h29M39 46h29M39 54h17M39 64h10"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
          />
        </>
      ) : type === 'script' ? (
        <>
          <Rect
            x={17}
            y={25}
            width={72}
            height={44}
            rx={7}
            fill="white"
            stroke={color}
          />
          <Path
            d="M17 35h72M27 25l8 10M45 25l8 10M63 25l8 10M46 45l13 8-13 8V45Z"
            stroke={color}
            strokeWidth={2}
            strokeLinejoin="round"
          />
        </>
      ) : type === 'analytics' ? (
        <>
          <Rect
            x={20}
            y={23}
            width={68}
            height={48}
            rx={8}
            fill="white"
            stroke={color}
          />
          <Path
            d="M31 59l13-10 12 4 19-19M65 34h10v10"
            stroke={color}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      ) : (
        <>
          <Rect
            x={24}
            y={22}
            width={58}
            height={48}
            rx={10}
            fill="white"
            stroke={color}
          />
          <Path
            d="M35 46l11 11 24-24"
            stroke={color}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}
    </Svg>
  );
}
