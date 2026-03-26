"use client";

import { useParams } from "next/navigation";
import { Search } from "lucide-react";
import { Breadcrumbs } from "./breadcrumbs";
import { useCommandMenuStore } from "@/stores/command-menu-store";

export function Header() {
  const params = useParams<{ workspaceSlug: string; projectKey: string }>();
  const openCommandMenu = useCommandMenuStore((s) => s.open);

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b px-4">
      <Breadcrumbs />

      <div className="flex items-center gap-2">
        <button
          data-testid="header-search-trigger"
          onClick={openCommandMenu}
          className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-1.5 text-sm text-muted-foreground transition hover:bg-muted"
        >
          <Search className="h-4 w-4" />
          <span className="hidden sm:inline">Search issues...</span>
          <kbd className="hidden rounded bg-muted px-1.5 py-0.5 text-xs font-medium sm:inline">
            Ctrl+K
          </kbd>
        </button>
      </div>
    </header>
  );
}
