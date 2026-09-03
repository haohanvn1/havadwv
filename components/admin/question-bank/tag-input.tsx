"use client";

import { useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";

export function TagInput({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const [input, setInput] = useState("");

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      const value = input.trim();
      if (value && !tags.includes(value)) onChange([...tags, value]);
      setInput("");
    } else if (event.key === "Backspace" && input === "" && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  }

  return (
    <div className="border-input flex flex-wrap items-center gap-1.5 rounded-lg border px-2 py-1.5">
      {tags.map((tag) => (
        <span
          key={tag}
          className="bg-secondary text-secondary-foreground flex items-center gap-1 rounded-full px-2 py-0.5 text-xs"
        >
          {tag}
          <button
            type="button"
            onClick={() => onChange(tags.filter((t) => t !== tag))}
            aria-label={`Xoá tag ${tag}`}
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={tags.length === 0 ? "Nhập tag rồi Enter" : ""}
        className="min-w-24 flex-1 bg-transparent text-sm outline-none"
      />
    </div>
  );
}
