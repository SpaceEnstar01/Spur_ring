export type ResultBlock =
  | { type: "heading"; text: string }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "paragraph"; text: string };

function isTableLine(line: string) {
  const text = line.trim();
  return (text.match(/\|/g) || []).length >= 2 && !text.startsWith("#");
}

function isSeparator(line: string) {
  return /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(line.trim());
}

function cells(line: string) {
  let text = line.trim();
  if (text.startsWith("|")) text = text.slice(1);
  if (text.endsWith("|")) text = text.slice(0, -1);
  return text.split("|").map((cell) => cell.trim());
}

export function resultBlocks(source: string): ResultBlock[] {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: ResultBlock[] = [];
  const paragraph: string[] = [];
  const flush = () => {
    const text = paragraph.join("\n").trim();
    paragraph.length = 0;
    if (text) blocks.push({ type: "paragraph", text });
  };
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();
    if (!trimmed) {
      flush();
      index += 1;
      continue;
    }
    const heading = trimmed.match(/^#{1,4}\s+(.+)$/);
    if (heading) {
      flush();
      blocks.push({ type: "heading", text: heading[1].trim() });
      index += 1;
      continue;
    }
    if (isTableLine(trimmed)) {
      flush();
      const table: string[][] = [];
      while (index < lines.length && isTableLine(lines[index].trim())) {
        if (!isSeparator(lines[index])) table.push(cells(lines[index]));
        index += 1;
      }
      const width = Math.max(...table.map((row) => row.length));
      const [headers = [], ...rows] = table.map((row) =>
        Array.from({ length: width }, (_, cell) => row[cell] || "")
      );
      if (headers.length) blocks.push({ type: "table", headers, rows });
      continue;
    }
    if (/^\s*(?:[-*]|\d+\.)\s+/.test(line)) {
      flush();
      const ordered = /^\s*\d+\.\s+/.test(line);
      const items: string[] = [];
      while (index < lines.length && /^\s*(?:[-*]|\d+\.)\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\s*(?:[-*]|\d+\.)\s+/, ""));
        index += 1;
      }
      blocks.push({ type: "list", ordered, items });
      continue;
    }
    paragraph.push(line);
    index += 1;
  }
  flush();
  return blocks;
}
