"use client";

import { useRouter, useParams } from "next/navigation";
import { CreateProjectForm } from "@/components/projects/create-project-form";

export default function NewProjectPage() {
  const router = useRouter();
  const params = useParams<{ workspaceSlug: string }>();

  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <div className="w-full max-w-lg">
        <h1 className="text-2xl font-bold">Create a new project</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Projects help you organize and track issues.
        </p>
        <div className="mt-6">
          <CreateProjectForm
            workspaceSlug={params.workspaceSlug}
            onSuccess={(projectKey) => {
              router.push(`/${params.workspaceSlug}/${projectKey}/board`);
            }}
          />
        </div>
      </div>
    </div>
  );
}
