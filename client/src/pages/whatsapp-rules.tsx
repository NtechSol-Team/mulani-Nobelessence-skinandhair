import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Zap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { TRIGGER_DEFINITIONS, type WhatsappAutomationRule } from "@shared/schema";

const priorityColor: Record<string, string> = {
  High: "bg-red-500/10 text-red-600 border-red-500/20",
  Normal: "bg-sky-500/10 text-sky-600 border-sky-500/20",
  Low: "bg-slate-500/10 text-slate-600 border-slate-500/20",
};

export default function WhatsappRules() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: rules = [], isLoading } = useQuery<WhatsappAutomationRule[]>({
    queryKey: ["/api/whatsapp/rules"],
  });

  const toggleStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "Active" | "Inactive" }) => {
      const res = await apiRequest("PATCH", `/api/whatsapp/rules/${id}/status`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/rules"] });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update rule status", description: error.message, variant: "destructive" });
    },
  });

  const deleteRule = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/whatsapp/rules/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/rules"] });
      toast({ title: "Rule deleted" });
      setDeletingId(null);
    },
    onError: (error: Error) => {
      toast({ title: "Failed to delete rule", description: error.message, variant: "destructive" });
    },
  });

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Automation Rules</h1>
          <p className="text-muted-foreground text-sm">
            Define when to trigger, what conditions must match, and which WhatsApp template to send.
          </p>
        </div>
        <Button className="gap-2" onClick={() => setLocation("/crm/whatsapp/rules/new")} data-testid="button-new-rule">
          <Plus className="w-4 h-4" />
          New Rule
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : rules.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <Zap className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p>No automation rules yet.</p>
              <Link href="/crm/whatsapp/rules/new" className="text-primary hover:underline text-sm">Create your first rule</Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rule Name</TableHead>
                    <TableHead>Trigger</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rules.map((rule) => (
                    <TableRow key={rule.id} data-testid={`row-rule-${rule.id}`}>
                      <TableCell>
                        <div className="font-medium">{rule.name}</div>
                        {rule.description && <div className="text-xs text-muted-foreground line-clamp-1">{rule.description}</div>}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{TRIGGER_DEFINITIONS[rule.triggerType]?.label || rule.triggerType}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={priorityColor[rule.priority]}>{rule.priority}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={rule.status === "Active"}
                            onCheckedChange={(checked) => toggleStatus.mutate({ id: rule.id, status: checked ? "Active" : "Inactive" })}
                            data-testid={`switch-rule-status-${rule.id}`}
                          />
                          <Badge variant={rule.status === "Active" ? "default" : "secondary"}>{rule.status}</Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => setLocation(`/crm/whatsapp/rules/${rule.id}/edit`)} data-testid={`button-edit-rule-${rule.id}`}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeletingId(rule.id)} data-testid={`button-delete-rule-${rule.id}`}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this automation rule?</AlertDialogTitle>
            <AlertDialogDescription>
              This stops the rule from running and removes its conditions and steps. Past message history is kept for auditing.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deletingId && deleteRule.mutate(deletingId)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
