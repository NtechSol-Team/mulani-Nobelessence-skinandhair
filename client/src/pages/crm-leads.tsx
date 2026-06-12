import { useState, Fragment, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useLocation } from "wouter";
import { Plus, Search, MessageSquare, Phone, UserCheck, Trash2, Calendar, FileText, Users, Pencil, LayoutGrid, List } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  HoverCard,
  HoverCardTrigger,
  HoverCardContent,
} from "@/components/ui/hover-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Lead, CRMInteraction, CRMTask } from "@shared/schema";
import { format } from "date-fns";

export default function CRMLeads() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isInteractionDialogOpen, setIsInteractionDialogOpen] = useState(false);
  const [activeLead, setActiveLead] = useState<Lead | null>(null);
  const [editingInteraction, setEditingInteraction] = useState<CRMInteraction | null>(null);
  const [viewMode, setViewMode] = useState<"card" | "list">("card");
  const [expandedLeads, setExpandedLeads] = useState<string[]>([]);
  const [hoveredLead, setHoveredLead] = useState<string | null>(null);
  const collapseTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const toggleLeadExpand = (leadId: string) => {
    setExpandedLeads((prev) =>
      prev.includes(leadId) ? prev.filter((id) => id !== leadId) : [...prev, leadId]
    );
  };

  const handleMouseEnter = (leadId: string) => {
    if (collapseTimeoutRef.current) {
      clearTimeout(collapseTimeoutRef.current);
      collapseTimeoutRef.current = null;
    }
    setHoveredLead(leadId);
  };

  const handleMouseLeave = () => {
    if (collapseTimeoutRef.current) {
      clearTimeout(collapseTimeoutRef.current);
    }
    collapseTimeoutRef.current = setTimeout(() => {
      setHoveredLead(null);
    }, 200);
  };

  const { data: leads = [], isLoading } = useQuery<Lead[]>({
    queryKey: ["/api/crm/leads"],
  });

  const { data: interactions = [] } = useQuery<CRMInteraction[]>({
    queryKey: ["/api/crm/interactions"],
  });

  const { data: tasks = [] } = useQuery<CRMTask[]>({
    queryKey: ["/api/crm/tasks"],
  });

  const form = useForm({
    defaultValues: {
      name: "",
      phone: "",
      source: "Instagram",
      notes: "",
    },
  });

  const interactionForm = useForm({
    defaultValues: {
      date: format(new Date(), "yyyy-MM-dd"),
      type: "Follow-up",
      channel: "Call",
      notes: "",
      outcome: "",
      nextCallingDate: "",
    },
  });

  const createLeadMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/crm/leads", {
        ...data,
        status: "New",
        createdAt: format(new Date(), "yyyy-MM-dd"),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/leads"] });
      toast({
        title: "Lead Created",
        description: "New CRM lead has been added successfully.",
      });
      setIsAddDialogOpen(false);
      form.reset();
    },
  });

  const updateLeadStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const currentLead = leads.find((l) => l.id === id);
      if (!currentLead) throw new Error("Lead not found");
      return await apiRequest("PATCH", `/api/crm/leads/${id}`, {
        ...currentLead,
        status,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/stats"] });
      toast({
        title: "Lead Updated",
        description: "Lead status has been changed successfully.",
      });
    },
  });

  const addInteractionMutation = useMutation({
    mutationFn: async (data: any) => {
      if (!activeLead) return;
      const { nextCallingDate, ...interactionData } = data;
      const interaction = await apiRequest("POST", "/api/crm/interactions", {
        leadId: activeLead.id,
        ...interactionData,
      });

      if (nextCallingDate) {
        await apiRequest("POST", "/api/crm/tasks", {
          description: `Follow-up Call: ${activeLead.name}`,
          leadId: activeLead.id,
          dueDate: nextCallingDate,
          status: "Pending",
          priority: "Medium"
        });
      }
      return interaction;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/interactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/tasks"] });
      toast({
        title: "Contact Logged",
        description: "Communication has been recorded successfully.",
      });
      setIsInteractionDialogOpen(false);
      setActiveLead(null);
      interactionForm.reset();
    },
  });

  const updateInteractionMutation = useMutation({
    mutationFn: async (data: any) => {
      if (!editingInteraction) return;
      const { nextCallingDate, ...interactionData } = data;
      return await apiRequest("PATCH", `/api/crm/interactions/${editingInteraction.id}`, {
        ...interactionData,
        leadId: editingInteraction.leadId || activeLead?.id || undefined,
        patientId: editingInteraction.patientId || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/interactions"] });
      toast({
        title: "Interaction Updated",
        description: "Communication log has been updated successfully.",
      });
      setIsInteractionDialogOpen(false);
      setEditingInteraction(null);
      setActiveLead(null);
      interactionForm.reset({
        date: format(new Date(), "yyyy-MM-dd"),
        type: "Follow-up",
        channel: "Call",
        notes: "",
        outcome: "",
        nextCallingDate: "",
      });
    },
  });

  const deleteLeadMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/crm/leads/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/stats"] });
      toast({
        title: "Lead Deleted",
        description: "The CRM lead has been permanently removed.",
      });
    },
  });

  const handleConvertLead = (lead: Lead) => {
    setLocation(
      `/registration?leadId=${lead.id}&name=${encodeURIComponent(
        lead.name
      )}&phone=${encodeURIComponent(lead.phone || "")}&source=${encodeURIComponent(
        lead.source
      )}`
    );
  };

  const filteredLeads = leads.filter((lead) => {
    const matchesSearch =
      lead.name.toLowerCase().includes(search.toLowerCase()) ||
      (lead.phone || "").includes(search);
    const matchesStatus = selectedStatus === "All" || lead.status === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  const statusList = ["All", "New", "Hot", "Warm", "Cold", "Converted", "Lost"];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "New":
        return "bg-sky-50 text-sky-600 border-sky-200";
      case "Hot":
        return "bg-rose-50 text-rose-600 border-rose-200";
      case "Warm":
        return "bg-amber-50 text-amber-600 border-amber-200";
      case "Cold":
        return "bg-blue-50 text-blue-600 border-blue-200";
      case "Converted":
        return "bg-green-50 text-green-600 border-green-200";
      case "Lost":
        return "bg-gray-50 text-gray-500 border-gray-200";
      default:
        return "";
    }
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Leads Pipeline</h1>
          <p className="text-muted-foreground text-sm">
            Track inquiries, update lead status, and convert leads into registered clinic patients
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center border rounded-lg bg-muted p-1">
            <Button
              size="sm"
              variant={viewMode === "card" ? "default" : "ghost"}
              className="h-8 px-3 gap-1.5 text-xs font-semibold"
              onClick={() => setViewMode("card")}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Card View
            </Button>
            <Button
              size="sm"
              variant={viewMode === "list" ? "default" : "ghost"}
              className="h-8 px-3 gap-1.5 text-xs font-semibold"
              onClick={() => setViewMode("list")}
            >
              <List className="w-3.5 h-3.5" />
              List View
            </Button>
          </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Add CRM Lead
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add New Lead</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit((data) => createLeadMutation.mutate(data))}
                className="space-y-4"
              >
                <div>
                  <FormLabel>Name</FormLabel>
                  <Input placeholder="Lead's name" {...form.register("name")} required />
                </div>
                <div>
                  <FormLabel>Phone Number (Optional)</FormLabel>
                  <Input placeholder="10-digit number" type="tel" {...form.register("phone")} />
                </div>
                <div>
                  <FormLabel>Acquisition Source</FormLabel>
                  <select
                    className="w-full h-10 border rounded-md px-3 bg-background"
                    {...form.register("source")}
                  >
                    <option value="Walk-in">Walk-in</option>
                    <option value="Google Search">Google Search</option>
                    <option value="Instagram">Instagram</option>
                    <option value="Facebook">Facebook</option>
                    <option value="Friend Referral">Friend Referral</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <FormLabel>Lead Notes / Inquiry Details</FormLabel>
                  <Textarea placeholder="e.g. interested in laser treatment price..." {...form.register("notes")} />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createLeadMutation.isPending}>
                    {createLeadMutation.isPending ? "Adding..." : "Add Lead"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
    </div>

      {/* Filter and Search controls */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="flex flex-wrap gap-1.5 bg-muted p-1 rounded-lg">
          {statusList.map((status) => (
            <Button
              key={status}
              size="sm"
              variant={selectedStatus === status ? "default" : "ghost"}
              className="text-xs h-8"
              onClick={() => setSelectedStatus(status)}
            >
              {status}
            </Button>
          ))}
        </div>
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search leads by name or phone..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Leads List */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-44 w-full" />
          ))}
        </div>
      ) : filteredLeads.length === 0 ? (
        <div className="text-center py-12 border rounded-lg bg-card">
          <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-medium mb-1">No Leads Found</h3>
          <p className="text-muted-foreground text-sm">
            Try matching a different status filter or search query
          </p>
        </div>
      ) : viewMode === "card" ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredLeads.map((lead) => (
            <Card key={lead.id} className="hover-elevate transition-all border flex flex-col justify-between">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-lg tracking-tight leading-none mb-1.5">{lead.name}</h3>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Phone className="w-3 h-3" />
                      {lead.phone || "N/A"}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <Badge variant="outline" className={getStatusColor(lead.status)}>
                      {lead.status}
                    </Badge>
                    {(() => {
                      const leadTasks = tasks.filter((t) => t.leadId === lead.id && t.status === "Pending");
                      const nextTask = leadTasks.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0];
                      if (!nextTask) return null;
                      return (
                        <span className="text-[10px] text-primary bg-primary/5 px-1.5 py-0.5 rounded border border-primary/10 font-semibold whitespace-nowrap">
                          Next: {format(new Date(nextTask.dueDate), "dd MMM")}
                        </span>
                      );
                    })()}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 flex-1">
                <div className="text-sm bg-muted/30 p-2.5 rounded border border-border/40 min-h-[60px]">
                  <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1 flex items-center gap-1">
                    <FileText className="w-3 h-3" /> Note:
                  </p>
                  <p className="text-xs text-foreground/80 line-clamp-3">{lead.notes || "No notes logged."}</p>
                </div>

                {(() => {
                  const leadInteractions = interactions.filter((i) => i.leadId === lead.id);
                  if (leadInteractions.length === 0) return null;
                  return (
                    <div className="space-y-2">
                      <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider flex items-center gap-1">
                        <MessageSquare className="w-3 h-3" /> Communication Logs ({leadInteractions.length}):
                      </p>
                      <div className="max-h-28 overflow-y-auto space-y-1.5 pr-1">
                        {leadInteractions.map((interaction) => (
                          <div key={interaction.id} className="p-2 bg-muted/20 border rounded flex flex-col gap-1 text-[11px] relative group">
                            <div className="flex items-center justify-between font-medium">
                              <span className="text-primary">{interaction.type} ({interaction.channel})</span>
                              <div className="flex items-center gap-1">
                                <span className="text-muted-foreground text-[10px]">{format(new Date(interaction.date), "dd MMM yyyy")}</span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-4 w-4 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={() => {
                                    setEditingInteraction(interaction);
                                    setActiveLead(lead);
                                    interactionForm.reset({
                                      date: interaction.date,
                                      type: interaction.type,
                                      channel: interaction.channel,
                                      notes: interaction.notes,
                                      outcome: interaction.outcome || "",
                                      nextCallingDate: "",
                                    });
                                    setIsInteractionDialogOpen(true);
                                  }}
                                  title="Edit Log"
                                >
                                  <Pencil className="w-2.5 h-2.5" />
                                </Button>
                              </div>
                            </div>
                            <p className="text-foreground/80">{interaction.notes}</p>
                            {interaction.outcome && (
                              <p className="text-muted-foreground italic text-[10px]">Outcome: {interaction.outcome}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    Added: {format(new Date(lead.createdAt), "dd MMM yyyy")}
                  </span>
                  <span className="bg-primary/5 text-primary border border-primary/20 px-1.5 py-0.5 rounded text-[10px] font-semibold">
                    {lead.source}
                  </span>
                </div>

                {/* Operations buttons */}
                <div className="flex items-center justify-between gap-2 pt-2">
                  <div className="flex items-center gap-1.5">
                    <select
                      className="text-xs border rounded h-8 px-2 bg-background font-medium"
                      value={lead.status}
                      onChange={(e) => updateLeadStatusMutation.mutate({ id: lead.id, status: e.target.value })}
                      disabled={lead.status === "Converted"}
                    >
                      <option value="New">New</option>
                      <option value="Hot">Hot</option>
                      <option value="Warm">Warm</option>
                      <option value="Cold">Cold</option>
                      <option value="Converted" disabled>Converted</option>
                      <option value="Lost">Lost</option>
                    </select>
                    
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 w-8 p-0"
                      onClick={() => {
                        setActiveLead(lead);
                        setIsInteractionDialogOpen(true);
                      }}
                      title="Log Contact Call"
                    >
                      <MessageSquare className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {lead.status !== "Converted" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1.5 text-xs text-green-600 border-green-200 hover:bg-green-50"
                        onClick={() => handleConvertLead(lead)}
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        Convert
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        if (confirm("Delete this lead permanently?")) {
                          deleteLeadMutation.mutate(lead.id);
                        }
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="border rounded-lg bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead>Lead Info</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Next Call Date</TableHead>
                <TableHead className="max-w-[300px]">Notes</TableHead>
                <TableHead>Added Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLeads.map((lead) => {
                const leadTasks = tasks.filter((t) => t.leadId === lead.id && t.status === "Pending");
                const nextTask = leadTasks.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0];
                const leadInteractions = interactions.filter((i) => i.leadId === lead.id);
                const isExpanded = expandedLeads.includes(lead.id) || hoveredLead === lead.id;

                return (
                  <Fragment key={lead.id}>
                    <TableRow className="hover:bg-muted/30">
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 p-0 text-muted-foreground relative"
                          onClick={() => toggleLeadExpand(lead.id)}
                          onMouseEnter={() => handleMouseEnter(lead.id)}
                          onMouseLeave={handleMouseLeave}
                          title="Hover to view logs inline, Click to keep open"
                        >
                          <MessageSquare className={`w-4 h-4 ${leadInteractions.length > 0 ? "text-primary" : "opacity-40"}`} />
                          {leadInteractions.length > 0 && (
                            <span className="absolute -top-1 -right-1 bg-primary text-[8px] text-primary-foreground rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold">
                              {leadInteractions.length}
                            </span>
                          )}
                        </Button>
                      </TableCell>
                      <TableCell>
                        <div className="font-semibold text-sm text-foreground">{lead.name}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Phone className="w-3.5 h-3.5" />
                          {lead.phone || "N/A"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <select
                          className="text-xs border rounded h-8 px-2 bg-background font-medium"
                          value={lead.status}
                          onChange={(e) => updateLeadStatusMutation.mutate({ id: lead.id, status: e.target.value })}
                          disabled={lead.status === "Converted"}
                        >
                          <option value="New">New</option>
                          <option value="Hot">Hot</option>
                          <option value="Warm">Warm</option>
                          <option value="Cold">Cold</option>
                          <option value="Converted" disabled>Converted</option>
                          <option value="Lost">Lost</option>
                        </select>
                      </TableCell>
                      <TableCell>
                        <span className="bg-primary/5 text-primary border border-primary/20 px-1.5 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap">
                          {lead.source}
                        </span>
                      </TableCell>
                      <TableCell>
                        {nextTask ? (
                          <span className="inline-flex items-center gap-1 text-xs text-primary bg-primary/5 px-2 py-0.5 rounded border border-primary/10 font-semibold whitespace-nowrap">
                            <Calendar className="w-3 h-3" />
                            {format(new Date(nextTask.dueDate), "dd MMM yyyy")}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground font-normal">--</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[300px] text-xs text-foreground/80 truncate font-normal" title={lead.notes}>
                        {lead.notes || "No notes logged."}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap font-normal">
                        {format(new Date(lead.createdAt), "dd MMM yyyy")}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 w-8 p-0"
                            onClick={() => {
                              setActiveLead(lead);
                              setIsInteractionDialogOpen(true);
                            }}
                            title="Log Contact Call"
                          >
                            <MessageSquare className="w-4 h-4" />
                          </Button>
                          {lead.status !== "Converted" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 gap-1.5 text-xs text-green-600 border-green-200 hover:bg-green-50"
                              onClick={() => handleConvertLead(lead)}
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                              Convert
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
                            onClick={() => {
                              if (confirm("Delete this lead permanently?")) {
                                deleteLeadMutation.mutate(lead.id);
                              }
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow 
                        className="bg-muted/5 border-b hover:bg-muted/5"
                        onMouseEnter={() => handleMouseEnter(lead.id)}
                        onMouseLeave={handleMouseLeave}
                      >
                        <TableCell colSpan={8} className="p-4">
                          <div className="max-w-4xl mx-auto space-y-2">
                            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                              <MessageSquare className="w-3.5 h-3.5 text-primary" /> Full Communication Logs ({leadInteractions.length})
                            </h4>
                            {leadInteractions.length === 0 ? (
                              <p className="text-xs text-muted-foreground italic">No communication logs recorded yet.</p>
                            ) : (
                              <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 max-h-48 overflow-y-auto pr-1">
                                {leadInteractions.map((interaction) => (
                                  <div key={interaction.id} className="p-3 bg-card border rounded flex flex-col gap-1.5 text-xs relative group">
                                    <div className="flex items-center justify-between font-medium">
                                      <span className="text-primary">{interaction.type} ({interaction.channel})</span>
                                      <div className="flex items-center gap-1">
                                        <span className="text-muted-foreground text-[10px]">{format(new Date(interaction.date), "dd MMM yyyy")}</span>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-4 w-4 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                          onClick={() => {
                                            setEditingInteraction(interaction);
                                            setActiveLead(lead);
                                            interactionForm.reset({
                                              date: interaction.date,
                                              type: interaction.type,
                                              channel: interaction.channel,
                                              notes: interaction.notes,
                                              outcome: interaction.outcome || "",
                                              nextCallingDate: "",
                                            });
                                            setIsInteractionDialogOpen(true);
                                          }}
                                          title="Edit Log"
                                        >
                                          <Pencil className="w-2.5 h-2.5" />
                                        </Button>
                                      </div>
                                    </div>
                                    <p className="text-foreground/80 font-normal">{interaction.notes}</p>
                                    {interaction.outcome && (
                                      <p className="text-muted-foreground italic text-[10px] mt-0.5">Outcome: {interaction.outcome}</p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Log Interaction Dialog */}
      <Dialog open={isInteractionDialogOpen} onOpenChange={(open) => {
        setIsInteractionDialogOpen(open);
        if (!open) {
          setEditingInteraction(null);
          setActiveLead(null);
          interactionForm.reset({
            date: format(new Date(), "yyyy-MM-dd"),
            type: "Follow-up",
            channel: "Call",
            notes: "",
            outcome: "",
            nextCallingDate: "",
          });
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingInteraction ? "Edit Lead Contact Interaction" : "Log Lead Contact Interaction"}</DialogTitle>
          </DialogHeader>
          <Form {...interactionForm}>
            <form onSubmit={interactionForm.handleSubmit((data) => {
              if (editingInteraction) {
                updateInteractionMutation.mutate(data);
              } else {
                addInteractionMutation.mutate(data);
              }
            })} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <FormLabel>Date</FormLabel>
                  <Input type="date" {...interactionForm.register("date")} />
                </div>
                <div>
                  <FormLabel>Channel</FormLabel>
                  <select className="w-full h-10 border rounded-md px-3 bg-background" {...interactionForm.register("channel")}>
                    <option value="Call">Call</option>
                    <option value="WhatsApp">WhatsApp</option>
                    <option value="Email">Email</option>
                    <option value="In-Person">In-Person</option>
                  </select>
                </div>
              </div>
              <div>
                <FormLabel>Interaction Notes</FormLabel>
                <Textarea placeholder="What was discussed..." className="min-h-[80px]" {...interactionForm.register("notes")} required />
              </div>
              <div>
                <FormLabel>Outcome</FormLabel>
                <Input placeholder="e.g. scheduled consultation next Tuesday..." {...interactionForm.register("outcome")} />
              </div>
              {!editingInteraction && (
                <div>
                  <FormLabel>Next Calling Date (Optional)</FormLabel>
                  <Input type="date" {...interactionForm.register("nextCallingDate")} />
                </div>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setIsInteractionDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={addInteractionMutation.isPending || updateInteractionMutation.isPending}>
                  {addInteractionMutation.isPending || updateInteractionMutation.isPending ? "Saving..." : editingInteraction ? "Save Changes" : "Log Contact"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
