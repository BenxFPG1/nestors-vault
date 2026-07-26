"use client";

import { useState } from "react";

export default function Copy({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex items-stretch gap-2">
      <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded-xl border border-line bg-surface px-4 py-3 font-mono text-xs text-chalk">
        {value}
      </code>
      <button
        onClick={copy}
        className="shrink-0 rounded-xl border border-line px-4 text-xs transition hover:border-accent hover:text-accent"
      >
        {copied ? "gekopieerd" : "kopieer"}
      </button>
    </div>
  );
}
