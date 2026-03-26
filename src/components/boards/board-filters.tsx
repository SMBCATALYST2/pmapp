"use client";

import { useState } from "react";
import { Filter, X } from "lucide-react";
import type { MemberWithUser } from "@/types";
import { PRIORITY_CONFIG, ISSUE_TYPE_CONFIG } from "@/lib/constants";
import { UserAvatar } from "@/components/shared/user-avatar";

interface BoardFiltersProps {
  members: MemberWithUser[];
  labels: { id: string; name: string; color: string }[];
  filterAssignee: string[];
  filterPriority: string[];
  filterType: string[];
  filterLabel: string[];
  onFilterAssignee: (ids: string[]) => void;
  onFilterPriority: (ids: string[]) => void;
  onFilterType: (ids: string[]) => void;
  onFilterLabel: (ids: string[]) => void;
  onClearAll: () => void;
}

export function BoardFilters({
  members,
  labels,
  filterAssignee,
  filterPriority,
  filterType,
  filterLabel,
  onFilterAssignee,
  onFilterPriority,
  onFilterType,
  onFilterLabel,
  onClearAll,
}: BoardFiltersProps) {
  const [openFilter, setOpenFilter] = useState<string | null>(null);
  const hasActiveFilters =
    filterAssignee.length > 0 ||
    filterPriority.length > 0 ||
    filterType.length > 0 ||
    filterLabel.length > 0;

  function toggleFilter(name: string) {
    setOpenFilter((prev) => (prev === name ? null : name));
  }

  function toggleItem(current: string[], id: string, setter: (ids: string[]) => void) {
    if (current.includes(id)) {
      setter(current.filter((i) => i !== id));
    } else {
      setter([...current, id]);
    }
  }

  return (
    <div data-testid="filter-bar" className="flex flex-wrap items-center gap-2">
      <Filter className="h-4 w-4 text-muted-foreground" />

      {/* Assignee Filter */}
      <div className="relative">
        <button
          data-testid="filter-assignee"
          onClick={() => toggleFilter("assignee")}
          className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium transition hover:bg-accent ${
            filterAssignee.length > 0 ? "border-primary bg-primary/5 text-primary" : ""
          }`}
        >
          Assignee
          {filterAssignee.length > 0 && (
            <span className="rounded-full bg-primary px-1 text-[10px] text-primary-foreground">
              {filterAssignee.length}
            </span>
          )}
        </button>
        {openFilter === "assignee" && (
          <div data-testid="filter-assignee-popover" className="absolute left-0 top-full z-50 mt-1 w-56 rounded-lg border bg-card p-2 shadow-lg">
            {members.map((m) => (
              <label key={m.userId} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent">
                <input
                  type="checkbox"
                  checked={filterAssignee.includes(m.userId)}
                  onChange={() => toggleItem(filterAssignee, m.userId, onFilterAssignee)}
                  className="rounded"
                />
                <UserAvatar name={m.user.name} image={m.user.image} size="sm" />
                <span className="truncate">{m.user.name || m.user.email}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Priority Filter */}
      <div className="relative">
        <button
          data-testid="filter-priority"
          onClick={() => toggleFilter("priority")}
          className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium transition hover:bg-accent ${
            filterPriority.length > 0 ? "border-primary bg-primary/5 text-primary" : ""
          }`}
        >
          Priority
          {filterPriority.length > 0 && (
            <span className="rounded-full bg-primary px-1 text-[10px] text-primary-foreground">
              {filterPriority.length}
            </span>
          )}
        </button>
        {openFilter === "priority" && (
          <div data-testid="filter-priority-popover" className="absolute left-0 top-full z-50 mt-1 w-48 rounded-lg border bg-card p-2 shadow-lg">
            {Object.entries(PRIORITY_CONFIG).map(([key, config]) => (
              <label key={key} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent">
                <input
                  type="checkbox"
                  checked={filterPriority.includes(key)}
                  onChange={() => toggleItem(filterPriority, key, onFilterPriority)}
                  className="rounded"
                />
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: config.color }} />
                <span>{config.label}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Type Filter */}
      <div className="relative">
        <button
          data-testid="filter-type"
          onClick={() => toggleFilter("type")}
          className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium transition hover:bg-accent ${
            filterType.length > 0 ? "border-primary bg-primary/5 text-primary" : ""
          }`}
        >
          Type
          {filterType.length > 0 && (
            <span className="rounded-full bg-primary px-1 text-[10px] text-primary-foreground">
              {filterType.length}
            </span>
          )}
        </button>
        {openFilter === "type" && (
          <div className="absolute left-0 top-full z-50 mt-1 w-48 rounded-lg border bg-card p-2 shadow-lg">
            {Object.entries(ISSUE_TYPE_CONFIG).map(([key, config]) => (
              <label key={key} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent">
                <input
                  type="checkbox"
                  checked={filterType.includes(key)}
                  onChange={() => toggleItem(filterType, key, onFilterType)}
                  className="rounded"
                />
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: config.color }} />
                <span>{config.label}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Label Filter */}
      <div className="relative">
        <button
          data-testid="filter-label"
          onClick={() => toggleFilter("label")}
          className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium transition hover:bg-accent ${
            filterLabel.length > 0 ? "border-primary bg-primary/5 text-primary" : ""
          }`}
        >
          Label
          {filterLabel.length > 0 && (
            <span className="rounded-full bg-primary px-1 text-[10px] text-primary-foreground">
              {filterLabel.length}
            </span>
          )}
        </button>
        {openFilter === "label" && (
          <div className="absolute left-0 top-full z-50 mt-1 w-56 rounded-lg border bg-card p-2 shadow-lg">
            {labels.map((label) => (
              <label key={label.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent">
                <input
                  type="checkbox"
                  checked={filterLabel.includes(label.id)}
                  onChange={() => toggleItem(filterLabel, label.id, onFilterLabel)}
                  className="rounded"
                />
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: label.color }} />
                <span className="truncate">{label.name}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Active filter chips */}
      {hasActiveFilters && (
        <>
          {filterAssignee.map((id) => {
            const member = members.find((m) => m.userId === id);
            return (
              <span
                key={`a-${id}`}
                data-testid="active-filter-chip"
                className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
              >
                {member?.user.name || "Unknown"}
                <button
                  onClick={() => onFilterAssignee(filterAssignee.filter((i) => i !== id))}
                  aria-label="Remove assignee filter"
                  className="ml-0.5 hover:text-primary/70"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            );
          })}
          <button
            data-testid="clear-all-filters"
            onClick={onClearAll}
            className="text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            Clear all
          </button>
        </>
      )}
    </div>
  );
}
