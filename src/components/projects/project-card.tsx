import Link from "next/link";
import { Star } from "lucide-react";
import type { ProjectWithCounts } from "@/types";

interface ProjectCardProps {
  project: ProjectWithCounts;
  workspaceSlug: string;
}

export function ProjectCard({ project, workspaceSlug }: ProjectCardProps) {
  return (
    <Link
      href={`/${workspaceSlug}/${project.prefix}/board`}
      className="group rounded-xl border bg-card p-4 shadow-sm transition hover:shadow-md"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-lg text-lg"
            style={{ backgroundColor: project.color || "#6366F1", color: "#fff" }}
          >
            {project.icon || project.name.charAt(0)}
          </span>
          <div>
            <h3 className="font-semibold">{project.name}</h3>
            <span className="text-xs text-muted-foreground">{project.prefix}</span>
          </div>
        </div>
        {project.isFavorite && (
          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
        )}
      </div>

      {project.description && (
        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
          {project.description}
        </p>
      )}

      <div className="mt-3 text-xs text-muted-foreground">
        {project._count.issues} issue{project._count.issues !== 1 ? "s" : ""}
      </div>
    </Link>
  );
}
