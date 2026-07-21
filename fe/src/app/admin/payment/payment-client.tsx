"use client";

import Link from "next/link";
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
import { getAdminTransactionsAction } from "@/actions/admin.actions";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function PaymentClient({ initialData }: { initialData: any[] }) {
  const { data: transactions } = useQuery({
    queryKey: ["admin-transactions"],
    queryFn: () => getAdminTransactionsAction(),
    initialData,
    refetchInterval: 5000,
  });

  const [globalFilter, setGlobalFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100);
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "completed":
      case "success":
        return <Badge className="bg-green-500 hover:bg-green-600">Success</Badge>;
      case "pending":
      case "pending_payment":
        return <Badge variant="secondary">Pending</Badge>;
      case "error":
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      case "new":
        return <Badge variant="outline" className="border-blue-500 text-blue-500">New</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const filteredData = useMemo(() => {
    if (!transactions) return [];
    if (statusFilter === "all") return transactions;
    return transactions.filter((tx: any) => {
      const status = tx.status?.toLowerCase() || "";
      if (statusFilter === "success") return status === "success" || status === "completed";
      if (statusFilter === "pending") return status === "pending" || status === "pending_payment";
      if (statusFilter === "failed") return status === "failed" || status === "error";
      if (statusFilter === "new") return status === "new";
      return true;
    });
  }, [transactions, statusFilter]);

  const columns = useMemo<ColumnDef<any>[]>(
    () => [
      {
        accessorKey: "id",
        header: "ID",
        cell: (info) => <span className="font-medium">{(info.getValue() as string).substring(0, 8)}...</span>,
      },
      {
        accessorFn: (row) => `${row.username} ${row.email}`,
        id: "user",
        header: "User",
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span>{row.original.username}</span>
            <span className="text-xs text-muted-foreground">{row.original.email}</span>
          </div>
        ),
      },
      {
        accessorKey: "itemType",
        header: "Type",
        cell: (info) => <span className="capitalize">{info.getValue() as string}</span>,
      },
      {
        accessorKey: "amount",
        header: "Amount",
        cell: (info) => formatCurrency(info.getValue() as number),
      },
      {
        accessorKey: "paymentMethod",
        header: "Method",
        cell: (info) => <span className="uppercase">{info.getValue() as string}</span>,
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: (info) => getStatusBadge(info.getValue() as string),
      },
      {
        accessorKey: "createdAt",
        header: () => <div className="text-right">Date</div>,
        cell: (info) => (
          <div className="text-right whitespace-nowrap">
            {new Intl.DateTimeFormat("id-ID", {
              dateStyle: "medium",
              timeStyle: "short",
            }).format(new Date(info.getValue() as string))}
          </div>
        ),
      },
      {
        id: "actions",
        header: () => <div className="text-right">Action</div>,
        cell: ({ row }) => {
          const t = row.original;
          return (
            <div className="text-right" onClick={(e) => e.stopPropagation()}>
              <Dialog>
                <DialogTrigger className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3">
                  View Details
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Transaction Details</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                      <span className="font-semibold text-sm text-muted-foreground">ID:</span>
                      <span className="col-span-3 text-sm break-all">{t.id}</span>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <span className="font-semibold text-sm text-muted-foreground">User:</span>
                      <span className="col-span-3 text-sm">
                        {t.username} <br />
                        <span className="text-muted-foreground text-xs">{t.email}</span>
                      </span>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <span className="font-semibold text-sm text-muted-foreground">Type:</span>
                      <span className="col-span-3 text-sm capitalize">{t.itemType}</span>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <span className="font-semibold text-sm text-muted-foreground">Amount:</span>
                      <span className="col-span-3 text-sm font-bold text-green-500">
                        {formatCurrency(t.amount as number)}
                      </span>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <span className="font-semibold text-sm text-muted-foreground">Method:</span>
                      <span className="col-span-3 text-sm uppercase">{t.paymentMethod}</span>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <span className="font-semibold text-sm text-muted-foreground">Status:</span>
                      <span className="col-span-3">{getStatusBadge(t.status)}</span>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <span className="font-semibold text-sm text-muted-foreground">Date:</span>
                      <span className="col-span-3 text-sm">
                        {new Intl.DateTimeFormat("id-ID", {
                          dateStyle: "full",
                          timeStyle: "long",
                        }).format(new Date(t.createdAt))}
                      </span>
                    </div>
                    {t.cryptoOrderId && (
                      <div className="grid grid-cols-4 items-center gap-4">
                        <span className="font-semibold text-sm text-muted-foreground">Crypto Order ID:</span>
                        <span className="col-span-3 text-sm break-all">{t.cryptoOrderId}</span>
                      </div>
                    )}
                    {t.cryptoTxnId && (
                      <div className="grid grid-cols-4 items-center gap-4">
                        <span className="font-semibold text-sm text-muted-foreground">Crypto Txn ID:</span>
                        <span className="col-span-3 text-sm break-all">{t.cryptoTxnId}</span>
                      </div>
                    )}
                    {t.cryptoPendingAmount && (
                      <div className="grid grid-cols-4 items-center gap-4">
                        <span className="font-semibold text-sm text-muted-foreground">Pending Crypto:</span>
                        <span className="col-span-3 text-sm break-all">{t.cryptoPendingAmount}</span>
                      </div>
                    )}
                    {t.cryptoReceivedAmount && (
                      <div className="grid grid-cols-4 items-center gap-4">
                        <span className="font-semibold text-sm text-muted-foreground">Received Crypto:</span>
                        <span className="col-span-3 text-sm break-all">{t.cryptoReceivedAmount}</span>
                      </div>
                    )}
                    {t.invoiceUrl && (
                      <div className="grid grid-cols-4 items-center gap-4">
                        <span className="font-semibold text-sm text-muted-foreground">Invoice URL:</span>
                        <span className="col-span-3 text-sm break-all">
                          <a href={t.invoiceUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                            View Invoice
                          </a>
                        </span>
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          );
        },
      },
    ],
    []
  );

  const table = useReactTable({
    data: filteredData,
    columns,
    state: {
      globalFilter,
    },
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const { rows } = table.getRowModel();
  
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64, // Approximate row height
    overscan: 5,
  });

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <Tabs value={statusFilter} onValueChange={setStatusFilter} className="w-full sm:w-auto">
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="new">New</TabsTrigger>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="success">Success</TabsTrigger>
            <TabsTrigger value="failed">Failed</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search transactions..."
            value={globalFilter ?? ""}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      <div 
        ref={parentRef}
        className="rounded-md border max-h-[600px] overflow-auto relative"
      >
        <Table>
          <TableHeader className="sticky top-0 bg-background z-10 shadow-[0_1px_3px_0_rgba(0,0,0,0.1)]">
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
                <TableCell colSpan={columns.length} className="h-32 text-center">
                  No transactions found.
                </TableCell>
              </TableRow>
            ) : (
              <>
                {virtualItems.length > 0 && virtualItems[0].start > 0 && (
                  <tr style={{ height: `${virtualItems[0].start}px` }} />
                )}
                
                {virtualItems.map((virtualRow) => {
                  const row = rows[virtualRow.index];
                  return (
                    <TableRow
                      key={row.id}
                      data-state={row.getIsSelected() && "selected"}
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
                
                {virtualItems.length > 0 && virtualizer.getTotalSize() - virtualItems[virtualItems.length - 1].end > 0 && (
                  <tr style={{ height: `${virtualizer.getTotalSize() - virtualItems[virtualItems.length - 1].end}px` }} />
                )}
              </>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
