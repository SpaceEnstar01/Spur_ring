import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

// Local vector marks for this UI preview; no remote image or account requests.
export function IntegrationIcon({ id }: { id: string }) {
  if (id === 'gmail')
    return (
      <View style={s.base}>
        <Svg width={28} height={24} viewBox="0 0 28 24">
          <Path
            d="M3 20V5l11 8L25 5v15"
            fill="none"
            stroke="#EA4335"
            strokeWidth={5}
            strokeLinejoin="round"
          />
          <Path d="M3 20V7" stroke="#4285F4" strokeWidth={5} />
          <Path d="M25 20V7" stroke="#34A853" strokeWidth={5} />
          <Path d="M2 5l4 3" stroke="#C5221F" strokeWidth={5} />
          <Path d="M26 5l-4 3" stroke="#FBBC04" strokeWidth={5} />
        </Svg>
      </View>
    );
  if (id === 'drive')
    return (
      <View style={s.base}>
        <Svg width={30} height={28} viewBox="0 0 30 28">
          <Path d="M10 2h10l-10 18H0Z" fill="#0F9D58" />
          <Path d="M10 2h10l10 18H20Z" fill="#F4B400" />
          <Path d="M0 20h30l-5 8H5Z" fill="#4285F4" />
        </Svg>
      </View>
    );
  if (id === 'youtube')
    return (
      <View style={s.base}>
        <Svg width={29} height={25} viewBox="0 0 29 25">
          <Rect x={1} y={3} width={27} height={19} rx={6} fill="#FF0033" />
          <Path d="M12 8l8 5-8 4Z" fill="#FFFFFF" />
        </Svg>
      </View>
    );
  if (id === 'metricool')
    return (
      <View style={[s.base, s.dark]}>
        <Svg width={27} height={20} viewBox="0 0 30 20">
          <Path
            d="M15 10C9-2 1 1 1 10s8 12 14 0S29-2 29 10s-8 12-14 0Z"
            stroke="#FFFFFF"
            strokeWidth={2.5}
            fill="none"
          />
        </Svg>
      </View>
    );
  if (id === 'frameio')
    return (
      <View style={[s.base, s.purple]}>
        <Svg width={25} height={25} viewBox="0 0 25 25">
          <Path
            d="M5 7v12M10 5v10M15 8v6M20 10v2"
            stroke="#FFFFFF"
            strokeWidth={2}
            strokeLinecap="round"
          />
        </Svg>
      </View>
    );
  return (
    <View style={[s.base, id === 'notion' ? s.notion : s.wide]}>
      <Text style={id === 'notion' ? s.n : s.w}>
        {id === 'notion' ? 'N' : 'W'}
      </Text>
    </View>
  );
}
const s = StyleSheet.create({
  base: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  dark: { backgroundColor: '#10272B' },
  purple: { backgroundColor: '#7952FF' },
  wide: { backgroundColor: '#F0ECFF' },
  notion: {
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#222222',
    width: 29,
    height: 30,
    marginHorizontal: 2.5,
  },
  n: {
    fontFamily: 'Georgia',
    fontSize: 25,
    fontWeight: '700',
    color: '#141414',
    lineHeight: 29,
  },
  w: { color: '#392086', fontSize: 22, fontWeight: '700' },
});
