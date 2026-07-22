"use client";

import Link from "next/link";
import { useState, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  ColumnDef,
} from "@tanstack/react-table";
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
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  IconChevronLeft,
  IconChevronRight,
  IconChevronsLeft,
  IconChevronsRight,
} from "@tabler/icons-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";

const chartConfig = {
  role: {
    label: "Roles",
    color: "#10b981",
  },
  product: {
    label: "Products",
    color: "#3b82f6",
  },
  ad: {
    label: "Ad Slots",
    color: "#8b5cf6",
  },
} satisfies ChartConfig;

export function PaymentClient({ initialData }: { initialData: any[] }) {
  const { data: transactions } = useQuery({
    queryKey: ["admin-transactions"],
    queryFn: () => getAdminTransactionsAction(),
    initialData,
    refetchInterval: 5000,
  });



  const [globalFilter, setGlobalFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [timeRange, setTimeRange] = useState("90d");

  const stats = useMemo(() => {
    if (!transactions) return { total: 0, role: 0, product: 0, ad: 0, chartData: [] };
    let role = 0;
    let product = 0;
    let ad = 0;
    
    // Group by date for chart
    const dateMap = new Map();

    const sortedTx = [...transactions].reverse();
    const referenceDate = new Date();
    let daysToSubtract = 90;
    if (timeRange === "30d") daysToSubtract = 30;
    if (timeRange === "7d") daysToSubtract = 7;
    const startDate = new Date(referenceDate);
    startDate.setDate(startDate.getDate() - daysToSubtract);

    sortedTx.forEach((tx: any) => {
      const txDate = new Date(tx.createdAt);
      if (txDate < startDate) return;

      if (tx.status?.toLowerCase() === 'success' || tx.status?.toLowerCase() === 'completed') {
        const amount = tx.amount || 0;
        if (tx.itemType === 'role') role += amount;
        else if (tx.itemType === 'product') product += amount;
        else if (tx.itemType === 'ad') ad += amount;

        // Use ISO string "YYYY-MM-DD" for easier formatting
        const dateStr = txDate.toISOString().split('T')[0];
        if (!dateMap.has(dateStr)) {
          dateMap.set(dateStr, { name: dateStr, role: 0, product: 0, ad: 0 });
        }
        const dataPoint = dateMap.get(dateStr);
        if (tx.itemType === 'role') dataPoint.role += amount / 100;
        else if (tx.itemType === 'product') dataPoint.product += amount / 100;
        else if (tx.itemType === 'ad') dataPoint.ad += amount / 100;
      }
    });

    return {
      total: role + product + ad,
      role,
      product,
      ad,
      chartData: Array.from(dateMap.values())
    };
  }, [transactions, timeRange]);

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
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 50,
      },
    },
  });

  const { rows } = table.getRowModel();


  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.total)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Roles</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.role)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Products</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.product)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ad Slots</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.ad)}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="col-span-4 @container/card">
        <CardHeader>
          <CardTitle>Revenue Overview</CardTitle>
          <CardDescription>
            <span className="hidden @[540px]/card:block">
              Total revenue for the last {timeRange === "90d" ? "3 months" : timeRange === "30d" ? "30 days" : "7 days"}
            </span>
            <span className="@[540px]/card:hidden">
              {timeRange === "90d" ? "3 months" : timeRange === "30d" ? "30 days" : "7 days"}
            </span>
          </CardDescription>
          <CardAction>
            <ToggleGroup
              value={[timeRange]}
              onValueChange={(values) => {
                const newValue = values[values.length - 1];
                if (newValue) setTimeRange(newValue);
              }}
              variant="outline"
              className="hidden *:data-[slot=toggle-group-item]:px-4! @[767px]/card:flex"
            >
              <ToggleGroupItem value="90d">Last 3 months</ToggleGroupItem>
              <ToggleGroupItem value="30d">Last 30 days</ToggleGroupItem>
              <ToggleGroupItem value="7d">Last 7 days</ToggleGroupItem>
            </ToggleGroup>
            <Select
              value={timeRange}
              onValueChange={(value) => {
                if (value) setTimeRange(value);
              }}
            >
              <SelectTrigger
                className="flex w-40 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate @[767px]/card:hidden"
                size="sm"
                aria-label="Select time range"
              >
                <SelectValue placeholder="Last 3 months" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="90d" className="rounded-lg">
                  Last 3 months
                </SelectItem>
                <SelectItem value="30d" className="rounded-lg">
                  Last 30 days
                </SelectItem>
                <SelectItem value="7d" className="rounded-lg">
                  Last 7 days
                </SelectItem>
              </SelectContent>
            </Select>
          </CardAction>
        </CardHeader>
        <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
          <ChartContainer config={chartConfig} className="aspect-auto h-[300px] w-full">
            <AreaChart data={stats.chartData}>
              <defs>
                <linearGradient id="fillRole" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-role)" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="var(--color-role)" stopOpacity={0.1} />
                </linearGradient>
                <linearGradient id="fillProduct" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-product)" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="var(--color-product)" stopOpacity={0.1} />
                </linearGradient>
                <linearGradient id="fillAd" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-ad)" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="var(--color-ad)" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="#333" />
              <XAxis 
                dataKey="name" 
                stroke="#888888" 
                fontSize={12} 
                tickLine={false} 
                axisLine={false} 
                tickMargin={8}
                minTickGap={32}
                tickFormatter={(value) => {
                  const date = new Date(value);
                  return date.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  });
                }}
              />
              <YAxis
                stroke="#888888"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `$${value}`}
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    labelFormatter={(value) => {
                      return new Date(value).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      });
                    }}
                    indicator="dot"
                  />
                }
              />
              <Area dataKey="role" name="Roles" type="natural" fill="url(#fillRole)" stroke="var(--color-role)" stackId="a" />
              <Area dataKey="product" name="Products" type="natural" fill="url(#fillProduct)" stroke="var(--color-product)" stackId="a" />
              <Area dataKey="ad" name="Ad Slots" type="natural" fill="url(#fillAd)" stroke="var(--color-ad)" stackId="a" />
            </AreaChart>
          </ChartContainer>
        </CardContent>
      </Card>

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

      <div className="rounded-md border max-h-[600px] overflow-auto relative">
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
                  Tidak ada transaksi ditemukan.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
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
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col md:flex-row items-center justify-between gap-4 py-2">
        <div className="flex-1 text-sm text-muted-foreground text-center md:text-left">
          {table.getFilteredSelectedRowModel().rows.length} dari{" "}
          {table.getFilteredRowModel().rows.length} baris dipilih.
        </div>
        <div className="flex flex-col sm:flex-row w-full items-center gap-4 sm:gap-8 md:w-fit justify-center md:justify-end">
          <div className="flex items-center gap-2">
            <Label htmlFor="rows-per-page" className="text-sm font-medium whitespace-nowrap">
              Baris per halaman
            </Label>
            <Select
              value={`${table.getState().pagination.pageSize}`}
              onValueChange={(value) => {
                table.setPageSize(Number(value))
              }}
            >
              <SelectTrigger size="sm" className="w-20" id="rows-per-page">
                <SelectValue
                  placeholder={table.getState().pagination.pageSize}
                />
              </SelectTrigger>
              <SelectContent side="top">
                {[10, 20, 30, 40, 50, 100].map((pageSize) => (
                  <SelectItem key={pageSize} value={`${pageSize}`}>
                    {pageSize}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex w-fit items-center justify-center text-sm font-medium whitespace-nowrap">
            Halaman {table.getState().pagination.pageIndex + 1} dari{" "}
            {table.getPageCount() || 1}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="hidden h-8 w-8 p-0 lg:flex"
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
            >
              <span className="sr-only">Go to first page</span>
              <IconChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="size-8 p-0"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <span className="sr-only">Go to previous page</span>
              <IconChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="size-8 p-0"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <span className="sr-only">Go to next page</span>
              <IconChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="hidden size-8 p-0 lg:flex"
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
            >
              <span className="sr-only">Go to last page</span>
              <IconChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
