import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Plus, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { WhatsappTemplate } from "@shared/schema";

const statusColor: Record<string, string> = {
  APPROVED: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  PENDING: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  DRAFT: "bg-slate-500/10 text-slate-600 border-slate-500/20",
  REJECTED: "bg-red-500/10 text-red-600 border-red-500/20",
};

function getErrorMessage(error: Error): string {
  try {
    const colIdx = error.message.indexOf(":");
    if (colIdx !== -1) {
      const parsed = JSON.parse(error.message.substring(colIdx + 1).trim());
      if (parsed.error) return typeof parsed.error === "string" ? parsed.error : JSON.stringify(parsed.error);
    }
  } catch { /* ignore */ }
  return error.message;
}

export default function WhatsappTemplates() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const { data: templates = [], isLoading } = useQuery<WhatsappTemplate[]>({ queryKey: ["/api/whatsapp/templates"] });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/whatsapp/templates/sync");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/templates"] });
      toast({ title: `Synced ${data.synced} template(s) from QuickAuth` });
    },
    onError: (error: Error) => toast({ title: "Sync failed", description: getErrorMessage(error), variant: "destructive" }),
  });

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">WhatsApp Templates</h1>
          <p className="text-muted-foreground text-sm">
            Synced from QuickAuth. Only APPROVED templates can be used to message customers outside an open conversation window.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending} data-testid="button-sync-templates">
            <RefreshCw className={`w-4 h-4 ${syncMutation.isPending ? "animate-spin" : ""}`} /> Sync Now
          </Button>
          <CreateTemplateDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : templates.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <p>No templates synced yet.</p>
              <p className="text-sm">Create one below, or click "Sync Now" if templates already exist in your QuickAuth account.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Language</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Body</TableHead>
                    <TableHead className="text-right">Variables</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templates.map((t) => (
                    <TableRow key={t.templateId} data-testid={`row-template-${t.templateId}`}>
                      <TableCell className="font-medium">{t.name}</TableCell>
                      <TableCell>{t.language}</TableCell>
                      <TableCell>{t.category}</TableCell>
                      <TableCell><Badge variant="outline" className={statusColor[t.status] || ""}>{t.status}</Badge></TableCell>
                      <TableCell className="max-w-md truncate text-sm text-muted-foreground">{t.body}</TableCell>
                      <TableCell className="text-right">{t.variables.length}</TableCell>
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

function CreateTemplateDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [language, setLanguage] = useState("en");
  const [category, setCategory] = useState<"UTILITY" | "MARKETING" | "AUTHENTICATION">("UTILITY");
  const [body, setBody] = useState("");
  const [footer, setFooter] = useState("");
  const [variables, setVariables] = useState<{ name: string; example: string }[]>([]);

  const reset = () => { setName(""); setLanguage("en"); setCategory("UTILITY"); setBody(""); setFooter(""); setVariables([]); };

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/whatsapp/templates", { name, language, category, body, footer, variables });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/templates"] });
      toast({ title: "Template submitted for approval" });
      reset();
      onOpenChange(false);
    },
    onError: (error: Error) => toast({ title: "Failed to create template", description: getErrorMessage(error), variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button className="gap-2" data-testid="button-new-template"><Plus className="w-4 h-4" /> New Template</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Create WhatsApp Template</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="new_lead_welcome" />
            </div>
            <div className="space-y-2">
              <Label>Language</Label>
              <Input value={language} onChange={(e) => setLanguage(e.target.value)} placeholder="en" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={category} onValueChange={(v: any) => setCategory(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="UTILITY">Utility (order updates, reminders, receipts)</SelectItem>
                <SelectItem value="MARKETING">Marketing (promotions, offers)</SelectItem>
                <SelectItem value="AUTHENTICATION">Authentication (OTP / login codes)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Body</Label>
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} placeholder={"Hi {{1}}, your appointment is confirmed for {{2}}."} />
            <p className="text-xs text-muted-foreground">Use {"{{1}}"}, {"{{2}}"}... in the order the variables below are declared.</p>
          </div>
          <div className="space-y-2">
            <Label>Footer (optional)</Label>
            <Input value={footer} onChange={(e) => setFooter(e.target.value)} placeholder="Reply STOP to opt out" />
          </div>
          <div className="space-y-2">
            <Label>Variables</Label>
            {variables.map((v, i) => (
              <div key={i} className="flex gap-2">
                <Input placeholder="name" value={v.name} onChange={(e) => setVariables((prev) => prev.map((x, xi) => xi === i ? { ...x, name: e.target.value } : x))} />
                <Input placeholder="example value" value={v.example} onChange={(e) => setVariables((prev) => prev.map((x, xi) => xi === i ? { ...x, example: e.target.value } : x))} />
                <Button variant="ghost" size="icon" onClick={() => setVariables((prev) => prev.filter((_, xi) => xi !== i))}><X className="w-4 h-4" /></Button>
              </div>
            ))}
            <Button variant="outline" size="sm" className="gap-2" onClick={() => setVariables((prev) => [...prev, { name: "", example: "" }])}>
              <Plus className="w-4 h-4" /> Add Variable
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => createMutation.mutate()} disabled={!name || !body || createMutation.isPending} data-testid="button-submit-template">
            Submit for Approval
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
