"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { Search, Loader2 } from "lucide-react";
import { useCommandMenuStore } from "@/stores/command-menu-store";
import { IssueTypeIcon } from "@/components/issues/issue-type-icon";
import { IssueStatusBadge } from "@/components/issues/issue-status-badge";
import { UserAvatar } from "@/components/shared/user-avatar";
import type { SearchResult } from "@/types/api";

export function CommandMenu() {
  const router = useRouter();
  const params = useParams<{ workspaceSlug: string }>();
  const { isOpen, close, toggle } = useCommandMenuStore();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Keyboard shortcut: Ctrl+K / Cmd+K
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        toggle();
      }
      if (e.key === "Escape" && isOpen) {
        close();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, toggle, close]);

  // Debounced search
  useEffect(() => {
    if (!query || query.length < 2) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search?workspace=${encodeURIComponent(params.workspaceSlug || "")}&q=${encodeURIComponent(query)}`
        );
        if (res.ok) {
          const data = await res.json();
          setResults(data.results || []);
        }
      } catch {
        // Silently fail
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, params.workspaceSlug]);

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      setResults([]);
      setSelectedIndex(0);
    }
  }, [isOpen]);

  const navigateToResult = useCallback(
    (result: SearchResult) => {
      close();
      router.push(
        `/${params.workspaceSlug}/${result.projectPrefix}/issues/${result.key}`
      );
    },
    [close, router, params.workspaceSlug]
  );

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && results[selectedIndex]) {
      e.preventDefault();
      navigateToResult(results[selectedIndex]!);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={close} />
      <div
        role="dialog"
        aria-modal="true"
        data-testid="command-palette"
        className="fixed left-1/2 top-[15%] z-50 w-full max-w-lg -translate-x-1/2 rounded-xl border bg-card shadow-2xl"
      >
        {/* Search Input */}
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <Search className="h-5 w-5 text-muted-foreground" />
          <input
            data-testid="command-search-input"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            aria-label="Search issues"
            placeholder="Search issues..."
            className="flex-1 bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
            autoFocus
          />
          {isSearching && (
            <Loader2 data-testid="search-loading" className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
          <kbd className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div role="listbox" className="max-h-80 overflow-y-auto p-1">
          {query.length >= 2 && !isSearching && results.length === 0 && (
            <div data-testid="search-no-results" className="px-4 py-8 text-center text-sm text-muted-foreground">
              No issues found for &quot;{query}&quot;
            </div>
          )}

          {results.map((result, index) => (
            <button
              key={result.id}
              role="option"
              aria-selected={index === selectedIndex}
              data-testid={`search-result-${result.key}`}
              onClick={() => navigateToResult(result)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition ${
                index === selectedIndex ? "bg-accent" : "hover:bg-accent/50"
              }`}
            >
              <IssueTypeIcon type="TASK" className="h-4 w-4 shrink-0" />
              <span className="shrink-0 font-mono text-xs text-muted-foreground">
                {result.key}
              </span>
              <span className="min-w-0 flex-1 truncate">{result.title}</span>
              <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                {result.projectName}
              </span>
              <IssueStatusBadge name={result.status.name} color={result.status.color} />
              {result.assignee && (
                <UserAvatar
                  name={result.assignee.name}
                  image={result.assignee.image}
                  size="sm"
                />
              )}
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t px-4 py-2 text-[10px] text-muted-foreground">
          <span>Type to search issues across all projects</span>
          <div className="flex gap-1">
            <kbd className="rounded bg-muted px-1 py-0.5">Enter</kbd>
            <span>to select</span>
          </div>
        </div>
      </div>
    </div>
  );
}
