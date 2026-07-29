"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  flexRender,
  ColumnDef,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { getAllUsers, AdminUserRow, unbanUserAction } from "@/actions/admin.actions";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, MoreVertical, Ban, UserCircle, Unlock } from "lucide-react";
import { useSession } from "next-auth/react";
import { BanUserDialog } from "./ban-user-dialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

function UserActionsCell({ row, targetIsOwner }: { row: any; targetIsOwner: boolean }) {
  const [showBanDialog, setShowBanDialog] = useState(false);
  const router = useRouter();
  const queryClient = useQueryClient();

  const unbanMutation = useMutation({
    mutationFn: async () => {
      await unbanUserAction(row.original.id);
    },
    onSuccess: () => {
      toast.success("User unbanned successfully");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to unban user");
    },
  });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 h-8 w-8 p-0 text-neutral-400 hover:text-neutral-200 hover:bg-[#1a1a1a]">
          <span className="sr-only">Open menu</span>
          <MoreVertical className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[160px] bg-[#1a1a1a] border-[#2b2b2b] text-neutral-200">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-[#2b2b2b]" />
            
            <DropdownMenuItem 
              onClick={() => router.push(`/${row.original.username || row.original.name}`)}
              className="cursor-pointer"
            >
              <UserCircle className="mr-2 h-4 w-4" /> Profile
            </DropdownMenuItem>
            
            {!targetIsOwner && (
              row.original.is_banned ? (
                <DropdownMenuItem 
                  onClick={() => unbanMutation.mutate()} 
                  className="text-green-400 focus:text-green-300 focus:bg-green-500/10 cursor-pointer"
                  disabled={unbanMutation.isPending}
                >
                  <Unlock className="mr-2 h-4 w-4" /> 
                  {unbanMutation.isPending ? "Unbanning..." : "Unban"}
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem 
                  onClick={() => setShowBanDialog(true)} 
                  className="text-red-400 focus:text-red-300 focus:bg-red-500/10 cursor-pointer"
                >
                  <Ban className="mr-2 h-4 w-4" /> 
                  Ban User
                </DropdownMenuItem>
              )
            )}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <BanUserDialog 
        userId={row.original.id} 
        username={row.original.username || row.original.name || "User"}
        isBanned={row.original.is_banned} 
        open={showBanDialog}
        onOpenChange={setShowBanDialog}
      />
    </>
  );
}

export function UsersClient({ initialData }: { initialData: AdminUserRow[] }) {
  const { data: users } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => getAllUsers(),
    initialData,
    refetchInterval: 15000,
  });

  const { data: session } = useSession();
  const [globalFilter, setGlobalFilter] = useState("");

  const columns = useMemo<ColumnDef<AdminUserRow>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            aria-label="Select all"
            className="border-neutral-600 data-[state=checked]:bg-neutral-100 data-[state=checked]:text-neutral-900"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Select row"
            className="border-neutral-600 data-[state=checked]:bg-neutral-100 data-[state=checked]:text-neutral-900"
          />
        ),
        enableSorting: false,
        enableHiding: false,
      },
      {
        accessorFn: (row) => `${row.name || ""} ${row.username || ""} ${row.email}`,
        id: "user",
        header: "Pengguna",
        cell: ({ row }) => {
          const name = row.original.name || row.original.username || "Unknown";
          const initials = name.substring(0, 2).toUpperCase();
          const avatarUrl = row.original.image || row.original.avatar_url;
          return (
            <div className="flex items-center gap-3">
              <Avatar className="h-9 w-9 border border-[#2b2b2b]">
                <AvatarImage src={avatarUrl || ""} alt={name} />
                <AvatarFallback className="bg-neutral-800 text-xs text-neutral-300">{initials}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <span className="font-medium text-neutral-200">{name}</span>
                <span className="text-xs text-neutral-500">{row.original.email}</span>
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "role",
        header: "Role",
        cell: (info) => {
          const role = info.getValue() as string;
          return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${role === 'owner' ? 'bg-neutral-200 text-neutral-900' : 'bg-neutral-800/80 text-neutral-300 border border-neutral-700/50'}`}>{role === 'user' ? 'Member' : role}</span>;
        },
      },
      {
        accessorKey: "is_verified",
        header: "Status",
        cell: (info) => {
          const isVerified = info.getValue() as boolean;
          return isVerified ? (
             <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium bg-green-500/10 text-green-500 border border-green-500/20">
               <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
               Verified
             </span>
          ) : (
             <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium bg-transparent text-neutral-400 border border-neutral-700/50">
               Unverified
             </span>
          );
        },
      },
      {
        accessorKey: "createdAt",
        header: "Terdaftar Pada",
        cell: (info) => {
          const val = info.getValue() as string;
          if (!val) return "-";
          const date = new Date(val);
          return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
        },
      },
      {
        id: "actions",
        header: "",
        cell: function ActionsCellWrapper({ row }) {
          const [mounted, setMounted] = useState(false);
          useEffect(() => setMounted(true), []);
          if (!mounted) return null;
          const isOwner = (session?.user as any)?.role === "owner" || (session?.user as any)?.Role === "owner";
          const targetIsOwner = row.original.role === "owner";
          
          if (!isOwner) return null;

          return <UserActionsCell row={row} targetIsOwner={targetIsOwner} />;
        },
      },
    ],
    [session]
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
    estimateSize: () => 64,
    overscan: 10,
  });

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            className="pl-9 bg-[#1c1c1c] border-[#2b2b2b] focus-visible:ring-1 focus-visible:ring-neutral-700"
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
          />
        </div>
      </div>

      <div 
        className="rounded-xl border border-[#2b2b2b] bg-[#141414] overflow-hidden"
      >
        <div className="h-[600px] overflow-auto relative" ref={parentRef}>
          <Table>
            <TableHeader className="sticky top-0 bg-[#1c1c1c] z-10 border-b border-[#2b2b2b]">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="border-none hover:bg-transparent">
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} className="h-12 text-xs font-semibold tracking-wider text-neutral-400 uppercase">
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
                  <TableCell colSpan={columns.length} className="h-24 text-center text-neutral-400">
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
                        className="border-b border-[#2b2b2b] hover:bg-[#1a1a1a] transition-colors"
                      >
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id} className="py-4 font-medium text-neutral-200">
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
    </div>
  );
}
