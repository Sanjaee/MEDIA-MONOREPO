"use client";

import { useState, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  flexRender,
  ColumnDef,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { getAllUsers, AdminUserRow } from "@/actions/admin.actions";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

export function UsersClient({ initialData }: { initialData: AdminUserRow[] }) {
  const { data: users } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => getAllUsers(),
    initialData,
    refetchInterval: 15000,
  });

  const [globalFilter, setGlobalFilter] = useState("");

  const columns = useMemo<ColumnDef<AdminUserRow>[]>(
    () => [
      {
        accessorKey: "id",
        header: "ID",
        cell: (info) => <span className="font-medium">{(info.getValue() as string).substring(0, 8)}...</span>,
      },
      {
        accessorFn: (row) => `${row.name || ""} ${row.username || ""} ${row.email}`,
        id: "user",
        header: "User",
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium">{row.original.name || row.original.username || "Unknown"}</span>
            <span className="text-xs text-muted-foreground">{row.original.email}</span>
          </div>
        ),
      },
      {
        accessorKey: "role",
        header: "Role",
        cell: (info) => {
          const role = info.getValue() as string;
          return <Badge variant={role === "owner" ? "default" : role === "mod" ? "secondary" : "outline"} className="capitalize">{role}</Badge>;
        },
      },
      {
        accessorKey: "is_verified",
        header: "Status",
        cell: (info) => {
          const isVerified = info.getValue() as boolean;
          return isVerified ? (
             <Badge className="bg-green-500 hover:bg-green-600">Verified</Badge>
          ) : (
             <Badge variant="outline">Unverified</Badge>
          );
        },
      },
      {
        accessorKey: "is_banned",
        header: "Banned",
        cell: (info) => {
          const isBanned = info.getValue() as boolean;
          return isBanned ? (
             <Badge variant="destructive">Banned</Badge>
          ) : (
             <span className="text-muted-foreground text-sm">No</span>
          );
        },
      },
      {
        accessorKey: "createdAt",
        header: "Joined",
        cell: (info) => {
          const val = info.getValue() as string;
          if (!val) return "-";
          return new Date(val).toLocaleDateString();
        },
      },
    ],
    []
  );

  const table = useReactTable({
    data: users || [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onGlobalFilterChange: setGlobalFilter,
    state: {
      globalFilter,
    },
  });

  const { rows } = table.getRowModel();
  
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 50,
    overscan: 10,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            className="pl-8"
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
          />
        </div>
      </div>

      <div 
        className="rounded-md border bg-card h-[600px] overflow-auto relative"
        ref={parentRef}
      >
        <Table>
          <TableHeader className="sticky top-0 bg-card z-10 shadow-sm">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No users found.
                </TableCell>
              </TableRow>
            ) : (
              <>
                {virtualizer.getVirtualItems().length > 0 && virtualizer.getVirtualItems()[0].start > 0 && (
                  <tr style={{ height: `${virtualizer.getVirtualItems()[0].start}px` }} />
                )}
                
                {virtualizer.getVirtualItems().map((virtualRow) => {
                  const row = rows[virtualRow.index];
                  return (
                    <TableRow
                      key={row.id}
                      data-index={virtualRow.index}
                      ref={virtualizer.measureElement}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })}
                
                {virtualizer.getVirtualItems().length > 0 && virtualizer.getTotalSize() - virtualizer.getVirtualItems()[virtualizer.getVirtualItems().length - 1].end > 0 && (
                  <tr style={{ height: `${virtualizer.getTotalSize() - virtualizer.getVirtualItems()[virtualizer.getVirtualItems().length - 1].end}px` }} />
                )}
              </>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
