"use client";

import { useMemo, useState } from "react";
import type {
  OutputKind,
  StructuredDeliverable,
  ZoneSpec,
} from "@/lib/templates/outputSchema";
import { renderStructuredDeliverable } from "@/lib/templates/renderOutput";

interface Props {
  text: string;
  zones: ZoneSpec[];
  streaming?: boolean;
}

/**
 * Renders the AI's output parsed into the template's zones. Re-parses on
 * every text update so partial streams still render coherently — sections
 * get filled in as the model writes them.
 *
 * Recovery case: when the model returns prose with no recognizable section
 * headings, the parser fills every zone with empty markdown and pushes the
 * text into `leftover`. We surface that with a warning banner and a raw
 * fallback view, with a toggle to flip back to the (mostly empty) structured
 * view.
 */
export function StructuredOutput({ text, zones, streaming }: Props) {
  const deliverable = useMemo<StructuredDeliverable>(
    () => renderStructuredDeliverable(text, zones),
    [text, zones],
  );
  const [showStructuredInRecovery, setShowStructuredInRecovery] = useState(false);

  const isRecoveryCase =
    text.trim().length > 0 &&
    deliverable.sections.every((s) => !s.markdown.trim()) &&
    deliverable.leftover.trim().length > 0;

  if (isRecoveryCase) {
    if (showStructuredInRecovery) {
      return <StructuredView deliverable={deliverable} zones={zones} streaming={streaming} />;
    }
    return (
      <RecoveryView
        leftover={deliverable.leftover}
        onToggle={() => setShowStructuredInRecovery(true)}
      />
    );
  }

  return <StructuredView deliverable={deliverable} zones={zones} streaming={streaming} />;
}

function RecoveryView({
  leftover,
  onToggle,
}: {
  leftover: string;
  onToggle: () => void;
}) {
  return (
    <div>
      <div
        role="status"
        className="rounded-lg border border-amber-300/60 bg-amber-50/40 dark:bg-amber-900/15
          px-3 py-2 text-[12px] mb-3 flex items-start justify-between gap-2"
      >
        <span className="text-amber-900 dark:text-amber-200">
          Model returned prose without section headings. Showing raw output below.
        </span>
        <button
          type="button"
          onClick={onToggle}
          className="shrink-0 text-[11px] font-medium text-amber-900 dark:text-amber-200
            hover:underline whitespace-nowrap"
        >
          Show structured
        </button>
      </div>
      <pre className="text-[12.5px] leading-relaxed text-[var(--ink)] whitespace-pre-wrap font-sans">
        {leftover}
      </pre>
    </div>
  );
}

function StructuredView({
  deliverable,
  zones,
  streaming,
}: {
  deliverable: StructuredDeliverable;
  zones: ZoneSpec[];
  streaming?: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      {deliverable.title && (
        <h3 className="text-[16px] font-semibold tracking-tight">
          {deliverable.title}
        </h3>
      )}
      {zones.map((z) => {
        const section = deliverable.sections.find((s) => s.zoneName === z.name);
        const empty = !section || !section.markdown.trim();
        return (
          <ZoneBlock
            key={z.name}
            zone={z}
            markdown={section?.markdown ?? ""}
            items={section?.items}
            rows={section?.rows}
            empty={empty}
            streaming={streaming}
          />
        );
      })}
      {deliverable.leftover && (
        <div className="mt-2 border-t border-[var(--border)] pt-3">
          <div className="text-[10.5px] uppercase tracking-wider font-semibold text-[var(--ink-faint)]">
            Other
          </div>
          <pre className="mt-1 text-[12px] font-mono whitespace-pre-wrap text-[var(--ink-dim)] leading-relaxed">
            {deliverable.leftover}
          </pre>
        </div>
      )}
    </div>
  );
}

function ZoneBlock({
  zone,
  markdown,
  items,
  rows,
  empty,
  streaming,
}: {
  zone: ZoneSpec;
  markdown: string;
  items?: string[];
  rows?: string[][];
  empty: boolean;
  streaming?: boolean;
}) {
  return (
    <section>
      <header className="flex items-baseline gap-2">
        <h4 className="text-[12.5px] font-semibold tracking-tight text-[var(--ink)]">
          {zone.name}
        </h4>
        <span className="text-[10.5px] text-[var(--ink-faint)] uppercase tracking-wider">
          {zone.outputKind}
        </span>
      </header>
      <div className="mt-1.5">
        {empty ? (
          <div className="text-[12.5px] text-[var(--ink-faint)] italic">
            {streaming ? "Writing…" : zone.placeholder}
          </div>
        ) : (
          <ZoneBody
            kind={zone.outputKind}
            markdown={markdown}
            items={items}
            rows={rows}
          />
        )}
      </div>
    </section>
  );
}

function ZoneBody({
  kind,
  markdown,
  items,
  rows,
}: {
  kind: OutputKind;
  markdown: string;
  items?: string[];
  rows?: string[][];
}) {
  if (kind === "checklist") {
    const list =
      items && items.length > 0
        ? items
        : markdown.split("\n").filter((l) => l.trim());
    return (
      <ul className="flex flex-col gap-1">
        {list.map((line, i) => (
          <li
            key={i}
            className="flex items-start gap-2 text-[12.5px] leading-snug"
          >
            <span
              aria-hidden
              className="mt-1 w-3 h-3 rounded-sm border border-[var(--border-strong)] shrink-0"
            />
            <span className="text-[var(--ink)]">
              {line.replace(/^[-*+\d.]+\s*/, "").trim()}
            </span>
          </li>
        ))}
      </ul>
    );
  }
  if (kind === "table" && rows && rows.length > 0) {
    const [header, ...body] = rows;
    return (
      <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
        <table className="w-full text-[12px]">
          {header && (
            <thead>
              <tr>
                {header.map((cell, i) => (
                  <th
                    key={i}
                    className="text-left font-semibold px-2.5 py-1.5 bg-[var(--glass)] border-b border-[var(--border)]"
                  >
                    {cell}
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {body.map((row, i) => (
              <tr
                key={i}
                className="border-b border-[var(--border)] last:border-b-0"
              >
                {row.map((cell, j) => (
                  <td key={j} className="px-2.5 py-1.5 align-top">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  if (kind === "heading") {
    return (
      <p className="text-[13px] leading-relaxed text-[var(--ink)] font-medium">
        {firstLine(markdown)}
      </p>
    );
  }
  if (kind === "timeline") {
    const lines = markdown
      .split("\n")
      .map((l) => l.replace(/^[-*+\d.]+\s*/, "").trim())
      .filter(Boolean);
    return (
      <ol className="relative ml-2 border-l border-[var(--border)] pl-4 flex flex-col gap-2">
        {lines.map((line, i) => (
          <li key={i} className="relative text-[12.5px] leading-snug">
            <span
              aria-hidden
              className="absolute -left-[19px] top-1.5 w-2 h-2 rounded-full
                bg-[var(--accent)] border-2 border-[var(--surface)]"
            />
            <span>{line}</span>
          </li>
        ))}
      </ol>
    );
  }
  // paragraph (default)
  return (
    <div className="text-[13px] leading-relaxed text-[var(--ink)] whitespace-pre-wrap">
      {markdown.trim()}
    </div>
  );
}

function firstLine(s: string): string {
  const i = s.indexOf("\n");
  return (i === -1 ? s : s.slice(0, i)).trim();
}
