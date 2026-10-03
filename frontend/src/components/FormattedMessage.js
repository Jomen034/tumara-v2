import React from "react";
import clsx from "clsx";

/**
 * Helper untuk mengurai format inline: **bold**, *italic*, `code`
 */
function renderInline(text) {
  if (!text) return null;

  // Split by markdown inline syntax
  // Tokenize regex: **bold**, *italic*, `code`
  const regex = /(\*\*.*?\*\*|\*.*?\*|`.*?`)/g;
  const parts = text.split(regex);

  return parts.map((part, index) => {
    if (!part) return null;

    // **bold**
    if (part.startsWith("**") && part.endsWith("**") && part.length >= 4) {
      const inner = part.slice(2, -2);
      return (
        <strong key={index} className="font-semibold text-tprimary">
          {inner}
        </strong>
      );
    }

    // `code`
    if (part.startsWith("`") && part.endsWith("`") && part.length >= 2) {
      const inner = part.slice(1, -1);
      return (
        <code
          key={index}
          className="px-1.5 py-0.5 rounded-md bg-elevated text-brand font-mono text-xs border border-borderc"
        >
          {inner}
        </code>
      );
    }

    // *italic*
    if (part.startsWith("*") && part.endsWith("*") && part.length >= 2) {
      const inner = part.slice(1, -1);
      return (
        <em key={index} className="italic text-tsecondary">
          {inner}
        </em>
      );
    }

    // Plain text
    return <span key={index}>{part}</span>;
  });
}

/**
 * FormattedMessage Component
 * Mengompilasi respon Tumara AI dari teks markdown mentah menjadi tampilan UI yang terstruktur, rapi, dan mudah dibaca.
 */
export default function FormattedMessage({ content, className }) {
  if (!content) return null;

  const lines = content.split("\n");
  const elements = [];

  let idx = 0;
  while (idx < lines.length) {
    const rawLine = lines[idx];
    const trimmed = rawLine.trim();

    // 1. Empty line
    if (!trimmed) {
      elements.push(<div key={`sp-${idx}`} className="h-2" />);
      idx++;
      continue;
    }

    // 2. Horizontal divider `---`
    if (trimmed === "---" || trimmed === "***" || trimmed === "___") {
      elements.push(
        <div key={`hr-${idx}`} className="my-3 border-t border-borderc/70" />
      );
      idx++;
      continue;
    }

    // 3. Headings `#`, `##`, `###`, `####`
    if (trimmed.startsWith("### ")) {
      const headingText = trimmed.replace(/^###\s+/, "");
      elements.push(
        <h4
          key={`h3-${idx}`}
          className="text-sm sm:text-base font-bold text-tprimary mt-3 mb-1.5 flex items-center gap-1.5 border-b border-borderc/40 pb-1"
        >
          {renderInline(headingText)}
        </h4>
      );
      idx++;
      continue;
    }

    if (trimmed.startsWith("## ")) {
      const headingText = trimmed.replace(/^##\s+/, "");
      elements.push(
        <h3
          key={`h2-${idx}`}
          className="text-base sm:text-lg font-bold text-tprimary mt-4 mb-2 flex items-center gap-2 border-b border-borderc/60 pb-1.5"
        >
          {renderInline(headingText)}
        </h3>
      );
      idx++;
      continue;
    }

    if (trimmed.startsWith("# ")) {
      const headingText = trimmed.replace(/^#\s+/, "");
      elements.push(
        <h2
          key={`h1-${idx}`}
          className="text-lg sm:text-xl font-extrabold font-head text-tprimary mt-4 mb-2.5"
        >
          {renderInline(headingText)}
        </h2>
      );
      idx++;
      continue;
    }

    // 4. Blockquotes `> ...`
    if (trimmed.startsWith("> ")) {
      const quoteText = trimmed.replace(/^>\s+/, "");
      elements.push(
        <div
          key={`bq-${idx}`}
          className="p-3 my-2 rounded-xl bg-brand/10 border-l-4 border-brand text-xs sm:text-sm text-tprimary italic"
        >
          {renderInline(quoteText)}
        </div>
      );
      idx++;
      continue;
    }

    // 5. Bullet Lists (`* `, `- `) or Sub-bullets (`  * `, `  - `)
    const isSubBullet =
      rawLine.startsWith("  * ") ||
      rawLine.startsWith("    * ") ||
      rawLine.startsWith("  - ") ||
      rawLine.startsWith("    - ");
    const isMainBullet =
      trimmed.startsWith("* ") || trimmed.startsWith("- ") || trimmed.startsWith("• ");

    if (isSubBullet || isMainBullet) {
      const bulletText = trimmed.replace(/^(\*|-|•)\s+/, "");
      elements.push(
        <div
          key={`li-${idx}`}
          className={clsx(
            "flex items-start gap-2 my-1 leading-relaxed",
            isSubBullet
              ? "ml-5 text-xs text-tsecondary"
              : "text-xs sm:text-sm text-tprimary"
          )}
        >
          <span
            className={clsx(
              "shrink-0 select-none font-bold mt-0.5",
              isSubBullet ? "text-cyan text-[10px]" : "text-brand text-xs"
            )}
          >
            {isSubBullet ? "◦" : "•"}
          </span>
          <div className="flex-1 min-w-0">{renderInline(bulletText)}</div>
        </div>
      );
      idx++;
      continue;
    }

    // 6. Numbered Lists (`1. `, `2. `, etc.)
    const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (numMatch) {
      const [, num, numText] = numMatch;
      elements.push(
        <div
          key={`num-${idx}`}
          className="flex items-start gap-2.5 my-1.5 text-xs sm:text-sm text-tprimary leading-relaxed"
        >
          <span className="px-1.5 py-0.5 rounded bg-elevated text-brand font-mono text-[11px] font-bold shrink-0 mt-0.5 select-none">
            {num}.
          </span>
          <div className="flex-1 min-w-0">{renderInline(numText)}</div>
        </div>
      );
      idx++;
      continue;
    }

    // 7. Regular paragraph
    elements.push(
      <p
        key={`p-${idx}`}
        className="my-1.5 text-xs sm:text-sm text-tprimary leading-relaxed"
      >
        {renderInline(trimmed)}
      </p>
    );
    idx++;
  }

  return (
    <div className={clsx("space-y-0.5 text-left text-tprimary", className)}>
      {elements}
    </div>
  );
}
