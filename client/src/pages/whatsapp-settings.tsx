import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Activity, Copy, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { WhatsappSettings } from "@shared/schema";

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

export default function WhatsappSettingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useQuery<WhatsappSettings>({ queryKey: ["/api/whatsapp/settings"] });

  const [form, setForm] = useState<WhatsappSettings | null>(null);
  useEffect(() => { if (settings) setForm(settings); }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form) return;
      const res = await apiRequest("PATCH", "/api/whatsapp/settings", form);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/whatsapp/settings"], data);
      toast({ title: "Settings saved" });
    },
    onError: (error: Error) => toast({ title: "Failed to save settings", description: getErrorMessage(error), variant: "destructive" }),
  });

  const healthMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("GET", "/api/whatsapp/health");
      return res.json();
    },
    onError: (error: Error) => toast({ title: "Health check failed", description: getErrorMessage(error), variant: "destructive" }),
  });

  const webhookUrl = typeof window !== "undefined" ? `${window.location.origin}/api/webhooks/whatsapp` : "";

  if (isLoading || !form) {
    return <div className="p-6 max-w-[900px] mx-auto space-y-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-96 w-full" /></div>;
  }

  return (
    <div className="p-6 max-w-[900px] mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">WhatsApp Settings</h1>
        <p className="text-muted-foreground text-sm">Global controls the automation engine respects for every rule.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Automation</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label>Enabled</Label>
              <p className="text-xs text-muted-foreground">Turn off to pause every automation rule at once without deactivating them individually.</p>
            </div>
            <Switch checked={form.enabled} onCheckedChange={(v) => setForm({ ...form, enabled: v })} data-testid="switch-automation-enabled" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Business Hours</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label>Restrict to business hours</Label>
              <p className="text-xs text-muted-foreground">Messages due outside these hours are queued for the next allowed window (per rule, unless a rule opts out).</p>
            </div>
            <Switch checked={form.businessHoursEnabled} onCheckedChange={(v) => setForm({ ...form, businessHoursEnabled: v })} />
          </div>
          <div className="grid grid-cols-3 gap-4 max-w-md">
            <div className="space-y-2">
              <Label className="text-xs">Start</Label>
              <Input type="time" value={form.businessHoursStart} onChange={(e) => setForm({ ...form, businessHoursStart: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">End</Label>
              <Input type="time" value={form.businessHoursEnd} onChange={(e) => setForm({ ...form, businessHoursEnd: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Timezone</Label>
              <Input value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Spam Protection</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-xs">Max messages per contact / day (global default)</Label>
            <Input type="number" min={0} value={form.maxPerContactPerDay} onChange={(e) => setForm({ ...form, maxPerContactPerDay: Number(e.target.value) || 0 })} />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Minimum minutes between messages to the same contact</Label>
            <Input type="number" min={0} value={form.minGapMinutes} onChange={(e) => setForm({ ...form, minGapMinutes: Number(e.target.value) || 0 })} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button className="gap-2" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} data-testid="button-save-settings">
          <Save className="w-4 h-4" /> Save Settings
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Webhook URL</CardTitle>
          <CardDescription>Paste this into QuickAuth Dashboard → Settings → Webhooks so delivery/read/reply events reach this app.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input readOnly value={webhookUrl} className="font-mono text-xs" />
            <Button
              variant="outline" size="icon"
              onClick={() => { navigator.clipboard.writeText(webhookUrl); toast({ title: "Copied" }); }}
            >
              <Copy className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account Health</CardTitle>
          <CardDescription>Quality rating, messaging tier, and daily limit reported by QuickAuth for your connected number(s).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button variant="outline" className="gap-2" onClick={() => healthMutation.mutate()} disabled={healthMutation.isPending} data-testid="button-check-health">
            <Activity className="w-4 h-4" /> Check Health
          </Button>
          {healthMutation.data && (
            <pre className="text-xs bg-muted/40 rounded-md p-3 overflow-x-auto">{JSON.stringify(healthMutation.data, null, 2)}</pre>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
