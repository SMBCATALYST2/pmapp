"use client";

import { useState, useRef } from "react";
import { toast } from "sonner";
import { updateIssue } from "@/server/actions/issue-actions";

interface IssueTitleProps {
  issueId: string;
  initialTitle: string;
  updatedAt: Date;
}

export function IssueTitle({ issueId, initialTitle, updatedAt }: IssueTitleProps) {
  const [title, setTitle] = useState(initialTitle);
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function saveTitle() {
    if (title.trim() === initialTitle) {
      setIsEditing(false);
      return;
    }

    if (!title.trim()) {
      setTitle(initialTitle);
      setIsEditing(false);
      return;
    }

    setIsEditing(false);
    const result = await updateIssue({
      id: issueId,
      title: title.trim(),
      updatedAt,
    });

    if (!result.success) {
      setTitle(initialTitle);
      toast.error("Failed to update title.");
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      inputRef.current?.blur();
    }
    if (e.key === "Escape") {
      setTitle(initialTitle);
      setIsEditing(false);
    }
  }

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        data-testid="issue-detail-title"
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={saveTitle}
        onKeyDown={handleKeyDown}
        aria-label="Issue title"
        className="w-full border-none bg-transparent text-2xl font-bold focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded"
        autoFocus
      />
    );
  }

  return (
    <h2
      data-testid="issue-detail-title"
      onClick={() => setIsEditing(true)}
      className="cursor-pointer text-2xl font-bold hover:bg-accent/50 rounded px-1 -mx-1 py-0.5 transition"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter") setIsEditing(true);
      }}
    >
      {title}
    </h2>
  );
}
