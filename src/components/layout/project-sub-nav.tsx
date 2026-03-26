"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface ProjectSubNavProps {
  workspaceSlug: string;
  projectKey: string;
}

const tabs = [
  { key: "board", label: "Board", testId: "project-nav-board" },
  { key: "list", label: "List", testId: "project-nav-list" },
  { key: "settings", label: "Settings", testId: "project-nav-settings" },
] as const;

export function ProjectSubNav({ workspaceSlug, projectKey }: ProjectSubNavProps) {
  const pathname = usePathname();
  const basePath = `/${workspaceSlug}/${projectKey}`;

  function isActive(key: string) {
    if (key === "board") {
      return pathname === basePath || pathname === `${basePath}/board`;
    }
    return pathname.startsWith(`${basePath}/${key}`);
  }

  return (
    <nav role="navigation" aria-label="Project views" className="mt-3 flex gap-1">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={`${basePath}/${tab.key}`}
          data-testid={tab.testId}
          className={cn(
            "relative px-3 py-2 text-sm font-medium transition",
            isActive(tab.key)
              ? "text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {tab.label}
          {isActive(tab.key) && (
            <span className="absolute inset-x-0 bottom-0 h-0.5 bg-primary" />
          )}
        </Link>
      ))}
    </nav>
  );
}
