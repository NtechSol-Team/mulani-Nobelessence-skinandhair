import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Plus, Search, Calendar, CheckSquare, Square, Trash2, AlertCircle, Clock, Link as LinkIcon, Phone, MessageSquare } from "lucide-react";
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
import { Form, FormLabel } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { CRMTask, Patient, Lead, CRMInteraction } from "@shared/schema";
import { extractPaginatedData } from "@/lib/utils";
import { format } from "date-fns";

export default function CRMTasks() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("Pending");
  const [selectedDueDateFilter, setSelectedDueDateFilter] = useState("All");
  const [customFromDate, setCustomFromDate] = useState("");
  const [customToDate, setCustomToDate] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [taskToLog, setTaskToLog] = useState<CRMTask | null>(null);
  const [isTaskLogDialogOpen, setIsTaskLogDialogOpen] = useState(false);
  const [expandedTasks, setExpandedTasks] = useState<string[]>([]);
  const [hoveredTask, setHoveredTask] = useState<string | null>(null);
  const collapseTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const toggleTaskExpand = (taskId: string) => {
    setExpandedTasks((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]
    );
  };

  const handleMouseEnter = (taskId: string) => {
    if (collapseTimeoutRef.current) {
      clearTimeout(collapseTimeoutRef.current);
      collapseTimeoutRef.current = null;
    }
    setHoveredTask(taskId);
  };

  const handleMouseLeave = () => {
    if (collapseTimeoutRef.current) {
      clearTimeout(collapseTimeoutRef.current);
    }
    collapseTimeoutRef.current = setTimeout(() => {
      setHoveredTask(null);
    }, 200);
  };

  const { data: tasks = [], isLoading } = useQuery<CRMTask[]>({
    queryKey: ["/api/crm/tasks"],
  });

  const { data: patientsResponse } = useQuery({
    queryKey: ["/api/patients"],
  });
  const patients = extractPaginatedData<Patient>(patientsResponse);

  const { data: leads = [] } = useQuery<Lead[]>({
    queryKey: ["/api/crm/leads"],
  });

  const { data: interactions = [] } = useQuery<CRMInteraction[]>({
    queryKey: ["/api/crm/interactions"],
  });

  const form = useForm({
    defaultValues: {
      description: "",
      dueDate: format(new Date(), "yyyy-MM-dd"),
      priority: "Medium",
      linkType: "None",
      linkId: "",
    },
  });

  const taskInteractionForm = useForm({
    defaultValues: {
      date: format(new Date(), "yyyy-MM-dd"),
      channel: "Call",
      notes: "",
      outcome: "",
      completeTask: true,
      nextCallingDate: "",
    }
  });

  const createTaskMutation = useMutation({
    mutationFn: async (data: any) => {
      const taskPayload: any = {
        description: data.description,
        dueDate: data.dueDate,
        priority: data.priority,
      };
      if (data.linkType === "Patient" && data.linkId) {
        taskPayload.patientId = data.linkId;
      } else if (data.linkType === "Lead" && data.linkId) {
        taskPayload.leadId = data.linkId;
      }
      return await apiRequest("POST", "/api/crm/tasks", taskPayload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/stats"] });
      toast({
        title: "Task Created",
        description: "CRM follow-up task has been scheduled.",
      });
      setIsAddDialogOpen(false);
      form.reset();
    },
  });

  const updateTaskStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "Pending" | "Completed" }) => {
      return await apiRequest("PATCH", `/api/crm/tasks/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/stats"] });
      toast({
        title: "Task Updated",
        description: "Task status has been updated.",
      });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/crm/tasks/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/stats"] });
      toast({
        title: "Task Deleted",
        description: "Task reminder removed successfully.",
      });
    },
  });

  const completeTaskAndLogMutation = useMutation({
    mutationFn: async (data: any) => {
      if (!taskToLog) return;
      
      const { nextCallingDate, ...interactionData } = data;
      const interactionPayload: any = {
        date: interactionData.date,
        type: "Follow-up",
        channel: interactionData.channel,
        notes: interactionData.notes,
        outcome: interactionData.outcome || "",
      };
      
      if (taskToLog.patientId) {
        interactionPayload.patientId = taskToLog.patientId;
      } else if (taskToLog.leadId) {
        interactionPayload.leadId = taskToLog.leadId;
      }
      
      // 1. Log interaction
      await apiRequest("POST", "/api/crm/interactions", interactionPayload);
      
      // 2. Complete task if checked
      if (data.completeTask) {
        await apiRequest("PATCH", `/api/crm/tasks/${taskToLog.id}`, { status: "Completed" });
      }

      // 3. Create next follow-up task if provided
      if (nextCallingDate) {
        await apiRequest("POST", "/api/crm/tasks", {
          description: `Follow-up Call: ${taskToLog.patientName || taskToLog.leadName || "Contact"}`,
          dueDate: nextCallingDate,
          status: "Pending",
          priority: "Medium",
          patientId: taskToLog.patientId,
          leadId: taskToLog.leadId,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/interactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/stats"] });
      toast({
        title: "Call Logged & Task Updated",
        description: "Your contact call has been logged, the current task was updated, and next calling date has been scheduled.",
      });
      setIsTaskLogDialogOpen(false);
      setTaskToLog(null);
      taskInteractionForm.reset({
        date: format(new Date(), "yyyy-MM-dd"),
        channel: "Call",
        notes: "",
        outcome: "",
        completeTask: true,
        nextCallingDate: "",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Failed to log call",
        description: err.message,
        variant: "destructive",
      });
    }
  });

  const filteredTasks = tasks.filter((task) => {
    const matchesSearch = task.description.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = selectedStatus === "All" || task.status === selectedStatus;
    
    const todayStr = format(new Date(), "yyyy-MM-dd");
    let matchesDueDate = true;
    if (selectedDueDateFilter === "Today") {
      matchesDueDate = task.dueDate <= todayStr;
    } else if (selectedDueDateFilter === "Upcoming") {
      matchesDueDate = task.dueDate > todayStr;
    } else if (selectedDueDateFilter === "Custom") {
      if (customFromDate && task.dueDate < customFromDate) {
        matchesDueDate = false;
      }
      if (customToDate && task.dueDate > customToDate) {
        matchesDueDate = false;
      }
    }
    
    return matchesSearch && matchesStatus && matchesDueDate;
  });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "High":
        return "bg-rose-50 text-rose-600 border-rose-200";
      case "Medium":
        return "bg-amber-50 text-amber-600 border-amber-200";
      case "Low":
        return "bg-slate-50 text-slate-500 border-slate-200";
      default:
        return "";
    }
  };

  const isOverdue = (dateStr: string) => {
    const today = new Date().setHours(0, 0, 0, 0);
    return new Date(dateStr).getTime() < today;
  };

  const linkType = form.watch("linkType");

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">CRM Tasks & Follow-ups</h1>
          <p className="text-muted-foreground text-sm">
            Organize customer contact tasks, treatment follow-up calls, and booking confirmations
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Schedule CRM Task
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add CRM Task</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit((data) => createTaskMutation.mutate(data))}
                className="space-y-4"
              >
                <div>
                  <FormLabel>Task Priority</FormLabel>
                  <select
                    className="w-full h-10 border rounded-md px-3 bg-background"
                    {...form.register("priority")}
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>
                <div>
                  <FormLabel>Due Date</FormLabel>
                  <Input type="date" {...form.register("dueDate")} required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <FormLabel>Link Target</FormLabel>
                    <select
                      className="w-full h-10 border rounded-md px-3 bg-background"
                      {...form.register("linkType")}
                    >
                      <option value="None">No Link</option>
                      <option value="Patient">Link Patient</option>
                      <option value="Lead">Link Lead</option>
                    </select>
                  </div>
                  {linkType !== "None" && (
                    <div>
                      <FormLabel>Select {linkType}</FormLabel>
                      <select
                        className="w-full h-10 border rounded-md px-3 bg-background"
                        {...form.register("linkId")}
                        required
                      >
                        <option value="">-- Choose --</option>
                        {linkType === "Patient"
                          ? patients.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} ({p.phone})
                              </option>
                            ))
                          : leads.map((l) => (
                              <option key={l.id} value={l.id}>
                                {l.name} ({l.phone})
                              </option>
                            ))}
                      </select>
                    </div>
                  )}
                </div>
                <div>
                  <FormLabel>Task Description</FormLabel>
                  <Textarea
                    placeholder="e.g. check on patient post treatment..."
                    {...form.register("description")}
                    required
                  />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createTaskMutation.isPending}>
                    {createTaskMutation.isPending ? "Scheduling..." : "Create Task"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filter and Search controls */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex gap-1.5 bg-muted p-1 rounded-lg">
            <Button
              size="sm"
              variant={selectedStatus === "Pending" ? "default" : "ghost"}
              className="text-xs h-8"
              onClick={() => setSelectedStatus("Pending")}
            >
              Pending
            </Button>
            <Button
              size="sm"
              variant={selectedStatus === "Completed" ? "default" : "ghost"}
              className="text-xs h-8"
              onClick={() => setSelectedStatus("Completed")}
            >
              Completed
            </Button>
            <Button
              size="sm"
              variant={selectedStatus === "All" ? "default" : "ghost"}
              className="text-xs h-8"
              onClick={() => setSelectedStatus("All")}
            >
              All Tasks
            </Button>
          </div>

          <div className="flex gap-1.5 bg-muted p-1 rounded-lg">
            <Button
              size="sm"
              variant={selectedDueDateFilter === "All" ? "default" : "ghost"}
              className="text-xs h-8"
              onClick={() => setSelectedDueDateFilter("All")}
            >
              All Dates
            </Button>
            <Button
              size="sm"
              variant={selectedDueDateFilter === "Today" ? "default" : "ghost"}
              className="text-xs h-8"
              onClick={() => setSelectedDueDateFilter("Today")}
            >
              Today
            </Button>
            <Button
              size="sm"
              variant={selectedDueDateFilter === "Upcoming" ? "default" : "ghost"}
              className="text-xs h-8"
              onClick={() => setSelectedDueDateFilter("Upcoming")}
            >
              Upcoming
            </Button>
            <Button
              size="sm"
              variant={selectedDueDateFilter === "Custom" ? "default" : "ghost"}
              className="text-xs h-8"
              onClick={() => setSelectedDueDateFilter("Custom")}
            >
              Custom Range
            </Button>
          </div>

          {selectedDueDateFilter === "Custom" && (
            <div className="flex items-center gap-2 border rounded-lg p-1 bg-muted/30">
              <Input
                type="date"
                value={customFromDate}
                onChange={(e) => setCustomFromDate(e.target.value)}
                className="w-32 h-8 text-xs bg-background border-none shadow-none focus-visible:ring-1"
                placeholder="From"
              />
              <span className="text-[10px] text-muted-foreground font-semibold uppercase">to</span>
              <Input
                type="date"
                value={customToDate}
                onChange={(e) => setCustomToDate(e.target.value)}
                className="w-32 h-8 text-xs bg-background border-none shadow-none focus-visible:ring-1"
                placeholder="To"
              />
              {(customFromDate || customToDate) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setCustomFromDate("");
                    setCustomToDate("");
                  }}
                  className="h-8 px-2 text-xs"
                >
                  Clear
                </Button>
              )}
            </div>
          )}
        </div>

        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tasks..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Tasks List */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="text-center py-12 border rounded-lg bg-card">
          <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-medium mb-1">No Tasks Scheduled</h3>
          <p className="text-muted-foreground text-sm">
            Everything looks caught up! Add a new task reminder if needed.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTasks.map((task) => {
            const isTaskPending = task.status === "Pending";
            const overdue = isTaskPending && isOverdue(task.dueDate);
            const taskInteractions = interactions.filter((i) => {
              if (task.patientId && i.patientId === task.patientId) return true;
              if (task.leadId && i.leadId === task.leadId) return true;
              return false;
            });
            const isExpanded = expandedTasks.includes(task.id) || hoveredTask === task.id;

            return (
              <div key={task.id} className="space-y-2">
                <div
                  className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border bg-card hover-elevate transition-all gap-4 ${
                    overdue ? "border-rose-200 bg-rose-50/20" : ""
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 p-0 mt-0.5"
                      onClick={() => {
                        if (isTaskPending && (task.patientId || task.leadId)) {
                          setTaskToLog(task);
                          taskInteractionForm.reset({
                            date: format(new Date(), "yyyy-MM-dd"),
                            channel: "Call",
                            notes: "",
                            outcome: "",
                            completeTask: true,
                          });
                          setIsTaskLogDialogOpen(true);
                        } else {
                          updateTaskStatusMutation.mutate({
                            id: task.id,
                            status: isTaskPending ? "Completed" : "Pending",
                          });
                        }
                      }}
                    >
                      {!isTaskPending ? (
                        <CheckSquare className="w-5 h-5 text-green-500" />
                      ) : (
                        <Square className="w-5 h-5 text-muted-foreground" />
                      )}
                    </Button>
                    
                    {(task.patientId || task.leadId) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 p-0 mt-0.5 text-muted-foreground relative"
                        onClick={() => toggleTaskExpand(task.id)}
                        onMouseEnter={() => handleMouseEnter(task.id)}
                        onMouseLeave={handleMouseLeave}
                        title="Hover to view logs inline, Click to keep open"
                      >
                        <MessageSquare className={`w-3.5 h-3.5 ${taskInteractions.length > 0 ? "text-primary" : "opacity-40"}`} />
                        {taskInteractions.length > 0 && (
                          <span className="absolute -top-1 -right-1 bg-primary text-[8px] text-primary-foreground rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold">
                            {taskInteractions.length}
                          </span>
                        )}
                      </Button>
                    )}

                    <div className="space-y-1">
                      <p
                        className={`text-sm font-medium ${
                          !isTaskPending ? "line-through text-muted-foreground" : "text-foreground"
                        }`}
                      >
                        {task.description}
                      </p>
                      
                      {/* Date and link targets badges */}
                      <div className="flex flex-wrap items-center gap-2.5 text-xs text-muted-foreground">
                        <span className={`flex items-center gap-1 ${overdue ? "text-rose-600 font-semibold" : ""}`}>
                          <Calendar className="w-3.5 h-3.5" />
                          Due: {format(new Date(task.dueDate), "dd MMM yyyy")}
                          {overdue && " (Overdue)"}
                        </span>

                        {task.patientId && (
                          <span className="flex items-center gap-1 bg-sky-50 text-sky-600 px-1.5 py-0.5 rounded text-[10px] border border-sky-100 font-medium">
                            <LinkIcon className="w-3 h-3" />
                            Patient: {task.patientName}
                          </span>
                        )}

                        {task.leadId && (
                          <span className="flex items-center gap-1 bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded text-[10px] border border-amber-100 font-medium">
                            <LinkIcon className="w-3 h-3" />
                            Lead: {task.leadName}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-auto">
                    <Badge variant="outline" className={getPriorityColor(task.priority)}>
                      {task.priority} Priority
                    </Badge>
                    {isTaskPending && (task.patientId || task.leadId) && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1.5 text-xs text-primary border-primary/20 hover:bg-primary/5"
                        onClick={() => {
                          setTaskToLog(task);
                          taskInteractionForm.reset({
                            date: format(new Date(), "yyyy-MM-dd"),
                            channel: "Call",
                            notes: "",
                            outcome: "",
                            completeTask: true,
                          });
                          setIsTaskLogDialogOpen(true);
                        }}
                        title="Log Call / Interaction"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        Log Call
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        if (confirm("Delete this task reminder permanently?")) {
                          deleteTaskMutation.mutate(task.id);
                        }
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {isExpanded && (task.patientId || task.leadId) && (
                  <div
                    className="p-4 bg-muted/10 border rounded-lg max-w-4xl mx-auto w-full space-y-2"
                    onMouseEnter={() => handleMouseEnter(task.id)}
                    onMouseLeave={handleMouseLeave}
                  >
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-primary" /> Full Communication Logs ({taskInteractions.length})
                    </h4>
                    {taskInteractions.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic font-normal">No communication logs recorded yet.</p>
                    ) : (
                      <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 max-h-48 overflow-y-auto pr-1">
                        {taskInteractions.map((interaction) => (
                          <div key={interaction.id} className="p-3 bg-card border rounded flex flex-col gap-1.5 text-xs relative group">
                            <div className="flex items-center justify-between font-medium">
                              <span className="text-primary">{interaction.type} ({interaction.channel})</span>
                              <div className="flex items-center gap-1">
                                <span className="text-muted-foreground text-[10px]">{format(new Date(interaction.date), "dd MMM yyyy")}</span>
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
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Complete Task & Log Call Dialog */}
      <Dialog open={isTaskLogDialogOpen} onOpenChange={(open) => {
        setIsTaskLogDialogOpen(open);
        if (!open) {
          setTaskToLog(null);
          taskInteractionForm.reset({
            date: format(new Date(), "yyyy-MM-dd"),
            channel: "Call",
            notes: "",
            outcome: "",
            completeTask: true,
            nextCallingDate: "",
          });
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Complete Task & Log Call</DialogTitle>
          </DialogHeader>
          {taskToLog && (
            <Form {...taskInteractionForm}>
              <form
                onSubmit={taskInteractionForm.handleSubmit((data) =>
                  completeTaskAndLogMutation.mutate(data)
                )}
                className="space-y-4"
              >
                <div className="bg-muted/40 p-3 rounded-lg border text-sm space-y-1.5">
                  <p className="font-semibold text-foreground">{taskToLog.description}</p>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>Due: {format(new Date(taskToLog.dueDate), "dd MMM yyyy")}</span>
                    {taskToLog.patientName && (
                      <span className="bg-sky-50 text-sky-600 px-1.5 py-0.5 rounded text-[10px] border border-sky-100 font-medium">
                        Patient: {taskToLog.patientName}
                      </span>
                    )}
                    {taskToLog.leadName && (
                      <span className="bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded text-[10px] border border-amber-100 font-medium">
                        Lead: {taskToLog.leadName}
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <FormLabel>Call Date</FormLabel>
                    <Input type="date" {...taskInteractionForm.register("date")} required />
                  </div>
                  <div>
                    <FormLabel>Interaction Channel</FormLabel>
                    <select
                      className="w-full h-10 border rounded-md px-3 bg-background"
                      {...taskInteractionForm.register("channel")}
                    >
                      <option value="Call">Call</option>
                      <option value="WhatsApp">WhatsApp</option>
                      <option value="Email">Email</option>
                      <option value="In-Person">In-Person</option>
                    </select>
                  </div>
                </div>

                <div>
                  <FormLabel>Call Notes</FormLabel>
                  <Textarea
                    placeholder="Enter call notes or discussion details..."
                    className="min-h-[80px]"
                    {...taskInteractionForm.register("notes")}
                    required
                  />
                </div>

                <div>
                  <FormLabel>Outcome (Optional)</FormLabel>
                  <Input
                    placeholder="e.g. customer wants follow-up next week..."
                    {...taskInteractionForm.register("outcome")}
                  />
                </div>

                <div>
                  <FormLabel>Next Calling Date (Optional)</FormLabel>
                  <Input
                    type="date"
                    {...taskInteractionForm.register("nextCallingDate")}
                  />
                </div>

                <div className="flex items-center gap-2 py-1.5">
                  <input
                    type="checkbox"
                    id="completeTaskCheckbox"
                    className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
                    {...taskInteractionForm.register("completeTask")}
                  />
                  <label htmlFor="completeTaskCheckbox" className="text-sm font-medium text-foreground cursor-pointer select-none">
                    Mark task as completed
                  </label>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsTaskLogDialogOpen(false);
                      setTaskToLog(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={completeTaskAndLogMutation.isPending}>
                    {completeTaskAndLogMutation.isPending ? "Saving..." : "Log & Complete"}
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
