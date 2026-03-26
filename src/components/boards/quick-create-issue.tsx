"use client";

import { useState, useRef } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { createIssue } from "@/server/actions/issue";

interface QuickCreateIssueProps {
  statusId: string;
  projectId: string;
  projectPrefix: string;
}

export function QuickCreateIssue({
  statusId,
  projectId,
  projectPrefix,
}: QuickCreateIssueProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit() {
    if (!title.trim()) return;

    setIsCreating(true);
    try {
      const result = await createIssue({
        title: title.trim(),
        projectId,
        statusId,
        type: "TASK",
        priority: "MEDIUM",
      });

      if (result.success) {
        toast.success(`Issue ${result.data.issue.key} created.`);
        setTitle("");
        inputRef.current?.focus();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Failed to create issue.");
    } finally {
      setIsCreating(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === "Escape") {
      setIsOpen(false);
      setTitle("");
    }
  }

  if (!isOpen) {
    return (
      <button
        data-testid="quick-add-trigger"
        onClick={() => {
          setIsOpen(true);
          setTimeout(() => inputRef.current?.focus(), 0);
        }}
        className="flex w-full items-center gap-1.5 rounded-b-lg px-3 py-2 text-xs text-muted-foreground transition hover:bg-accent"
      >
        <Plus className="h-3.5 w-3.5" />
        Add issue
      </button>
    );
  }

  return (
    <div className="px-2 pb-2">
      <input
        ref={inputRef}
        data-testid="quick-add-input"
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          if (!title.trim()) setIsOpen(false);
        }}
        disabled={isCreating}
        aria-label="Create new issue"
        placeholder="Issue title..."
        className="w-full rounded-lg border bg-card px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
        autoFocus
      />
    </div>
  );
}
