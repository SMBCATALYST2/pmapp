"use client";

import { useParams, usePathname } from "next/navigation";
import Link from "next/link";
import {
  FolderKanban,
  Settings,
  Users,
  Star,
  ChevronDown,
  Plus,
  LayoutDashboard,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSidebarData } from "@/hooks/use-sidebar-data";
import { UserMenu } from "./user-menu";

export function AppSidebar() {
  const params = useParams<{ workspaceSlug: string; projectKey: string }>();
  const pathname = usePathname();
  const workspaceSlug = params.workspaceSlug;

  const { workspaces, projects, currentWorkspace, isLoading } = useSidebarData(workspaceSlug);

  const starredProjects = projects.filter((p) => p.isFavorite);
  const allProjects = projects;

  return (
    <aside className="flex h-full w-[260px] shrink-0 flex-col border-r bg-[hsl(var(--sidebar-background))]">
      {/* Workspace Switcher */}
      <div className="border-b p-3">
        <button
          data-testid="workspace-switcher"
          className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-sm font-medium hover:bg-accent"
        >
          <span className="truncate">{currentWorkspace?.name || "Workspace"}</span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
        {/* Dropdown would go here with workspace list */}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3" aria-label="Sidebar navigation">
        <ul className="space-y-1">
          <li>
            <Link
              href={workspaceSlug ? `/${workspaceSlug}/projects` : "/"}
              className={cn(
                "flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium transition hover:bg-accent",
                pathname.endsWith("/projects") && "bg-accent"
              )}
            >
              <LayoutDashboard className="h-4 w-4" />
              Projects
            </Link>
          </li>
          <li>
            <Link
              href={workspaceSlug ? `/${workspaceSlug}/settings` : "#"}
              className={cn(
                "flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium transition hover:bg-accent",
                pathname.includes("/settings") && !pathname.includes("/projects") && "bg-accent"
              )}
            >
              <Settings className="h-4 w-4" />
              Settings
            </Link>
          </li>
          <li>
            <Link
              href={workspaceSlug ? `/${workspaceSlug}/settings/members` : "#"}
              className={cn(
                "flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium transition hover:bg-accent",
                pathname.includes("/settings/members") && "bg-accent"
              )}
            >
              <Users className="h-4 w-4" />
              Members
            </Link>
          </li>
        </ul>

        {/* Starred Projects */}
        {starredProjects.length > 0 && (
          <div className="mt-6">
            <h3 className="mb-1 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Starred
            </h3>
            <ul className="space-y-0.5" data-testid="sidebar-starred-projects">
              {starredProjects.map((project) => (
                <li key={project.id}>
                  <Link
                    href={`/${workspaceSlug}/${project.prefix}/board`}
                    data-testid={`sidebar-project-${project.prefix}`}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition hover:bg-accent",
                      params.projectKey === project.prefix && "bg-accent font-medium"
                    )}
                  >
                    <span
                      className="flex h-5 w-5 items-center justify-center rounded text-xs"
                      style={{ backgroundColor: project.color || "#6366F1", color: "#fff" }}
                    >
                      {project.icon || project.name.charAt(0)}
                    </span>
                    <span className="truncate">{project.name}</span>
                    <Star className="ml-auto h-3 w-3 fill-yellow-400 text-yellow-400" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* All Projects */}
        <div className="mt-6">
          <div className="mb-1 flex items-center justify-between px-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Projects
            </h3>
            <Link
              href={workspaceSlug ? `/${workspaceSlug}/projects/new` : "#"}
              className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label="Create new project"
            >
              <Plus className="h-3.5 w-3.5" />
            </Link>
          </div>
          <ul className="space-y-0.5" data-testid="sidebar-projects-list">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <li key={i} className="h-7 animate-pulse rounded-lg bg-muted" />
              ))
            ) : allProjects.length === 0 ? (
              <li className="px-2 py-1 text-xs text-muted-foreground">No projects</li>
            ) : (
              allProjects.map((project) => (
                <li key={project.id}>
                  <Link
                    href={`/${workspaceSlug}/${project.prefix}/board`}
                    data-testid={`sidebar-project-${project.prefix}`}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition hover:bg-accent",
                      params.projectKey === project.prefix && "bg-accent font-medium"
                    )}
                  >
                    <span
                      className="flex h-5 w-5 items-center justify-center rounded text-xs"
                      style={{ backgroundColor: project.color || "#6366F1", color: "#fff" }}
                    >
                      {project.icon || project.name.charAt(0)}
                    </span>
                    <span className="truncate">{project.name}</span>
                  </Link>
                </li>
              ))
            )}
          </ul>
        </div>
      </nav>

      {/* User Menu at bottom */}
      <div className="border-t p-3">
        <UserMenu />
      </div>
    </aside>
  );
}
