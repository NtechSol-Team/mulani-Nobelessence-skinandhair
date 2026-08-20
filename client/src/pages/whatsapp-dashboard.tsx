import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Zap, Send, CheckCheck, Eye, XCircle, Clock, CalendarClock, MessageSquareReply, ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import type { WhatsappDashboardStats } from "@shared/schema";

function StatCard({ label, value, icon: Icon, color }: { label: string; value: number; icon: any; color: string }) {
  return (
    <Card className="hover-elevate transition-all">
      <CardContent className="p-6 flex items-center justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
          <h3 className="text-3xl font-bold">{value}</h3>
        </div>
        <div className={`w-12 h-12 rounded-lg ${color} flex items-center justify-center`}>
          <Icon className="w-6 h-6" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function WhatsappDashboard() {
  const { data: stats, isLoading } = useQuery<WhatsappDashboardStats>({
    queryKey: ["/api/whatsapp/dashboard"],
  });

  if (isLoading) {
    return (
      <div className="p-6 max-w-[1600px] mx-auto space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">WhatsApp Automation Dashboard</h1>
          <p className="text-muted-foreground text-sm">
            Automated WhatsApp messaging performance across all active rules
          </p>
        </div>
        <Link href="/crm/whatsapp/rules">
          <Button className="gap-2" data-testid="button-manage-rules">
            <Zap className="w-4 h-4" />
            Manage Rules
            <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active Rules" value={stats?.activeRules || 0} icon={Zap} color="bg-violet-500/10 text-violet-500" />
        <StatCard label="Sent Today" value={stats?.sentToday || 0} icon={Send} color="bg-sky-500/10 text-sky-500" />
        <StatCard label="Delivered Today" value={stats?.deliveredToday || 0} icon={CheckCheck} color="bg-emerald-500/10 text-emerald-500" />
        <StatCard label="Read Today" value={stats?.readToday || 0} icon={Eye} color="bg-teal-500/10 text-teal-500" />
        <StatCard label="Failed Today" value={stats?.failedToday || 0} icon={XCircle} color="bg-red-500/10 text-red-500" />
        <StatCard label="Pending / Queued" value={stats?.pending || 0} icon={Clock} color="bg-amber-500/10 text-amber-500" />
        <StatCard label="Scheduled (Future)" value={stats?.scheduled || 0} icon={CalendarClock} color="bg-indigo-500/10 text-indigo-500" />
        <StatCard label="Replies Today" value={stats?.repliesToday || 0} icon={MessageSquareReply} color="bg-pink-500/10 text-pink-500" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Automation Performance by Rule</CardTitle>
        </CardHeader>
        <CardContent>
          {(!stats?.perRule || stats.perRule.length === 0) ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No automation rules yet. <Link href="/crm/whatsapp/rules/new" className="text-primary hover:underline">Create your first rule</Link>.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rule</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Triggered</TableHead>
                    <TableHead className="text-right">Sent</TableHead>
                    <TableHead className="text-right">Delivered</TableHead>
                    <TableHead className="text-right">Read</TableHead>
                    <TableHead className="text-right">Failed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.perRule.map((r) => (
                    <TableRow key={r.ruleId} data-testid={`row-rule-stats-${r.ruleId}`}>
                      <TableCell className="font-medium">
                        <Link href={`/crm/whatsapp/rules/${r.ruleId}/edit`} className="hover:underline">{r.ruleName}</Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant={r.status === "Active" ? "default" : "secondary"}>{r.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{r.triggered}</TableCell>
                      <TableCell className="text-right">{r.sent}</TableCell>
                      <TableCell className="text-right">{r.delivered}</TableCell>
                      <TableCell className="text-right">{r.read}</TableCell>
                      <TableCell className="text-right">
                        {r.failed > 0 ? <span className="text-destructive font-medium">{r.failed}</span> : r.failed}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
