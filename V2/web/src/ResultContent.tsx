import { Fragment, type ReactNode } from "react";
import { resultBlocks } from "./resultBlocks";
import { resourceUrl } from "./taskApi";

// React text nodes only: model output can never inject HTML or script URLs.
function inline(text: string): ReactNode[] {
  return text
    .split(
      /(`[^`\n]+`|\*\*[^*\n]+\*\*|\[[^\]]+\]\((?:https?:\/\/|sandbox:)[^\s)]+\)|https?:\/\/[^\s<>]+)/g
    )
    .map((part, index) => {
      if (part.startsWith("`") && part.endsWith("`"))
        return <code key={index}>{part.slice(1, -1)}</code>;
      if (part.startsWith("**") && part.endsWith("**"))
        return <strong key={index}>{part.slice(2, -2)}</strong>;
      const markdown = part.match(
        /^\[([^\]]+)\]\(((?:https?:\/\/|sandbox:)[^\s)]+)\)$/
      );
      if (markdown?.[2].startsWith("sandbox:"))
        return <span key={index}>{markdown[1]}</span>;
      const url =
        markdown?.[2] || (/^https?:\/\//.test(part) ? part : undefined);
      if (url) {
        const safe = resourceUrl(url);
        if (safe)
          return (
            <a key={index} href={safe} target="_blank" rel="noreferrer">
              {markdown?.[1] || part}
            </a>
          );
      }
      return <Fragment key={index}>{part}</Fragment>;
    });
}

export function ResultContent({ text }: { text: string }) {
  return (
    <div className="result-prose">
      {resultBlocks(text).map((block, index) => {
        if (block.type === "heading") return <h3 key={index}>{inline(block.text)}</h3>;
        if (block.type === "list") {
          const List = block.ordered ? "ol" : "ul";
          return (
            <List key={index}>
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{inline(item)}</li>
              ))}
            </List>
          );
        }
        if (block.type === "table") {
          return (
            <div className="result-table-wrap" key={index}>
              <table>
                <thead>
                  <tr>
                    {block.headers.map((header, cell) => (
                      <th key={cell}>{inline(header)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {row.map((value, cellIndex) => (
                        <td key={cellIndex}>{inline(value)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        return <p key={index}>{inline(block.text)}</p>;
      })}
    </div>
  );
}
