import { useEffect, useMemo, useState } from "react";
import { useRoute, useLocation, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, ArrowLeft, Send, Eye, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Lead, Patient, Appointment } from "@shared/schema";
import {
  TRIGGER_DEFINITIONS,
  WHATSAPP_TRIGGER_TYPES,
  CONDITION_FIELDS,
  CONDITION_OPERATORS,
  OPERATOR_LABELS,
  TEMPLATE_VARIABLE_SOURCES,
  STOP_CONDITION_TYPES,
  STOP_CONDITION_LABELS,
  STEP_DELAY_TYPES,
  DELAY_UNITS,
  type WhatsappTriggerType,
  type WhatsappAutomationRuleDetail,
  type WhatsappTemplate,
  type WhatsappEntityType,
  type InsertStep,
  type InsertCondition,
} from "@shared/schema";

function emptyStep(): InsertStep {
  return { stepOrder: 0, delayType: "immediate", delayUnit: "hours", delayValue: 0, specificTime: "09:00", templateId: "", messageType: "auto", variableMapping: {} };
}

function emptyCondition(field: string): InsertCondition {
  return { field, operator: "equals", value: "", groupNo: 0 };
}

export default function WhatsappRuleBuilder() {
  const [, setLocation] = useLocation();
  const [, editParams] = useRoute("/crm/whatsapp/rules/:id/edit");
  const ruleId = editParams?.id;
  const isEdit = !!ruleId;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: existing, isLoading: loadingExisting } = useQuery<WhatsappAutomationRuleDetail>({
    queryKey: [`/api/whatsapp/rules/${ruleId}`],
    enabled: isEdit,
  });

  const { data: templates = [] } = useQuery<WhatsappTemplate[]>({ queryKey: ["/api/whatsapp/templates"] });

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"Active" | "Inactive">("Inactive");
  const [priority, setPriority] = useState<"Low" | "Normal" | "High">("Normal");
  const [triggerType, setTriggerType] = useState<WhatsappTriggerType>("lead_created");
  const [thresholdDays, setThresholdDays] = useState(2);
  const [targetAudience, setTargetAudience] = useState<"primary_entity" | "custom_phone">("primary_entity");
  const [customPhone, setCustomPhone] = useState("");
  const [businessHoursOnly, setBusinessHoursOnly] = useState(true);
  const [maxPerContactPerDay, setMaxPerContactPerDay] = useState(0);
  const [conditions, setConditions] = useState<InsertCondition[]>([]);
  const [steps, setSteps] = useState<InsertStep[]>([emptyStep()]);
  const [stopConditions, setStopConditions] = useState<string[]>(["opted_out"]);

  useEffect(() => {
    if (!existing) return;
    setName(existing.name);
    setDescription(existing.description);
    setStatus(existing.status);
    setPriority(existing.priority);
    setTriggerType(existing.triggerType);
    setThresholdDays(Number(existing.triggerConfig?.thresholdDays) || 2);
    setTargetAudience(existing.targetAudience);
    setCustomPhone(existing.customPhone);
    setBusinessHoursOnly(existing.businessHoursOnly);
    setMaxPerContactPerDay(existing.maxPerContactPerDay);
    setConditions(existing.conditions.map((c) => ({ field: c.field, operator: c.operator, value: c.value, groupNo: c.groupNo })));
    setSteps(existing.steps.length ? existing.steps.map((s) => ({
      stepOrder: s.stepOrder, delayType: s.delayType, delayUnit: s.delayUnit, delayValue: s.delayValue,
      specificTime: s.specificTime, templateId: s.templateId, messageType: s.messageType, variableMapping: s.variableMapping,
    })) : [emptyStep()]);
    setStopConditions(existing.stopConditions);
  }, [existing]);

  const entity: WhatsappEntityType = TRIGGER_DEFINITIONS[triggerType].entity;
  const timing = TRIGGER_DEFINITIONS[triggerType].timing;
  const conditionFields = CONDITION_FIELDS[entity];
  const variableSources = [...TEMPLATE_VARIABLE_SOURCES[entity], ...TEMPLATE_VARIABLE_SOURCES.clinic];
  const relevantTemplates = templates; // no server-side filtering; approval status is shown per-row

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name, description, status, priority, triggerType,
        triggerConfig: triggerType === "lead_follow_up_missed" ? { thresholdDays } : {},
        targetAudience, customPhone, businessHoursOnly, maxPerContactPerDay,
        conditions, steps, stopConditions,
      };
      const res = isEdit
        ? await apiRequest("PATCH", `/api/whatsapp/rules/${ruleId}`, payload)
        : await apiRequest("POST", "/api/whatsapp/rules", payload);
      return res.json();
    },
    onSuccess: (rule) => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/rules"] });
      toast({ title: isEdit ? "Rule updated" : "Rule created" });
      setLocation(isEdit ? `/crm/whatsapp/rules/${ruleId}/edit` : `/crm/whatsapp/rules/${rule.id}/edit`);
    },
    onError: (error: Error) => {
      toast({ title: "Failed to save rule", description: error.message, variant: "destructive" });
    },
  });

  const updateStep = (index: number, patch: Partial<InsertStep>) => {
    setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  };

  const setStepVariableMapping = (index: number, varName: string, contextKey: string) => {
    setSteps((prev) => prev.map((s, i) => {
      if (i !== index) return s;
      return { ...s, variableMapping: { ...s.variableMapping, [varName]: contextKey === "__none__" ? "" : contextKey } };
    }));
  };

  const templateForStep = (templateId: string) => templates.find((t) => t.templateId === templateId);

  if (isEdit && loadingExisting) {
    return <div className="p-6 max-w-[1000px] mx-auto space-y-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-96 w-full" /></div>;
  }

  return (
    <div className="p-6 max-w-[1000px] mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/crm/whatsapp/rules"><Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button></Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{isEdit ? "Edit Automation Rule" : "New Automation Rule"}</h1>
          <p className="text-muted-foreground text-sm">WHEN this happens, IF these conditions match, SEND this WhatsApp message.</p>
        </div>
      </div>

      {/* Basic info */}
      <Card>
        <CardHeader><CardTitle className="text-base">Basic Information</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Rule Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. New Lead Welcome" data-testid="input-rule-name" />
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v: any) => setPriority(v)}>
                <SelectTrigger data-testid="select-priority"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="High">High</SelectItem>
                  <SelectItem value="Normal">Normal</SelectItem>
                  <SelectItem value="Low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What does this automation do?" rows={2} />
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label>Active</Label>
              <p className="text-xs text-muted-foreground">Inactive rules never fire, even if their trigger happens.</p>
            </div>
            <Switch checked={status === "Active"} onCheckedChange={(c) => setStatus(c ? "Active" : "Inactive")} data-testid="switch-rule-active" />
          </div>
        </CardContent>
      </Card>

      {/* Trigger */}
      <Card>
        <CardHeader><CardTitle className="text-base">WHEN (Trigger)</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Select value={triggerType} onValueChange={(v: any) => setTriggerType(v)}>
            <SelectTrigger data-testid="select-trigger-type"><SelectValue /></SelectTrigger>
            <SelectContent>
              {WHATSAPP_TRIGGER_TYPES.map((t) => (
                <SelectItem key={t} value={t}>{TRIGGER_DEFINITIONS[t].label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">{TRIGGER_DEFINITIONS[triggerType].description}</p>
          {triggerType === "lead_follow_up_missed" && (
            <div className="space-y-2 max-w-xs">
              <Label>Days without a logged follow-up before this fires</Label>
              <Input type="number" min={1} value={thresholdDays} onChange={(e) => setThresholdDays(Number(e.target.value) || 1)} />
            </div>
          )}
          {triggerType === "appointment_reminder" && (
            <p className="text-xs text-muted-foreground">
              The first message step's delay below is interpreted as "how long before the appointment" for this trigger.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Conditions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">IF (Conditions)</CardTitle>
          <CardDescription>All conditions must match (AND). Leave empty to match every event.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {conditions.map((c, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2 rounded-md border p-3">
              <Select value={c.field} onValueChange={(v) => setConditions((prev) => prev.map((x, xi) => xi === i ? { ...x, field: v } : x))}>
                <SelectTrigger className="w-48" data-testid={`select-condition-field-${i}`}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {conditionFields.map((f) => <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={c.operator} onValueChange={(v: any) => setConditions((prev) => prev.map((x, xi) => xi === i ? { ...x, operator: v } : x))}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CONDITION_OPERATORS.map((op) => <SelectItem key={op} value={op}>{OPERATOR_LABELS[op]}</SelectItem>)}
                </SelectContent>
              </Select>
              {c.operator !== "is_empty" && c.operator !== "is_not_empty" && (
                <Input
                  className="flex-1 min-w-[160px]"
                  value={c.value}
                  onChange={(e) => setConditions((prev) => prev.map((x, xi) => xi === i ? { ...x, value: e.target.value } : x))}
                  placeholder={c.operator === "in" ? "value1, value2" : "Value"}
                />
              )}
              <Button variant="ghost" size="icon" onClick={() => setConditions((prev) => prev.filter((_, xi) => xi !== i))}>
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setConditions((prev) => [...prev, emptyCondition(conditionFields[0]?.key || "")])} data-testid="button-add-condition">
            <Plus className="w-4 h-4" /> Add Condition
          </Button>
        </CardContent>
      </Card>

      {/* Recipient */}
      <Card>
        <CardHeader><CardTitle className="text-base">Recipient</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Select value={targetAudience} onValueChange={(v: any) => setTargetAudience(v)}>
            <SelectTrigger className="max-w-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="primary_entity">The {entity}'s own WhatsApp number</SelectItem>
              <SelectItem value="custom_phone">A fixed custom phone number</SelectItem>
            </SelectContent>
          </Select>
          {targetAudience === "custom_phone" && (
            <Input value={customPhone} onChange={(e) => setCustomPhone(e.target.value)} placeholder="10-digit phone number" className="max-w-xs" />
          )}
        </CardContent>
      </Card>

      {/* Steps */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">WHAT TO SEND (Steps)</CardTitle>
          <CardDescription>
            {timing === "scheduled"
              ? "Step 1's delay determines when this fires (e.g. how long before the appointment). Later steps count from when the run started."
              : "Each step's delay counts from the moment the trigger fires."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {steps.map((step, i) => {
            const template = templateForStep(step.templateId);
            return (
              <div key={i} className="rounded-md border p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <Badge variant="outline">Step {i + 1}</Badge>
                  {steps.length > 1 && (
                    <Button variant="ghost" size="icon" onClick={() => setSteps((prev) => prev.filter((_, xi) => xi !== i).map((s, xi) => ({ ...s, stepOrder: xi })))}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Label className="text-xs text-muted-foreground mr-1">Send</Label>
                  <Select value={step.delayType} onValueChange={(v: any) => updateStep(i, { delayType: v })}>
                    <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STEP_DELAY_TYPES.map((dt) => (
                        <SelectItem key={dt} value={dt}>{dt === "immediate" ? "Immediately" : dt === "after" ? "After a delay" : "At a specific time"}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {step.delayType === "after" && (
                    <>
                      <Input type="number" min={0} className="w-20" value={step.delayValue} onChange={(e) => updateStep(i, { delayValue: Number(e.target.value) || 0 })} />
                      <Select value={step.delayUnit} onValueChange={(v: any) => updateStep(i, { delayUnit: v })}>
                        <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {DELAY_UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      {timing === "scheduled" && i === 0 && <span className="text-xs text-muted-foreground">before the event</span>}
                    </>
                  )}
                  {step.delayType === "specific_time" && (
                    <Input type="time" className="w-32" value={step.specificTime} onChange={(e) => updateStep(i, { specificTime: e.target.value })} />
                  )}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-xs">WhatsApp Template</Label>
                    <Select value={step.templateId || undefined} onValueChange={(v) => updateStep(i, { templateId: v, variableMapping: {} })}>
                      <SelectTrigger data-testid={`select-template-${i}`}><SelectValue placeholder="Select a template" /></SelectTrigger>
                      <SelectContent>
                        {relevantTemplates.map((t) => (
                          <SelectItem key={t.templateId} value={t.templateId}>
                            {t.name} · {t.status}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {template && template.status !== "APPROVED" && (
                      <p className="text-xs text-amber-600">This template is {template.status.toLowerCase()}, not yet approved for sending.</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Message Type</Label>
                    <Select value={step.messageType} onValueChange={(v: any) => updateStep(i, { messageType: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">Auto (session reply if open, else template)</SelectItem>
                        <SelectItem value="template">Always use approved template</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {template && template.variables.length > 0 && (
                  <div className="space-y-2 rounded-md bg-muted/40 p-3">
                    <Label className="text-xs">Variable Mapping</Label>
                    {template.body && <p className="text-xs text-muted-foreground italic">"{template.body}"</p>}
                    {template.variables.map((v) => (
                      <div key={v.name} className="flex items-center gap-2">
                        <span className="text-xs font-mono w-32 shrink-0">{`{{${v.name}}}`}</span>
                        <Select
                          value={step.variableMapping[v.name] || "__none__"}
                          onValueChange={(val) => setStepVariableMapping(i, v.name, val)}
                        >
                          <SelectTrigger className="flex-1"><SelectValue placeholder="Map to a field" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">— Leave unmapped —</SelectItem>
                            {variableSources.map((src) => <SelectItem key={src.key} value={src.key}>{src.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          <Button
            variant="outline" size="sm" className="gap-2"
            onClick={() => setSteps((prev) => [...prev, { ...emptyStep(), stepOrder: prev.length, delayType: "after", delayUnit: "days", delayValue: 1 }])}
            data-testid="button-add-step"
          >
            <Plus className="w-4 h-4" /> Add Follow-up Step
          </Button>
        </CardContent>
      </Card>

      {/* Stop conditions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">STOP IF</CardTitle>
          <CardDescription>The sequence halts immediately if any of these become true - remaining steps are skipped.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {STOP_CONDITION_TYPES.map((type) => (
            <label key={type} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={stopConditions.includes(type)}
                onCheckedChange={(checked) => setStopConditions((prev) => checked ? [...prev, type] : prev.filter((t) => t !== type))}
              />
              {STOP_CONDITION_LABELS[type]}
            </label>
          ))}
        </CardContent>
      </Card>

      {/* Delivery controls */}
      <Card>
        <CardHeader><CardTitle className="text-base">Delivery Controls</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label>Respect Business Hours</Label>
              <p className="text-xs text-muted-foreground">Messages due outside business hours are queued for the next allowed window.</p>
            </div>
            <Switch checked={businessHoursOnly} onCheckedChange={setBusinessHoursOnly} />
          </div>
          <div className="space-y-2 max-w-xs">
            <Label>Max messages per contact / day (this rule)</Label>
            <Input type="number" min={0} value={maxPerContactPerDay} onChange={(e) => setMaxPerContactPerDay(Number(e.target.value) || 0)} />
            <p className="text-xs text-muted-foreground">0 = use the global default from WhatsApp Settings.</p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Link href="/crm/whatsapp/rules"><Button variant="outline">Cancel</Button></Link>
        <Button className="gap-2" onClick={() => saveMutation.mutate()} disabled={!name || steps.some((s) => !s.templateId) || saveMutation.isPending} data-testid="button-save-rule">
          <Save className="w-4 h-4" /> {isEdit ? "Save Changes" : "Create Rule"}
        </Button>
      </div>

      {isEdit && ruleId && <TestPanel ruleId={ruleId} entity={entity} steps={steps} />}
    </div>
  );
}

function TestPanel({ ruleId, entity, steps }: { ruleId: string; entity: WhatsappEntityType; steps: InsertStep[] }) {
  const { toast } = useToast();
  const [stepIndex, setStepIndex] = useState(0);
  const [entityId, setEntityId] = useState<string>("");
  const [testPhone, setTestPhone] = useState("");
  const [preview, setPreview] = useState<{ conditionsPass: boolean; phone: string; renderedMessage: string; templateStatus: string } | null>(null);

  const { data: leads = [] } = useQuery<Lead[]>({ queryKey: ["/api/crm/leads"], enabled: entity === "lead" });
  const { data: patientsPage } = useQuery<{ data: Patient[] }>({ queryKey: ["/api/patients"], enabled: entity === "patient" });
  const { data: appointments = [] } = useQuery<Appointment[]>({ queryKey: ["/api/appointments"], enabled: entity === "appointment" });
  const patients = patientsPage?.data || [];

  const options = entity === "lead" ? leads.map((l) => ({ id: l.id, label: `${l.name}${l.phone ? ` (${l.phone})` : ""}` }))
    : entity === "patient" ? patients.map((p) => ({ id: p.id, label: `${p.name} (${p.phone})` }))
    : appointments.map((a) => ({ id: a.id, label: `${a.patientName || a.patientId} - ${a.date} ${a.time}` }));

  const previewMutation = useMutation({
    mutationFn: async () => {
      const body: any = { stepIndex };
      if (entity === "lead") body.leadId = entityId;
      if (entity === "patient") body.patientId = entityId;
      if (entity === "appointment") body.appointmentId = entityId;
      const res = await apiRequest("POST", `/api/whatsapp/rules/${ruleId}/test`, body);
      return res.json();
    },
    onSuccess: (data) => setPreview(data),
    onError: (error: Error) => toast({ title: "Preview failed", description: error.message, variant: "destructive" }),
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      const body: any = { stepIndex, phone: testPhone };
      if (entity === "lead") body.leadId = entityId;
      if (entity === "patient") body.patientId = entityId;
      if (entity === "appointment") body.appointmentId = entityId;
      const res = await apiRequest("POST", `/api/whatsapp/rules/${ruleId}/test-send`, body);
      return res.json();
    },
    onSuccess: () => toast({ title: "Test message sent" }),
    onError: (error: Error) => toast({ title: "Test send failed", description: error.message, variant: "destructive" }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Test This Rule</CardTitle>
        <CardDescription>Preview the rendered message before activating, or send a real test message to your own phone.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label className="text-xs">Step</Label>
            <Select value={String(stepIndex)} onValueChange={(v) => setStepIndex(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {steps.map((_, i) => <SelectItem key={i} value={String(i)}>Step {i + 1}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label className="text-xs">Preview using this {entity}</Label>
            <Select value={entityId || undefined} onValueChange={setEntityId}>
              <SelectTrigger data-testid="select-test-entity"><SelectValue placeholder={`Choose a ${entity}`} /></SelectTrigger>
              <SelectContent>
                {options.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => previewMutation.mutate()} disabled={!entityId || previewMutation.isPending} data-testid="button-preview-message">
          <Eye className="w-4 h-4" /> Preview Rendered Message
        </Button>

        {preview && (
          <div className="rounded-md border p-3 space-y-1 bg-muted/30">
            <div className="flex items-center gap-2 text-xs">
              <Badge variant={preview.conditionsPass ? "default" : "secondary"}>{preview.conditionsPass ? "Conditions Pass" : "Conditions Do Not Match"}</Badge>
              <Badge variant="outline">Template: {preview.templateStatus}</Badge>
              <span className="text-muted-foreground">To: {preview.phone || "—"}</span>
            </div>
            <p className="text-sm">{preview.renderedMessage}</p>
          </div>
        )}

        <Separator />

        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-2">
            <Label className="text-xs">Send a real test to</Label>
            <Input value={testPhone} onChange={(e) => setTestPhone(e.target.value)} placeholder="10-digit phone number" className="w-48" />
          </div>
          <Button className="gap-2" onClick={() => sendMutation.mutate()} disabled={!testPhone || sendMutation.isPending} data-testid="button-send-test">
            <Send className="w-4 h-4" /> Send Test Message
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
