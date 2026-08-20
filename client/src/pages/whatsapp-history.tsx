import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { StopCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { WhatsappMessageJob, WhatsappAutomationRun, MessageJobStatus, AutomationRunStatus } from "@shared/schema";

const messageStatuses: (MessageJobStatus | "all")[] = ["all", "pending", "queued", "sending", "sent", "delivered", "read", "failed", "cancelled", "skipped"];

const statusColor: Record<string, string> = {
  sent: "bg-sky-500/10 text-sky-600 border-sky-500/20",
  delivered: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  read: "bg-teal-500/10 text-teal-600 border-teal-500/20",
  failed: "bg-red-500/10 text-red-600 border-red-500/20",
  cancelled: "bg-slate-500/10 text-slate-600 border-slate-500/20",
  skipped: "bg-slate-500/10 text-slate-600 border-slate-500/20",
  pending: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  queued: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  sending: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20",
  active: "bg-sky-500/10 text-sky-600 border-sky-500/20",
  completed: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  stopped: "bg-slate-500/10 text-slate-600 border-slate-500/20",
};

function fmt(ts?: string) {
  if (!ts) return "—";
  const d = new Date(ts);
  return isNaN(d.getTime()) ? ts : d.toLocaleString();
}

export default function WhatsappHistory() {
  const [statusFilter, setStatusFilter] = useState<string>("all");

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Execution History</h1>
        <p className="text-muted-foreground text-sm">Every automation message and run, for troubleshooting and auditing.</p>
      </div>

      <Tabs defaultValue="messages">
        <TabsList>
          <TabsTrigger value="messages" data-testid="tab-messages">Messages</TabsTrigger>
          <TabsTrigger value="runs" data-testid="tab-runs">Automation Runs</TabsTrigger>
        </TabsList>

        <TabsContent value="messages" className="space-y-4 mt-4">
          <div className="flex flex-wrap gap-2">
            {messageStatuses.map((s) => (
              <Badge
                key={s}
                variant={statusFilter === s ? "default" : "outline"}
                className="cursor-pointer capitalize"
                onClick={() => setStatusFilter(s)}
                data-testid={`filter-status-${s}`}
              >
                {s}
              </Badge>
            ))}
          </div>
          <MessagesTable status={statusFilter === "all" ? undefined : statusFilter} />
        </TabsContent>

        <TabsContent value="runs" className="space-y-4 mt-4">
          <RunsTable />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MessagesTable({ status }: { status?: string }) {
  const { data, isLoading } = useQuery<{ data: WhatsappMessageJob[]; total: number }>({
    queryKey: ["/api/whatsapp/messages", status || "all"],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      const res = await fetch(`/api/whatsapp/messages?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
      return res.json();
    },
  });

  if (isLoading) return <Skeleton className="h-96 w-full" />;
  const jobs = data?.data || [];

  return (
    <Card>
      <CardContent className="p-0">
        {jobs.length === 0 ? (
          <p className="p-12 text-center text-muted-foreground">No messages match this filter yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Recipient</TableHead>
                  <TableHead>Rule</TableHead>
                  <TableHead>Template</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Scheduled</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead>Delivered</TableHead>
                  <TableHead>Read</TableHead>
                  <TableHead>Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((j) => (
                  <TableRow key={j.id} data-testid={`row-message-${j.id}`}>
                    <TableCell>
                      <div className="font-medium">{j.entityName || j.entityId}</div>
                      <div className="text-xs text-muted-foreground">{j.phone}</div>
                    </TableCell>
                    <TableCell>{j.ruleName || "—"}</TableCell>
                    <TableCell>{j.templateName || j.templateId}</TableCell>
                    <TableCell><Badge variant="outline" className={statusColor[j.status] || ""}>{j.status}</Badge></TableCell>
                    <TableCell className="text-xs">{fmt(j.scheduledAt)}</TableCell>
                    <TableCell className="text-xs">{fmt(j.sentAt)}</TableCell>
                    <TableCell className="text-xs">{fmt(j.deliveredAt)}</TableCell>
                    <TableCell className="text-xs">{fmt(j.readAt)}</TableCell>
                    <TableCell className="text-xs text-destructive max-w-[200px] truncate">{j.lastError || ""}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RunsTable() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery<{ data: WhatsappAutomationRun[]; total: number }>({ queryKey: ["/api/whatsapp/runs"] });

  const stopMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("POST", `/api/whatsapp/runs/${id}/stop`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/runs"] });
      toast({ title: "Automation stopped for this contact" });
    },
  });

  if (isLoading) return <Skeleton className="h-96 w-full" />;
  const runs = data?.data || [];

  return (
    <Card>
      <CardContent className="p-0">
        {runs.length === 0 ? (
          <p className="p-12 text-center text-muted-foreground">No automation runs yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contact</TableHead>
                  <TableHead>Rule</TableHead>
                  <TableHead>Trigger</TableHead>
                  <TableHead>Step</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Stop Reason</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((r) => (
                  <TableRow key={r.id} data-testid={`row-run-${r.id}`}>
                    <TableCell>{r.entityName || r.entityId}</TableCell>
                    <TableCell>{r.ruleName || "—"}</TableCell>
                    <TableCell className="text-xs">{r.triggerEvent}</TableCell>
                    <TableCell>{r.currentStep + 1}</TableCell>
                    <TableCell><Badge variant="outline" className={statusColor[r.status] || ""}>{r.status}</Badge></TableCell>
                    <TableCell className="text-xs">{fmt(r.startedAt)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.stopReason || ""}</TableCell>
                    <TableCell className="text-right">
                      {r.status === "active" && (
                        <Button variant="ghost" size="icon" onClick={() => stopMutation.mutate(r.id)} data-testid={`button-stop-run-${r.id}`}>
                          <StopCircle className="w-4 h-4 text-destructive" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
