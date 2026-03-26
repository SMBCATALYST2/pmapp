"use client";

import { useParams, usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

export function Breadcrumbs() {
  const params = useParams<{
    workspaceSlug: string;
    projectKey: string;
    issueKey: string;
  }>();
  const pathname = usePathname();

  const crumbs: { label: string; href: string }[] = [];

  if (params.workspaceSlug) {
    crumbs.push({
      label: params.workspaceSlug,
      href: `/${params.workspaceSlug}/projects`,
    });
  }

  if (params.projectKey) {
    crumbs.push({
      label: params.projectKey,
      href: `/${params.workspaceSlug}/${params.projectKey}/board`,
    });
  }

  if (params.issueKey) {
    crumbs.push({
      label: params.issueKey,
      href: `/${params.workspaceSlug}/${params.projectKey}/issues/${params.issueKey}`,
    });
  }

  // Append segment names like "settings", "members", "board", "list"
  if (!params.issueKey) {
    const segments = pathname.split("/").filter(Boolean);
    const last = segments[segments.length - 1];
    if (last && !["projects", params.workspaceSlug, params.projectKey].includes(last)) {
      crumbs.push({ label: last, href: pathname });
    }
  }

  return (
    <nav data-testid="breadcrumb" aria-label="Breadcrumb" className="flex items-center gap-1 text-sm">
      {crumbs.map((crumb, i) => (
        <span key={crumb.href} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
          {i === crumbs.length - 1 ? (
            <span className="font-medium capitalize">{crumb.label}</span>
          ) : (
            <Link
              href={crumb.href}
              className="capitalize text-muted-foreground transition hover:text-foreground"
            >
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
