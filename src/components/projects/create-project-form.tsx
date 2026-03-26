"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Check, X } from "lucide-react";
import { toast } from "sonner";
import { createProject } from "@/server/actions/project";
import { generateProjectKey } from "@/lib/utils";
import { PROJECT_COLORS } from "@/lib/constants";

const createProjectSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long"),
  prefix: z
    .string()
    .min(2, "Key must be 2-10 characters")
    .max(10, "Key must be 2-10 characters")
    .regex(/^[A-Z]+$/, "Key must be uppercase letters only"),
  description: z.string().max(1000, "Description too long").optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
});
type CreateProjectInput = z.infer<typeof createProjectSchema>;

interface CreateProjectFormProps {
  workspaceSlug: string;
  onSuccess: (projectKey: string) => void;
}

export function CreateProjectForm({ workspaceSlug, onSuccess }: CreateProjectFormProps) {
  const [keyStatus, setKeyStatus] = useState<"idle" | "checking" | "available" | "error">("idle");
  const [keyError, setKeyError] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState(PROJECT_COLORS[0]);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CreateProjectInput>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: { name: "", prefix: "", description: "", color: PROJECT_COLORS[0] },
  });

  const watchName = watch("name");
  const watchPrefix = watch("prefix");

  // Auto-generate key from name
  useEffect(() => {
    if (watchName) {
      const key = generateProjectKey(watchName);
      setValue("prefix", key, { shouldValidate: true });
    }
  }, [watchName, setValue]);

  // Debounced key availability check
  useEffect(() => {
    if (!watchPrefix || watchPrefix.length < 2) {
      setKeyStatus("idle");
      return;
    }

    setKeyStatus("checking");
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/projects/check-key?workspace=${encodeURIComponent(workspaceSlug)}&key=${encodeURIComponent(watchPrefix)}`
        );
        const data = await res.json();
        if (data.available) {
          setKeyStatus("available");
          setKeyError(null);
        } else {
          setKeyStatus("error");
          setKeyError(data.reason || "This key is already used by another project.");
        }
      } catch {
        setKeyStatus("error");
        setKeyError("Could not verify availability.");
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [watchPrefix, workspaceSlug]);

  async function onSubmit(data: CreateProjectInput) {
    const result = await createProject({
      ...data,
      color: selectedColor,
      workspaceId: "", // Will be resolved server-side from workspace slug
    });

    if (result.success) {
      toast.success("Project created!");
      onSuccess(data.prefix);
    } else {
      toast.error(result.error);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label htmlFor="project-name" className="mb-1.5 block text-sm font-medium">
          Project name
        </label>
        <input
          id="project-name"
          data-testid="project-name-input"
          type="text"
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="My Project"
          {...register("name")}
        />
        {errors.name && (
          <p className="mt-1 text-xs text-destructive" role="alert">{errors.name.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="project-key" className="mb-1.5 block text-sm font-medium">
          Project key
        </label>
        <div className="relative">
          <input
            id="project-key"
            data-testid="project-key-input"
            type="text"
            className="w-full rounded-lg border bg-background px-3 py-2 pr-8 text-sm uppercase focus:outline-none focus:ring-2 focus:ring-ring"
            {...register("prefix")}
            onChange={(e) => {
              setValue("prefix", e.target.value.toUpperCase(), { shouldValidate: true });
            }}
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            {keyStatus === "checking" && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            {keyStatus === "available" && <Check data-testid="key-status-available" className="h-4 w-4 text-green-500" />}
            {keyStatus === "error" && <X data-testid="key-status-error" className="h-4 w-4 text-red-500" />}
          </div>
        </div>
        {(errors.prefix || keyError) && (
          <p data-testid="project-key-error" className="mt-1 text-xs text-destructive" role="alert">
            {errors.prefix?.message || keyError}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="project-desc" className="mb-1.5 block text-sm font-medium">
          Description <span className="text-muted-foreground">(optional)</span>
        </label>
        <textarea
          id="project-desc"
          data-testid="project-description-input"
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          rows={3}
          placeholder="What is this project about?"
          {...register("description")}
        />
      </div>

      {/* Color Picker */}
      <div>
        <label className="mb-1.5 block text-sm font-medium">Color</label>
        <div data-testid="project-color-picker" className="flex flex-wrap gap-2">
          {PROJECT_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => {
                setSelectedColor(color);
                setValue("color", color);
              }}
              className={`h-7 w-7 rounded-full transition ${
                selectedColor === color ? "ring-2 ring-primary ring-offset-2" : ""
              }`}
              style={{ backgroundColor: color }}
              aria-label={`Select color ${color}`}
            />
          ))}
        </div>
      </div>

      <button
        type="submit"
        data-testid="create-project-submit"
        disabled={isSubmitting || keyStatus === "checking"}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow transition hover:bg-primary/90 disabled:opacity-50"
      >
        {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
        Create project
      </button>
    </form>
  );
}
