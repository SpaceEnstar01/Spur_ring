import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { SvgXml } from 'react-native-svg';
import boards from './artboards.json';
import { paper, s } from './ui';

export type BoardName = keyof typeof boards;
export type Control = {
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  press: () => void;
};
export function area(
  label: string,
  x: number,
  y: number,
  width: number,
  height: number,
  press: () => void,
): Control {
  return { label, x, y, width, height, press };
}
export type Band = { start: number; end: number };
// Coordinates are in the 390-point source artboard. Collapsed cards and their controls move together.
function offset(y: number, bands: Band[]) {
  return bands.reduce((sum, b) => sum + (y >= b.end ? b.end - b.start : 0), 0);
}
function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
type Props = {
  page: BoardName;
  controls: Control[];
  labels?: Record<string, string>;
  hidden?: Band[];
  children?: React.ReactNode;
  shapeProps?: Record<string, Record<string, string>>;
};
export function Artboard({
  page,
  controls,
  labels,
  hidden = [],
  children,
  shapeProps,
}: Props) {
  const windowWidth = useWindowDimensions().width;
  const [viewportWidth, setViewportWidth] = useState(0);
  const width = viewportWidth || windowWidth;
  const scale = width / 390;
  const board = boards[page];
  const height = board.height - offset(board.height, hidden);
  const xml = useMemo(() => {
    let drawing = board.drawing;
    if (labels) {
      drawing = drawing.replace(
        /<text([^>]*)>([^<>]*)<\/text>/g,
        (node, attrs: string, value: string) => {
          const x = attrs.match(/ x="([^"]+)"/)?.[1];
          const y = attrs.match(/ y="([^"]+)"/)?.[1];
          const updated = labels['@' + x + ',' + y] ?? labels[value];
          return updated === undefined
            ? node
            : '<text' + attrs + '>' + escapeXml(updated) + '</text>';
        },
      );
    }
    if (shapeProps) {
      drawing = drawing.replace(/<rect [^>]*\/>/g, node => {
        const x = node.match(/ x="([^"]+)"/)?.[1];
        const y = node.match(/ y="([^"]+)"/)?.[1];
        const changes = shapeProps[x + ',' + y];
        if (!changes) return node;
        for (const [attr, val] of Object.entries(changes))
          node = node.replace(
            new RegExp(' ' + attr + '="[^"]*"'),
            ' ' + attr + '="' + val + '"',
          );
        return node;
      });
    }
    let start = 0;
    const ranges = [...hidden, { start: board.height, end: board.height }];
    const slices = ranges.map((b, i) => {
      const h = b.start - start,
        y = start;
      start = b.end;
      return h <= 0
        ? ''
        : `<defs><clipPath id="slice${i}"><rect x="0" y="${y}" width="390" height="${h}"/></clipPath></defs><g transform="translate(0 ${-offset(
            y,
            hidden,
          )})"><g clip-path="url(#slice${i})">${drawing}</g></g>`;
    });
    const body = hidden.length ? slices.join('') : drawing;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 390 ${height}">${body}</svg>`;
  }, [board, height, labels, hidden, shapeProps]);
  return (
    <ScrollView
      key={page}
      onLayout={event => setViewportWidth(event.nativeEvent.layout.width)}
      style={s.root}
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="never"
    >
      <View style={{ width, height: height * scale, backgroundColor: paper }}>
        <View pointerEvents="none">
          <SvgXml xml={xml} width={width} height={height * scale} />
        </View>
        {controls
          .filter(
            c =>
              !hidden.some(
                b =>
                  c.y + c.height / 2 >= b.start && c.y + c.height / 2 < b.end,
              ),
          )
          .map((c, i) => (
            <Pressable
              key={c.label + i}
              accessibilityRole="button"
              accessibilityLabel={c.label}
              onPress={c.press}
              style={({ pressed }) => ({
                position: 'absolute',
                left: c.x * scale,
                top: (c.y - offset(c.y, hidden)) * scale,
                width: c.width * scale,
                height: c.height * scale,
                borderRadius: 10,
                backgroundColor: pressed ? '#50674018' : 'transparent',
              })}
            />
          ))}
      </View>
      {children}
    </ScrollView>
  );
}
