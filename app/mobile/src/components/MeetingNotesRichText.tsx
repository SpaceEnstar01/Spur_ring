import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme/colors';

type Block =
  | { kind: 'h1'; text: string }
  | { kind: 'h2'; text: string }
  | { kind: 'meta'; text: string }
  | { kind: 'quote'; text: string }
  | { kind: 'bullet'; text: string }
  | { kind: 'numbered'; text: string }
  | { kind: 'tableHeader'; cells: string[] }
  | { kind: 'tableRow'; cells: string[] }
  | { kind: 'body'; text: string }
  | { kind: 'spacer' };

/** Render meeting notes with clear hierarchy via size/color. */
export function MeetingNotesRichText({ markdown }: { markdown: string }) {
  const blocks = parseMeetingNotes(markdown);
  if (blocks.length === 0) {
    return <Text style={styles.body}> </Text>;
  }

  return (
    <View style={styles.wrap}>
      {blocks.map((block, index) => {
        const key = `${block.kind}-${index}`;
        switch (block.kind) {
          case 'h1':
            return (
              <Text key={key} style={styles.h1}>
                {block.text}
              </Text>
            );
          case 'h2':
            return (
              <Text key={key} style={styles.h2}>
                {block.text}
              </Text>
            );
          case 'meta':
            return (
              <Text key={key} style={styles.meta}>
                {block.text}
              </Text>
            );
          case 'quote':
            return (
              <View key={key} style={styles.quoteBox}>
                <Text style={styles.quote}>{block.text}</Text>
              </View>
            );
          case 'bullet':
            return (
              <Text key={key} style={styles.bullet}>
                <Text style={styles.bulletMark}>• </Text>
                {block.text}
              </Text>
            );
          case 'numbered':
            return (
              <Text key={key} style={styles.bullet}>
                {block.text}
              </Text>
            );
          case 'tableHeader':
            return (
              <Text key={key} style={styles.tableHeader}>
                {block.cells.join('  ·  ')}
              </Text>
            );
          case 'tableRow':
            return (
              <Text key={key} style={styles.tableRow}>
                {block.cells.join('  ·  ')}
              </Text>
            );
          case 'spacer':
            return <View key={key} style={styles.spacer} />;
          default:
            return (
              <Text key={key} style={styles.body}>
                {block.text}
              </Text>
            );
        }
      })}
    </View>
  );
}

function parseMeetingNotes(markdown: string): Block[] {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();
    if (!trimmed) {
      if (blocks.length && blocks[blocks.length - 1].kind !== 'spacer') {
        blocks.push({ kind: 'spacer' });
      }
      continue;
    }

    if (/^\|?\s*-{3,}/.test(trimmed)) continue;

    const h1 = trimmed.match(/^#\s+(.+)$/);
    if (h1) {
      blocks.push({ kind: 'h1', text: cleanInline(h1[1]) });
      continue;
    }
    const h2 = trimmed.match(/^##\s+(.+)$/);
    if (h2) {
      blocks.push({ kind: 'h2', text: cleanInline(h2[1]) });
      continue;
    }
    const h3 = trimmed.match(/^###\s+(.+)$/);
    if (h3) {
      blocks.push({ kind: 'h2', text: cleanInline(h3[1]) });
      continue;
    }

    if (/^\*\*[^*]+\*\*/.test(trimmed) || /^(时间|类型|参与人|Time|Type|Attendees)\s*[:：]/.test(trimmed)) {
      blocks.push({ kind: 'meta', text: cleanInline(trimmed) });
      continue;
    }

    if (trimmed.startsWith('>')) {
      blocks.push({ kind: 'quote', text: cleanInline(trimmed.replace(/^>\s?/, '')) });
      continue;
    }

    if (/^[-*+]\s+/.test(trimmed)) {
      blocks.push({ kind: 'bullet', text: cleanInline(trimmed.replace(/^[-*+]\s+/, '')) });
      continue;
    }

    if (/^\d+[\.、]\s+/.test(trimmed)) {
      blocks.push({ kind: 'numbered', text: cleanInline(trimmed) });
      continue;
    }

    if (trimmed.includes('|')) {
      const cells = trimmed
        .split('|')
        .map((cell) => cleanInline(cell.trim()))
        .filter(Boolean);
      if (cells.length >= 2) {
        const isHeader =
          /事项|负责人|期限|Item|Owner|Due/i.test(cells.join(' ')) ||
          blocks[blocks.length - 1]?.kind === 'h2';
        blocks.push({
          kind: isHeader && !blocks.some((b) => b.kind === 'tableHeader') ? 'tableHeader' : 'tableRow',
          cells
        });
        continue;
      }
    }

    blocks.push({ kind: 'body', text: cleanInline(trimmed) });
  }

  return blocks;
}

function cleanInline(value: string) {
  return value
    .replace(/\*{1,3}([^*\n]+)\*{1,3}/g, '$1')
    .replace(/_{1,3}([^_\n]+)_{1,3}/g, '$1')
    .replace(/`{1,3}/g, '')
    .trim();
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  h1: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 30,
    marginBottom: 4
  },
  h2: {
    color: '#1a5f8f',
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 24,
    marginTop: 12,
    marginBottom: 2
  },
  meta: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '600'
  },
  body: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 24
  },
  bullet: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 24,
    paddingLeft: 2
  },
  bulletMark: {
    color: '#1a5f8f',
    fontWeight: '800'
  },
  quoteBox: {
    marginTop: 4,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#f0f6fb',
    borderLeftWidth: 3,
    borderLeftColor: '#1a5f8f'
  },
  quote: {
    color: '#244a66',
    fontSize: 14,
    lineHeight: 22
  },
  tableHeader: {
    color: '#1a5f8f',
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 20,
    marginTop: 4
  },
  tableRow: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 22
  },
  spacer: { height: 6 }
});
