"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type SortingState,
  type ColumnDef,
  type VisibilityState,
} from "@tanstack/react-table";
import { ArrowUpDown, ArrowUp, ArrowDown, Columns3, List } from "lucide-react";
import type { IssueListItem, MemberWithUser } from "@/types";
import { IssueTypeIcon } from "@/components/issues/issue-type-icon";
import { IssuePriorityIcon } from "@/components/issues/issue-priority-icon";
import { IssueStatusBadge } from "@/components/issues/issue-status-badge";
import { IssueLabelBadge } from "@/components/issues/issue-label-badge";
import { UserAvatar } from "@/components/shared/user-avatar";
import { EmptyState } from "@/components/shared/empty-state";
import { BoardFilters } from "@/components/boards/board-filters";
import { format } from "date-fns";

interface IssuesDataTableProps {
  issues: IssueListItem[];
  members: MemberWithUser[];
  labels: { id: string; name: string; color: string }[];
  statuses: { id: string; name: string; color: string; category: string }[];
  workspaceSlug: string;
  projectKey: string;
}

export function IssuesDataTable({
  issues,
  members,
  labels,
  statuses,
  workspaceSlug,
  projectKey,
}: IssuesDataTableProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "createdAt", desc: true },
  ]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [showColumnsPopover, setShowColumnsPopover] = useState(false);

  // Filters
  const [filterAssignee, setFilterAssignee] = useState<string[]>([]);
  const [filterPriority, setFilterPriority] = useState<string[]>([]);
  const [filterType, setFilterType] = useState<string[]>([]);
  const [filterLabel, setFilterLabel] = useState<string[]>([]);

  const filteredIssues = useMemo(() => {
    return issues.filter((issue) => {
      if (filterAssignee.length > 0 && !filterAssignee.includes(issue.assignee?.id || "")) return false;
      if (filterPriority.length > 0 && !filterPriority.includes(issue.priority)) return false;
      if (filterType.length > 0 && !filterType.includes(issue.type)) return false;
      if (filterLabel.length > 0 && !issue.labels.some((l) => filterLabel.includes(l.id))) return false;
      return true;
    });
  }, [issues, filterAssignee, filterPriority, filterType, filterLabel]);

  const columns: ColumnDef<IssueListItem>[] = useMemo(
    () => [
      {
        id: "type",
        header: "",
        cell: ({ row }) => <IssueTypeIcon type={row.original.type} />,
        size: 40,
        enableSorting: false,
      },
      {
        accessorKey: "key",
        header: "Key",
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">
            {row.original.key}
          </span>
        ),
        size: 100,
      },
      {
        accessorKey: "title",
        header: "Title",
        cell: ({ row }) => (
          <span className="line-clamp-1 font-medium">{row.original.title}</span>
        ),
      },
      {
        accessorKey: "status",
        header: ({ column }) => (
          <button
            data-testid="sort-status"
            onClick={() => column.toggleSorting()}
            className="flex items-center gap-1 hover:text-foreground"
          >
            Status
            <SortIcon column={column} />
          </button>
        ),
        cell: ({ row }) => (
          <IssueStatusBadge
            name={row.original.status.name}
            color={row.original.status.color}
          />
        ),
        sortingFn: (a, b) => {
          return a.original.status.name.localeCompare(b.original.status.name);
        },
      },
      {
        accessorKey: "priority",
        header: ({ column }) => (
          <button
            data-testid="sort-priority"
            onClick={() => column.toggleSorting()}
            className="flex items-center gap-1 hover:text-foreground"
          >
            Priority
            <SortIcon column={column} />
          </button>
        ),
        cell: ({ row }) => (
          <IssuePriorityIcon priority={row.original.priority} showLabel />
        ),
      },
      {
        accessorKey: "assignee",
        header: ({ column }) => (
          <button
            data-testid="sort-assignee"
            onClick={() => column.toggleSorting()}
            className="flex items-center gap-1 hover:text-foreground"
          >
            Assignee
            <SortIcon column={column} />
          </button>
        ),
        cell: ({ row }) =>
          row.original.assignee ? (
            <div className="flex items-center gap-2">
              <UserAvatar
                name={row.original.assignee.name}
                image={row.original.assignee.image}
                size="sm"
              />
              <span className="truncate text-sm">
                {row.original.assignee.name}
              </span>
            </div>
          ) : (
            <span className="text-sm text-muted-foreground">Unassigned</span>
          ),
        sortingFn: (a, b) => {
          const nameA = a.original.assignee?.name || "zzz";
          const nameB = b.original.assignee?.name || "zzz";
          return nameA.localeCompare(nameB);
        },
      },
      {
        id: "labels",
        header: "Labels",
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            {row.original.labels.slice(0, 2).map((label) => (
              <IssueLabelBadge key={label.id} name={label.name} color={label.color} />
            ))}
            {row.original.labels.length > 2 && (
              <span className="text-xs text-muted-foreground">
                +{row.original.labels.length - 2}
              </span>
            )}
          </div>
        ),
        enableSorting: false,
      },
      {
        accessorKey: "dueDate",
        header: "Due Date",
        cell: ({ row }) =>
          row.original.dueDate ? (
            <span className="text-sm text-muted-foreground">
              {format(new Date(row.original.dueDate), "MMM d, yyyy")}
            </span>
          ) : null,
      },
      {
        accessorKey: "createdAt",
        header: "Created",
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {format(new Date(row.original.createdAt), "MMM d, yyyy")}
          </span>
        ),
      },
    ],
    []
  );

  const table = useReactTable({
    data: filteredIssues,
    columns,
    state: { sorting, columnVisibility },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  if (issues.length === 0) {
    return (
      <EmptyState
        data-testid="empty-list-state"
        icon={List}
        heading="No issues yet"
        description="Create your first issue to get started"
        actionLabel="Create issue"
        actionHref={`/${workspaceSlug}/${projectKey}/board`}
      />
    );
  }

  return (
    <div>
      {/* Filters + Column Toggle */}
      <div className="mb-4 flex items-center justify-between">
        <BoardFilters
          members={members}
          labels={labels}
          filterAssignee={filterAssignee}
          filterPriority={filterPriority}
          filterType={filterType}
          filterLabel={filterLabel}
          onFilterAssignee={setFilterAssignee}
          onFilterPriority={setFilterPriority}
          onFilterType={setFilterType}
          onFilterLabel={setFilterLabel}
          onClearAll={() => {
            setFilterAssignee([]);
            setFilterPriority([]);
            setFilterType([]);
            setFilterLabel([]);
          }}
        />
        <div className="relative">
          <button
            data-testid="columns-toggle-button"
            onClick={() => setShowColumnsPopover(!showColumnsPopover)}
            className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium hover:bg-accent"
          >
            <Columns3 className="h-3.5 w-3.5" />
            Columns
          </button>
          {showColumnsPopover && (
            <div data-testid="columns-popover" className="absolute right-0 top-full z-50 mt-1 w-48 rounded-lg border bg-card p-2 shadow-lg">
              {table.getAllLeafColumns().map((column) => {
                if (column.id === "key" || column.id === "title") return null;
                return (
                  <label key={column.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent">
                    <input
                      type="checkbox"
                      checked={column.getIsVisible()}
                      onChange={column.getToggleVisibilityHandler()}
                      className="rounded"
                    />
                    <span className="capitalize">{column.id}</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border">
        <table data-testid="issue-list-table" className="w-full" aria-label="Issues list">
          <thead data-testid="table-header">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b bg-muted/50">
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground"
                    style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No issues match your filters
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  data-testid={`issue-row-${row.original.key}`}
                  className="cursor-pointer border-b transition hover:bg-muted/50"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-2.5 text-sm">
                      <Link
                        href={`/${workspaceSlug}/${projectKey}/issues/${row.original.key}`}
                        className="block"
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </Link>
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SortIcon({ column }: { column: any }) {
  if (!column.getIsSorted()) {
    return <ArrowUpDown className="h-3 w-3 opacity-50" />;
  }
  return column.getIsSorted() === "asc" ? (
    <ArrowUp className="h-3 w-3" />
  ) : (
    <ArrowDown className="h-3 w-3" />
  );
}
