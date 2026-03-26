"use client";

import { useEffect, useState } from "react";
import type { SidebarProject, Workspace } from "@/types";

interface SidebarData {
  workspaces: Pick<Workspace, "id" | "name" | "slug">[];
  projects: SidebarProject[];
  currentWorkspace: Pick<Workspace, "id" | "name" | "slug"> | null;
  isLoading: boolean;
}

export function useSidebarData(workspaceSlug: string | undefined): SidebarData {
  const [data, setData] = useState<SidebarData>({
    workspaces: [],
    projects: [],
    currentWorkspace: null,
    isLoading: true,
  });

  useEffect(() => {
    if (!workspaceSlug) {
      setData((d) => ({ ...d, isLoading: false }));
      return;
    }

    async function fetchData() {
      try {
        const res = await fetch(`/api/sidebar?workspace=${encodeURIComponent(workspaceSlug!)}`);
        if (res.ok) {
          const json = await res.json();
          setData({
            workspaces: json.workspaces || [],
            projects: json.projects || [],
            currentWorkspace: json.currentWorkspace || null,
            isLoading: false,
          });
        } else {
          setData((d) => ({ ...d, isLoading: false }));
        }
      } catch {
        setData((d) => ({ ...d, isLoading: false }));
      }
    }

    fetchData();
  }, [workspaceSlug]);

  return data;
}
