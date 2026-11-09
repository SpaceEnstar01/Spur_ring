import React from 'react';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';
import type { AvatarId } from '../profile/profileStore';

export const avatarNames: Record<AvatarId, string> = {
  cat: '小猫',
  bunny: '小兔',
  bear: '小熊',
  fox: '小狐',
  bird: '小鸟',
  puppy: '小狗',
};
const palettes: Record<AvatarId, [string, string, string]> = {
  cat: ['#E4E9FA', '#68708C', '#D2D8EB'],
  bunny: ['#F1E7F2', '#FDF9F3', '#E3B5C2'],
  bear: ['#F3E8DB', '#C9A184', '#EBD6BB'],
  fox: ['#FCE8D8', '#D59262', '#FFF2DD'],
  bird: ['#E0F0F2', '#90BDCA', '#F3D38D'],
  puppy: ['#EBEDD9', '#D4BA8C', '#8C796A'],
};
export function ProfileAvatar({
  id = 'cat',
  size = 72,
  variant = 'daylight',
}: {
  id?: AvatarId;
  size?: number;
  variant?: 'daylight' | 'dusk';
}) {
  const [background, fur, accent] = palettes[id];
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Circle
        cx="50"
        cy="50"
        r="49"
        fill={variant === 'dusk' ? '#D8D7E9' : background}
      />
      <Ellipse cx="50" cy="86" rx="28" ry="15" fill={fur} />
      {id === 'bunny' ? (
        <>
          <Ellipse
            cx="35"
            cy="28"
            rx="10"
            ry="23"
            fill={fur}
            transform="rotate(-12 35 28)"
          />
          <Ellipse
            cx="65"
            cy="28"
            rx="10"
            ry="23"
            fill={fur}
            transform="rotate(12 65 28)"
          />
          <Ellipse cx="35" cy="25" rx="4" ry="15" fill={accent} />
          <Ellipse cx="65" cy="25" rx="4" ry="15" fill={accent} />
        </>
      ) : id === 'cat' || id === 'fox' ? (
        <>
          <Path d="M22 48L22 17Q37 20 43 36Z" fill={fur} />
          <Path d="M57 36Q64 20 78 17L78 48Z" fill={fur} />
          <Path d="M27 35L27 24L37 33ZM63 33L73 24L73 35Z" fill={accent} />
        </>
      ) : id === 'puppy' ? (
        <>
          <Ellipse
            cx="24"
            cy="48"
            rx="12"
            ry="25"
            fill={accent}
            transform="rotate(14 24 48)"
          />
          <Ellipse
            cx="76"
            cy="48"
            rx="12"
            ry="25"
            fill={accent}
            transform="rotate(-14 76 48)"
          />
        </>
      ) : id === 'bear' ? (
        <>
          <Circle cx="27" cy="31" r="14" fill={fur} />
          <Circle cx="73" cy="31" r="14" fill={fur} />
          <Circle cx="27" cy="31" r="8" fill={accent} />
          <Circle cx="73" cy="31" r="8" fill={accent} />
        </>
      ) : (
        <Path d="M44 31Q40 13 48 14Q54 15 53 32Q57 17 63 23L58 35" fill={fur} />
      )}
      <Ellipse cx="50" cy="55" rx="31" ry="29" fill={fur} />
      {(id === 'fox' || id === 'bear' || id === 'puppy') && (
        <Ellipse
          cx="50"
          cy="67"
          rx="20"
          ry="14"
          fill={id === 'puppy' ? '#F8EDD6' : accent}
        />
      )}
      <Ellipse cx="31" cy="64" rx="6" ry="3" fill="#EAAEAD" opacity={0.7} />
      <Ellipse cx="69" cy="64" rx="6" ry="3" fill="#EAAEAD" opacity={0.7} />
      <Ellipse cx="38" cy="53" rx="3" ry="4" fill="#303744" />
      <Ellipse cx="62" cy="53" rx="3" ry="4" fill="#303744" />
      <Circle cx="39" cy="52" r="1" fill="#FFFFFF" />
      <Circle cx="63" cy="52" r="1" fill="#FFFFFF" />
      {id === 'bird' ? (
        <Path d="M44 63L50 71L56 63Z" fill={accent} />
      ) : (
        <>
          <Path d="M46 63Q50 60 54 63L50 67Z" fill="#685E62" />
          <Path
            d="M50 67Q45 74 42 69M50 67Q55 74 58 69"
            stroke="#685E62"
            strokeWidth="1.5"
            fill="none"
            strokeLinecap="round"
          />
        </>
      )}
      {id === 'cat' && (
        <Path
          d="M22 62L34 65M20 68L33 68M66 65L78 62M67 68L80 68"
          stroke={accent}
          strokeWidth="1.2"
        />
      )}
    </Svg>
  );
}
