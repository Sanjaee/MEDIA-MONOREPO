"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, Flag, Loader2 } from "lucide-react";
import { getAdminReportsAction, updateReportStatusAction, AdminReportRow } from "@/actions/admin.actions";
import { toast } from "sonner";

const REPORT_STATUS = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "resolved", label: "Resolved" },
  { value: "dismissed", label: "Dismissed" },
];

const REASON_LABELS: Record<string, string> = {
  spam: "Spam",
  harassment: "Harassment",
  inappropriate_content: "Inappropriate Content",
  scam: "Scam or Fraud",
  misleading_info: "Misleading Info",
  other: "Other",
};

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "open":
      return <Badge variant="outline" className="border-amber-500/60 text-amber-500 bg-amber-500/10">Open</Badge>;
    case "resolved":
      return <Badge variant="outline" className="border-green-500/60 text-green-500 bg-green-500/10">Resolved</Badge>;
    case "dismissed":
      return <Badge variant="outline" className="border-muted-foreground/40 text-muted-foreground bg-muted/40">Dismissed</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function ReviewReportDialog({ report, open, onOpenChange }: { report: AdminReportRow; open: boolean; onOpenChange: (v: boolean) => void }) {
  const [note, setNote] = useState(report.adminNote || "");
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (status: string) => {
      await updateReportStatusAction(report.id, status, note);
    },
    onSuccess: (_data, status) => {
      toast.success(`Report marked as ${status}`);
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ["admin-reports"] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to update report");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Review Report</DialogTitle>
          <DialogDescription>
            Add a note and resolve or dismiss this report. You can also keep it open.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-4 items-start gap-4">
            <span className="font-semibold text-sm text-muted-foreground">Reporter:</span>
            <span className="col-span-3 text-sm">
              {report.reporter.name || report.reporter.username || "Unknown"} <br />
              <span className="text-muted-foreground text-xs">@{report.reporter.username}</span>
            </span>
          </div>
          <div className="grid grid-cols-4 items-start gap-4">
            <span className="font-semibold text-sm text-muted-foreground">Post Author:</span>
            <span className="col-span-3 text-sm">
              {report.post.author?.name || report.post.author?.username || "Unknown"} <br />
              <span className="text-muted-foreground text-xs">@{report.post.author?.username}</span>
            </span>
          </div>
          <div className="grid grid-cols-4 items-start gap-4">
            <span className="font-semibold text-sm text-muted-foreground">Reason:</span>
            <span className="col-span-3 text-sm">{REASON_LABELS[report.reason] || report.reason}</span>
          </div>
          {report.description && (
            <div className="grid grid-cols-4 items-start gap-4">
              <span className="font-semibold text-sm text-muted-foreground">Details:</span>
              <span className="col-span-3 text-sm whitespace-pre-wrap">{report.description}</span>
            </div>
          )}
          <div className="grid grid-cols-4 items-start gap-4">
            <span className="font-semibold text-sm text-muted-foreground">Post:</span>
            <span className="col-span-3 text-sm line-clamp-3 whitespace-pre-wrap">{report.post.content || "(no content)"}</span>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Admin Note</label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Optional note about your decision..." />
          </div>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => mutation.mutate("open")} disabled={mutation.isPending}>
            {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Keep Open
          </Button>
          <Button variant="secondary" onClick={() => mutation.mutate("dismissed")} disabled={mutation.isPending}>
            Dismiss
          </Button>
          <Button onClick={() => mutation.mutate("resolved")} disabled={mutation.isPending} className="bg-green-600 hover:bg-green-700 text-white">
            Resolve
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ReportsClient({ initialData }: { initialData: AdminReportRow[] }) {
  const [statusFilter, setStatusFilter] = useState("all");
  const [globalFilter, setGlobalFilter] = useState("");
  const [reviewing, setReviewing] = useState<AdminReportRow | null>(null);

  const { data: reports } = useQuery({
    queryKey: ["admin-reports"],
    queryFn: () => getAdminReportsAction("all"),
    initialData,
    refetchInterval: 10000,
  });

  const filteredData = useMemo(() => {
    if (!reports) return [];
    let rows = reports;
    if (statusFilter !== "all") {
      rows = rows.filter((r) => r.status === statusFilter);
    }
    if (globalFilter.trim()) {
      const q = globalFilter.toLowerCase();
      rows = rows.filter((r) =>
        [
          r.reason,
          r.reporter?.name,
          r.reporter?.username,
          r.reporter?.email,
          r.post?.author?.name,
          r.post?.author?.username,
          r.description,
        ]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q))
      );
    }
    return rows;
  }, [reports, statusFilter, globalFilter]);

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <Tabs value={statusFilter} onValueChange={setStatusFilter} className="w-full sm:w-auto">
          <TabsList>
            {REPORT_STATUS.map((s) => (
              <TabsTrigger key={s.value} value={s.value}>{s.label}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search reports..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      <div className="rounded-xl border border-border/40 bg-card/50 shadow-sm backdrop-blur-sm overflow-hidden">
        <div className="overflow-auto max-h-[600px] relative">
          <Table>
            <TableHeader className="sticky top-0 bg-background/95 backdrop-blur z-10">
              <TableRow className="border-b border-border/40 hover:bg-transparent">
                <TableHead className="h-12 font-semibold text-muted-foreground/80">Reporter</TableHead>
                <TableHead className="h-12 font-semibold text-muted-foreground/80">Post</TableHead>
                <TableHead className="h-12 font-semibold text-muted-foreground/80">Reason</TableHead>
                <TableHead className="h-12 font-semibold text-muted-foreground/80">Status</TableHead>
                <TableHead className="h-12 font-semibold text-muted-foreground/80">Date</TableHead>
                <TableHead className="h-12 text-right font-semibold text-muted-foreground/80">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                    No reports found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredData.map((report) => (
                  <TableRow key={report.id} className="border-b border-border/40 hover:bg-muted/30 transition-colors">
                    <TableCell className="py-3">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={report.reporter?.image || report.reporter?.avatar_url || ""} alt={report.reporter?.name || ""} />
                          <AvatarFallback>{(report.reporter?.name || "U").substring(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">{report.reporter?.name || report.reporter?.username || "Unknown"}</span>
                          <span className="text-xs text-muted-foreground">@{report.reporter?.username || "-"}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-3 max-w-[280px]">
                      <span className="text-sm line-clamp-2 whitespace-pre-wrap">
                        {report.post?.content || "(no content)"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        by @{report.post?.author?.username || "unknown"}
                      </span>
                    </TableCell>
                    <TableCell className="py-3">
                      <span className="text-sm capitalize">{REASON_LABELS[report.reason] || report.reason}</span>
                    </TableCell>
                    <TableCell className="py-3">
                      <StatusBadge status={report.status} />
                      {report.adminNote && (
                        <span className="block text-xs text-muted-foreground mt-1 max-w-[180px] truncate" title={report.adminNote}>
                          &ldquo;{report.adminNote}&rdquo;
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="py-3 text-sm text-muted-foreground whitespace-nowrap">
                      {new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(report.createdAt))}
                    </TableCell>
                    <TableCell className="py-3 text-right">
                      <Button variant="outline" size="sm" onClick={() => setReviewing(report)}>
                        <Flag className="mr-1 h-3.5 w-3.5" />
                        Review
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {reviewing && (
        <ReviewReportDialog report={reviewing} open={!!reviewing} onOpenChange={(v) => { if (!v) setReviewing(null); }} />
      )}
    </div>
  );
}