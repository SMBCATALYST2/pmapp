"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { fetchIssueActivities } from "@/server/actions/fetch-actions";
import { UserAvatar } from "@/components/shared/user-avatar";
import { formatRelativeDate } from "@/lib/utils";
import type { ActivityWithActor, ActivityMetadata } from "@/types";

interface IssueActivityProps {
  issueId: string;
  workspaceId: string;
}

export function IssueActivity({ issueId, workspaceId }: IssueActivityProps) {
  const [activities, setActivities] = useState<ActivityWithActor[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchIssueActivities(issueId, workspaceId);
        setActivities(data);
      } catch {
        // Silently fail
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [issueId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No activity yet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {activities.map((activity) => (
        <div key={activity.id} data-testid="activity-entry" className="flex gap-3">
          <UserAvatar name={activity.actor.name} image={activity.actor.image} size="sm" />
          <div className="flex-1">
            <p className="text-sm">
              <span className="font-medium">{activity.actor.name}</span>{" "}
              <ActivityDescription metadata={activity.metadata as ActivityMetadata} type={activity.type} />
            </p>
            <p className="text-xs text-muted-foreground">
              {formatRelativeDate(activity.createdAt)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function ActivityDescription({
  metadata,
  type,
}: {
  metadata: ActivityMetadata;
  type: string;
}) {
  if ("type" in metadata) {
    if (metadata.type === "created") return <span>created this issue</span>;
    if (metadata.type === "deleted") return <span>deleted this issue</span>;
    if (metadata.type === "comment_added") return <span>added a comment</span>;
  }

  if ("field" in metadata) {
    const { field } = metadata;
    if (field === "status" && "from" in metadata) {
      return (
        <span>
          changed status from <strong>{metadata.from}</strong> to{" "}
          <strong>{metadata.to}</strong>
        </span>
      );
    }
    if (field === "priority" && "from" in metadata) {
      return (
        <span>
          changed priority from <strong>{metadata.from}</strong> to{" "}
          <strong>{metadata.to}</strong>
        </span>
      );
    }
    if (field === "assignee" && "from" in metadata) {
      return (
        <span>
          changed assignee from <strong>{metadata.from || "Unassigned"}</strong>{" "}
          to <strong>{metadata.to || "Unassigned"}</strong>
        </span>
      );
    }
    if (field === "title" && "from" in metadata) {
      return <span>changed the title</span>;
    }
    if (field === "description") {
      return <span>edited the description</span>;
    }
    if (field === "dueDate" && "from" in metadata) {
      if (!metadata.to) return <span>removed the due date</span>;
      return <span>set due date to <strong>{metadata.to}</strong></span>;
    }
    if (field === "type" && "from" in metadata) {
      return (
        <span>
          changed type from <strong>{metadata.from}</strong> to{" "}
          <strong>{metadata.to}</strong>
        </span>
      );
    }
    if (field === "labels" && "added" in metadata) {
      const parts: string[] = [];
      if (metadata.added.length > 0) parts.push(`added ${metadata.added.join(", ")}`);
      if (metadata.removed.length > 0) parts.push(`removed ${metadata.removed.join(", ")}`);
      return <span>{parts.join(" and ")} label(s)</span>;
    }
  }

  return <span>made a change</span>;
}
