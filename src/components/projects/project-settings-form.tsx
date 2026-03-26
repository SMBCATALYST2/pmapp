"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { updateProject } from "@/server/actions/project";
import { PROJECT_COLORS } from "@/lib/constants";
import { useState } from "react";
import type { Project } from "@/types";

const updateProjectSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long"),
  description: z.string().max(1000, "Description too long").optional(),
});
type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

interface ProjectSettingsFormProps {
  project: Project;
  workspaceSlug: string;
}

export function ProjectSettingsForm({ project, workspaceSlug }: ProjectSettingsFormProps) {
  const router = useRouter();
  const [selectedColor, setSelectedColor] = useState(project.color || PROJECT_COLORS[0]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<UpdateProjectInput>({
    resolver: zodResolver(updateProjectSchema),
    defaultValues: {
      name: project.name,
      description: project.description || "",
    },
  });

  async function onSubmit(data: UpdateProjectInput) {
    const result = await updateProject({
      id: project.id,
      ...data,
      color: selectedColor,
    });

    if (result.success) {
      toast.success("Project settings updated.");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="mb-1.5 block text-sm font-medium">Project name</label>
        <input
          type="text"
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          {...register("name")}
        />
        {errors.name && (
          <p className="mt-1 text-xs text-destructive">{errors.name.message}</p>
        )}
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium">Project key</label>
        <input
          type="text"
          value={project.prefix}
          disabled
          className="w-full rounded-lg border bg-muted px-3 py-2 text-sm text-muted-foreground"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Project key cannot be changed because it is used in issue identifiers.
        </p>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium">Description</label>
        <textarea
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          rows={3}
          {...register("description")}
        />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium">Color</label>
        <div className="flex flex-wrap gap-2">
          {PROJECT_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => setSelectedColor(color)}
              className={`h-7 w-7 rounded-full transition ${
                selectedColor === color ? "ring-2 ring-primary ring-offset-2" : ""
              }`}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition hover:bg-primary/90 disabled:opacity-50"
      >
        {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
        Save changes
      </button>
    </form>
  );
}
