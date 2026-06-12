import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft,
  Phone,
  Calendar,
  FileText,
  Stethoscope,
  Plus,
  User,
  Pencil,
  X,
  Check,
  Trash2,
  Gift,
  MessageSquare,
  CheckSquare,
  Activity,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import type { Patient, Visit, Bill, CRMInteraction, Department, Medicine } from "@shared/schema";
import { insertVisitSchema, insertPatientSchema } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { extractPaginatedData } from "@/lib/utils";
import { format } from "date-fns";
import { z } from "zod";

const t = (text: string) => text;

const addVisitSchema = z.object({
  date: z.string(),
  complaints: z.string().optional().default(""),
  diagnosis: z.string().optional().default(""),
  prescription: z.string().optional().default(""),
});

type AddVisitForm = z.infer<typeof addVisitSchema>;

export default function PatientDetails() {
  const [, params] = useRoute("/patient/:id");
  const patientId = params?.id;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: departmentsResponse } = useQuery({
    queryKey: ["/api/departments"],
  });
  const departments = Array.isArray(departmentsResponse) ? (departmentsResponse as Department[]) : [];

  const { data: medicinesResponse } = useQuery({
    queryKey: ["/api/medicines"],
  });
  const medicines = extractPaginatedData<Medicine>(medicinesResponse);

  const [addVisitConsumed, setAddVisitConsumed] = useState<{ medicineId: string; medicineName: string; quantity: number }[]>([]);
  const [editVisitConsumed, setEditVisitConsumed] = useState<{ medicineId: string; medicineName: string; quantity: number }[]>([]);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isEditingPatient, setIsEditingPatient] = useState(false);
  const [editingVisit, setEditingVisit] = useState<Visit | null>(null);
  const [, setLocation] = useRoute("/patient/:id"); // Used for navigation after delete

  const { data: patient, isLoading: patientLoading } = useQuery<Patient>({
    queryKey: ["/api/patients", patientId],
    enabled: !!patientId,
  });

  const { data: visits = [], isLoading: visitsLoading } = useQuery<Visit[]>({
    queryKey: ["/api/visits", patientId],
    enabled: !!patientId,
  });

  const { data: billsResponse } = useQuery({
    queryKey: ["/api/bills"],
  });
  const bills = extractPaginatedData<Bill>(billsResponse);
  const patientBills = bills
    .filter((b) => b.patientId === patientId)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const [editingInteraction, setEditingInteraction] = useState<CRMInteraction | null>(null);
  const [isCRMDialogOpen, setIsCRMDialogOpen] = useState(false);
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);

  const { data: crmInteractions = [] } = useQuery<CRMInteraction[]>({
    queryKey: [`/api/crm/interactions?patientId=${patientId}`],
    enabled: !!patientId,
  });

  const crmForm = useForm({
    defaultValues: {
      date: format(new Date(), "yyyy-MM-dd"),
      type: "Follow-up",
      channel: "Call",
      notes: "",
      outcome: "",
      nextCallingDate: "",
    }
  });

  const crmTaskForm = useForm({
    defaultValues: {
      dueDate: format(new Date(), "yyyy-MM-dd"),
      description: "",
      priority: "Medium",
    }
  });

  const addInteractionMutation = useMutation({
    mutationFn: async (data: any) => {
      const { nextCallingDate, ...interactionData } = data;
      const interaction = await apiRequest("POST", "/api/crm/interactions", {
        patientId,
        ...interactionData,
      });

      if (nextCallingDate) {
        await apiRequest("POST", "/api/crm/tasks", {
          description: `Follow-up Call: ${patient?.name || "Patient"}`,
          patientId,
          dueDate: nextCallingDate,
          status: "Pending",
          priority: "Medium"
        });
      }
      return interaction;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/crm/interactions?patientId=${patientId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/tasks"] });
      toast({
        title: "Interaction Logged",
        description: "Communication logged successfully.",
      });
      setIsCRMDialogOpen(false);
      crmForm.reset({
        date: format(new Date(), "yyyy-MM-dd"),
        type: "Follow-up",
        channel: "Call",
        notes: "",
        outcome: "",
        nextCallingDate: "",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Failed to log interaction",
        description: err.message,
        variant: "destructive",
      });
    }
  });

  const updateInteractionMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; [key: string]: any }) => {
      const { nextCallingDate, ...interactionData } = data;
      return await apiRequest("PATCH", `/api/crm/interactions/${id}`, {
        ...interactionData,
        patientId: editingInteraction?.patientId || patientId || undefined,
        leadId: editingInteraction?.leadId || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/crm/interactions?patientId=${patientId}`] });
      toast({
        title: "Interaction Updated",
        description: "Communication log has been updated successfully.",
      });
      setIsCRMDialogOpen(false);
      setEditingInteraction(null);
      crmForm.reset({
        date: format(new Date(), "yyyy-MM-dd"),
        type: "Follow-up",
        channel: "Call",
        notes: "",
        outcome: "",
        nextCallingDate: "",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Failed to update interaction",
        description: err.message,
        variant: "destructive",
      });
    }
  });

  const addTaskMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/crm/tasks", {
        patientId,
        ...data,
        status: "Pending",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/tasks"] });
      toast({
        title: "CRM Task Added",
        description: "New CRM reminder has been created.",
      });
      setIsTaskDialogOpen(false);
      crmTaskForm.reset({
        dueDate: format(new Date(), "yyyy-MM-dd"),
        description: "",
        priority: "Medium",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Failed to create CRM task",
        description: err.message,
        variant: "destructive",
      });
    }
  });

  const form = useForm<AddVisitForm>({
    resolver: zodResolver(addVisitSchema),
    defaultValues: {
      date: format(new Date(), "yyyy-MM-dd"),
      complaints: "",
      diagnosis: "",
      prescription: "",
    },
  });

  const patientForm = useForm<z.infer<typeof insertPatientSchema>>({
    resolver: zodResolver(insertPatientSchema),
    defaultValues: {
      name: patient?.name || "",
      phone: patient?.phone || "",
      registrationDate: patient?.registrationDate || format(new Date(), "yyyy-MM-dd"),
      dob: patient?.dob || "",
      status: patient?.status || "Active",
      source: patient?.source || "Walk-in",
      department: patient?.department || "",
    },
  });

  const editForm = useForm<AddVisitForm>({
    resolver: zodResolver(addVisitSchema),
    defaultValues: {
      date: format(new Date(), "yyyy-MM-dd"),
      complaints: "",
      diagnosis: "",
      prescription: "",
    },
  });

  const addVisitMutation = useMutation({
    mutationFn: async (data: AddVisitForm) => {
      return await apiRequest("POST", "/api/visits", {
        patientId,
        ...data,
        consumedMedicines: addVisitConsumed,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/visits", patientId] });
      queryClient.invalidateQueries({ queryKey: ["/api/medicines"] });
      toast({
        title: "Visit Added",
        description: "New visit has been recorded successfully.",
      });
      setIsDialogOpen(false);
      setAddVisitConsumed([]);
      form.reset({
        date: format(new Date(), "yyyy-MM-dd"),
        complaints: "",
        diagnosis: "",
        prescription: "",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Add Visit",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updatePatientMutation = useMutation({
    mutationFn: async (data: z.infer<typeof insertPatientSchema>) => {
      return await apiRequest("PATCH", `/api/patients/${patientId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patients", patientId] });
      queryClient.invalidateQueries({ queryKey: ["/api/patients"] });
      toast({
        title: "Patient Updated",
        description: "Patient information has been updated successfully.",
      });
      setIsEditingPatient(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Update Patient",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateVisitMutation = useMutation({
    mutationFn: async (data: AddVisitForm) => {
      if (!patientId || !editingVisit) throw new Error("No visit selected");
      return await apiRequest("PATCH", `/api/visits/${editingVisit.id}`, {
        patientId,
        ...data,
        consumedMedicines: editVisitConsumed,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/visits", patientId] });
      queryClient.invalidateQueries({ queryKey: ["/api/medicines"] });
      toast({
        title: "Visit Updated",
        description: "Visit details have been updated successfully.",
      });
      handleEditDialogChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Update Visit",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deletePatientMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("DELETE", `/api/patients/${patientId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bills"] });
      queryClient.invalidateQueries({ queryKey: ["/api/visits"] });

      toast({
        title: "Patient Deleted",
        description: "Patient and all associated records have been deleted.",
      });
      window.location.href = "/";
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Delete Patient",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const openEditDialog = (visit: Visit) => {
    setEditingVisit(visit);
    editForm.reset({
      date: visit.date,
      complaints: visit.complaints,
      diagnosis: visit.diagnosis,
      prescription: visit.prescription || "",
    });
    setEditVisitConsumed(visit.consumedMedicines || []);
    setIsEditDialogOpen(true);
  };

  const handleEditDialogChange = (open: boolean) => {
    setIsEditDialogOpen(open);
    if (!open) {
      setEditingVisit(null);
      setEditVisitConsumed([]);
    }
  };

  const sortedVisits = [...visits].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  if (patientLoading || visitsLoading) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="text-center py-12">
          <User className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-1">{"Patient Not Found"}</h3>
          <p className="text-muted-foreground text-sm mb-4">
            {"The patient you're looking for doesn't exist."}
          </p>
          <Link href="/">
            <Button variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4 flex-1">
          <Link href="/">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          {isEditingPatient ? (
            <div className="flex-1">
              <Form
                watch={patientForm.watch as any}
                getValues={patientForm.getValues as any}
                setError={patientForm.setError as any}
                clearErrors={patientForm.clearErrors as any}
                setValue={patientForm.setValue as any}
                trigger={patientForm.trigger as any}
                formState={patientForm.formState as any}
                resetField={patientForm.resetField as any}
                reset={patientForm.reset as any}
                handleSubmit={patientForm.handleSubmit as any}
                control={patientForm.control as any}
                register={patientForm.register as any}
                getFieldState={patientForm.getFieldState as any}
                unregister={patientForm.unregister as any}
                setFocus={patientForm.setFocus as any}
                subscribe={(patientForm as any).subscribe}
              >
                <form
                  onSubmit={patientForm.handleSubmit((data) =>
                    updatePatientMutation.mutate(data)
                  )}
                  className="space-y-3"
                >
                  <FormField
                    control={patientForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input
                            placeholder={t("Patient name")}
                            name={field.name}
                            value={field.value}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                            ref={field.ref}
                            className="text-2xl font-semibold"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={patientForm.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input
                            placeholder={t("Phone number")}
                            name={field.name}
                            value={field.value}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                            ref={field.ref}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={patientForm.control}
                    name="department"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <select
                            className="w-full h-10 border rounded-md px-3 bg-background text-sm"
                            name={field.name}
                            value={field.value}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                            ref={field.ref}
                          >
                            <option value="">Select Department...</option>
                            {departments.map((dept) => (
                              <option key={dept.id} value={dept.name}>
                                {dept.name}
                              </option>
                            ))}
                          </select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex gap-2">
                    <Button
                      type="submit"
                      size="sm"
                      disabled={updatePatientMutation.isPending}
                    >
                      <Check className="w-4 h-4 mr-1" />
                      {updatePatientMutation.isPending ? "Saving..." : "Save"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setIsEditingPatient(false)}
                    >
                      <X className="w-4 h-4 mr-1" />
                      Cancel
                    </Button>
                  </div>
                </form>
              </Form>
            </div>
          ) : (
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h1
                  className="text-2xl font-semibold tracking-tight"
                  data-testid="text-patient-name"
                >
                  {patient?.name}
                </h1>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    patientForm.reset({
                      name: patient?.name || "",
                      phone: patient?.phone || "",
                      registrationDate:
                        patient?.registrationDate || format(new Date(), "yyyy-MM-dd"),
                      dob: patient?.dob || "",
                      status: patient?.status || "Active",
                      source: patient?.source || "Walk-in",
                      department: patient?.department || "",
                    });
                    setIsEditingPatient(true);
                  }}
                  data-testid="button-edit-patient"
                >
                  <Pencil className="w-4 h-4" />
                </Button>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      data-testid="button-delete-patient"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete the patient
                        <strong> {patient?.name}</strong> and all their associated visits,
                        bills, and records from the database.
                        <br /><br />
                        Any paid amounts will also be removed from revenue reports.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        onClick={() => deletePatientMutation.mutate()}
                      >
                        {deletePatientMutation.isPending ? "Deleting..." : "Delete Patient"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
              <div className="flex items-center gap-3 text-muted-foreground text-sm mt-2">
                <span className="flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  {patient?.phone}
                </span>
                <span className="text-border">|</span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  Registered: {format(new Date(patient?.registrationDate || ""), "dd MMM yyyy")}
                </span>
                {patient?.dob && (
                  <>
                    <span className="text-border">|</span>
                    <span className="flex items-center gap-1">
                      <Gift className="w-3 h-3 text-pink-500" />
                      DOB: {format(new Date(patient.dob), "dd MMM yyyy")}
                    </span>
                  </>
                )}
                <span className="text-border">|</span>
                <Badge variant={patient?.status === "VIP" ? "default" : patient?.status === "Inactive" ? "secondary" : "outline"} className={patient?.status === "VIP" ? "bg-amber-500 hover:bg-amber-600 text-white border-transparent" : ""}>
                  {patient?.status}
                </Badge>
                <span className="text-border">|</span>
                <span className="text-xs bg-muted px-2 py-0.5 rounded text-muted-foreground font-medium">
                  Source: {patient?.source}
                </span>
                {patient?.department && (
                  <>
                    <span className="text-border">|</span>
                    <span className="text-xs bg-primary/10 px-2 py-0.5 rounded text-primary font-medium flex items-center gap-1">
                      <Stethoscope className="w-3 h-3 text-primary" />
                      {patient.department}
                    </span>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Two-column layout: Visit History left, Bill + CRM right */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

      {/* Left Column — Visit History (3/5 width) */}
      <div className="lg:col-span-3 space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 pb-4">
          <div>
            <CardTitle className="text-lg">Visit History</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {sortedVisits.length} visit{sortedVisits.length !== 1 ? "s" : ""} recorded
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-visit">
                <Plus className="w-4 h-4 mr-2" />
                Add Visit
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Add New Visit</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit((data) => addVisitMutation.mutate(data))}
                  className="space-y-4"
                >
                  <FormField
                    control={form.control}
                    name="date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Visit Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} data-testid="input-visit-date" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="complaints"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Complaints</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Enter patient's complaints..."
                            className="min-h-[80px] resize-none"
                            {...field}
                            data-testid="input-visit-complaints"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="diagnosis"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Diagnosis</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Enter diagnosis..."
                            className="min-h-[80px] resize-none"
                            {...field}
                            data-testid="input-visit-diagnosis"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="prescription"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Prescription</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Enter prescribed medicines, dosages, and instructions..."
                            className="min-h-[100px] resize-none"
                            {...field}
                            data-testid="input-visit-prescription"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="space-y-3 border-t pt-3">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Consumed Stock Items (Misc. Not Billed)</label>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setAddVisitConsumed([...addVisitConsumed, { medicineId: "", medicineName: "", quantity: 1 }]);
                        }}
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" />
                        Add Item
                      </Button>
                    </div>
                    {addVisitConsumed.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">No items consumed during this visit.</p>
                    ) : (
                      <div className="space-y-2 max-h-[150px] overflow-y-auto pr-1">
                        {addVisitConsumed.map((item, idx) => (
                          <div key={idx} className="flex gap-2 items-center">
                            <select
                              className="flex-1 h-9 border rounded-md px-3 bg-background text-sm"
                              value={item.medicineId}
                              onChange={(e) => {
                                const medId = e.target.value;
                                const med = medicines.find(m => m.id === medId);
                                const updated = [...addVisitConsumed];
                                updated[idx] = {
                                  medicineId: medId,
                                  medicineName: med ? med.name : "",
                                  quantity: item.quantity
                                };
                                setAddVisitConsumed(updated);
                              }}
                            >
                              <option value="">Select Item/Consumable...</option>
                              {medicines.map((m) => (
                                <option key={m.id} value={m.id}>
                                  {m.name} (Stock: {m.quantity})
                                </option>
                              ))}
                            </select>
                            <Input
                              type="number"
                              min="1"
                              className="w-20 h-9"
                              value={item.quantity}
                              onChange={(e) => {
                                const qty = parseInt(e.target.value) || 1;
                                const updated = [...addVisitConsumed];
                                updated[idx].quantity = qty;
                                setAddVisitConsumed(updated);
                              }}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="text-destructive h-9 w-9 shrink-0"
                              onClick={() => {
                                setAddVisitConsumed(addVisitConsumed.filter((_, i) => i !== idx));
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end gap-3 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={addVisitMutation.isPending}
                      data-testid="button-save-visit"
                    >
                      {addVisitMutation.isPending ? "Saving..." : "Save Visit"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {sortedVisits.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No visits recorded yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {sortedVisits.map((visit, index) => (
                <div
                  key={visit.id}
                  className="relative pl-6 pb-6 last:pb-0 border-l-2 border-border last:border-transparent"
                  data-testid={`card-visit-${visit.id}`}
                >
                  <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-primary border-4 border-background" />

                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="font-medium">
                          {format(new Date(visit.date), "dd MMM yyyy")}
                        </span>
                        <Badge variant="secondary">
                          {sortedVisits.length - index === 1 ? "1st" :
                            sortedVisits.length - index === 2 ? "2nd" :
                              sortedVisits.length - index === 3 ? "3rd" :
                                `${sortedVisits.length - index}th`} Visit
                        </Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8"
                        onClick={() => openEditDialog(visit)}
                        data-testid={`button-edit-visit-${visit.id}`}
                      >
                        <Pencil className="w-4 h-4 mr-1" />
                        Edit
                      </Button>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="p-3 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
                          <FileText className="w-4 h-4" />
                          Complaints
                        </div>
                        <p className="text-sm" data-testid={`text-complaints-${visit.id}`}>
                          {visit.complaints}
                        </p>
                      </div>

                      <div className="p-3 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
                          <Stethoscope className="w-4 h-4" />
                          Diagnosis
                        </div>
                        <p className="text-sm" data-testid={`text-diagnosis-${visit.id}`}>
                          {visit.diagnosis}
                        </p>
                      </div>
                    </div>

                    {visit.prescription && (
                      <div className="p-3 rounded-lg bg-emerald-50/50 border border-emerald-100/50 mt-2">
                        <div className="flex items-center gap-2 text-sm font-medium text-emerald-700 mb-2">
                          <FileText className="w-4 h-4 text-emerald-600" />
                          Prescription
                        </div>
                        <p className="text-sm text-foreground/90 whitespace-pre-wrap font-medium">
                          {visit.prescription}
                        </p>
                      </div>
                    )}

                    {/* Show medicines from bills on the same date */}
                    {(() => {
                      const visitDateStr = format(new Date(visit.date), "yyyy-MM-dd");
                      const visitBills = patientBills.filter(
                        (b) => format(new Date(b.date), "yyyy-MM-dd") === visitDateStr && b.medicines.length > 0
                      );
                      if (visitBills.length === 0) return null;
                      const allMedicines = visitBills.flatMap((b) => b.medicines);
                      return (
                        <div className="p-3 rounded-lg bg-primary/5 border border-primary/10 mt-2">
                          <div className="flex items-center gap-2 text-sm font-medium text-primary mb-2">
                            <FileText className="w-4 h-4" />
                            Medicines Given
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {allMedicines.map((m, idx) => (
                              <Badge key={idx} variant="secondary" className="text-xs">
                                {m.medicineName} x{m.quantity}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      );
                    })()}

                    {visit.consumedMedicines && visit.consumedMedicines.length > 0 && (
                      <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/10 mt-2">
                        <div className="flex items-center gap-2 text-sm font-medium text-amber-600 mb-2">
                          <Activity className="w-4 h-4 text-amber-500" />
                          Stock Items Consumed (Misc.)
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {visit.consumedMedicines.map((m, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs border-amber-200 text-amber-700 bg-amber-50/50">
                              {m.medicineName} x{m.quantity}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      </div>

      {/* Right Column — Bill History + CRM (2/5 width) */}
      <div className="lg:col-span-2 space-y-6">

      <Dialog open={isEditDialogOpen} onOpenChange={handleEditDialogChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Visit</DialogTitle>
          </DialogHeader>
          {editingVisit ? (
            <Form {...editForm}>
              <form
                onSubmit={editForm.handleSubmit((data) => updateVisitMutation.mutate(data))}
                className="space-y-4"
              >
                <FormField
                  control={editForm.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Visit Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-edit-visit-date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="complaints"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Complaints</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Update patient's complaints..."
                          className="min-h-[80px] resize-none"
                          {...field}
                          data-testid="input-edit-visit-complaints"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="diagnosis"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Diagnosis</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Update diagnosis..."
                          className="min-h-[80px] resize-none"
                          {...field}
                          data-testid="input-edit-visit-diagnosis"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="prescription"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prescription</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Update prescribed medicines, dosages, and instructions..."
                          className="min-h-[100px] resize-none"
                          {...field}
                          data-testid="input-edit-visit-prescription"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-3 border-t pt-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Consumed Stock Items (Misc. Not Billed)</label>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditVisitConsumed([...editVisitConsumed, { medicineId: "", medicineName: "", quantity: 1 }]);
                      }}
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Add Item
                    </Button>
                  </div>
                  {editVisitConsumed.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">No items consumed during this visit.</p>
                  ) : (
                    <div className="space-y-2 max-h-[150px] overflow-y-auto pr-1">
                      {editVisitConsumed.map((item, idx) => (
                        <div key={idx} className="flex gap-2 items-center">
                          <select
                            className="flex-1 h-9 border rounded-md px-3 bg-background text-sm"
                            value={item.medicineId}
                            onChange={(e) => {
                              const medId = e.target.value;
                              const med = medicines.find(m => m.id === medId);
                              const updated = [...editVisitConsumed];
                              updated[idx] = {
                                medicineId: medId,
                                medicineName: med ? med.name : "",
                                quantity: item.quantity
                              };
                              setEditVisitConsumed(updated);
                            }}
                          >
                            <option value="">Select Item/Consumable...</option>
                            {medicines.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name} (Stock: {m.quantity})
                              </option>
                            ))}
                          </select>
                          <Input
                            type="number"
                            min="1"
                            className="w-20 h-9"
                            value={item.quantity}
                            onChange={(e) => {
                              const qty = parseInt(e.target.value) || 1;
                              const updated = [...editVisitConsumed];
                              updated[idx].quantity = qty;
                              setEditVisitConsumed(updated);
                            }}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="text-destructive h-9 w-9 shrink-0"
                            onClick={() => {
                              setEditVisitConsumed(editVisitConsumed.filter((_, i) => i !== idx));
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleEditDialogChange(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={updateVisitMutation.isPending}
                    data-testid="button-save-visit-edit"
                  >
                    {updateVisitMutation.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </form>
            </Form>
          ) : (
            <p className="text-sm text-muted-foreground">Select a visit to edit.</p>
          )}
        </DialogContent>
      </Dialog>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 pb-4">
          <div>
            <CardTitle className="text-lg">Bill History</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {patientBills.length} bill{patientBills.length !== 1 ? "s" : ""} generated
            </p>
          </div>
        </CardHeader>
        <CardContent>
          {patientBills.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No bills generated yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {patientBills.map((bill) => (
                <div
                  key={bill.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card hover-elevate"
                  data-testid={`card-bill-${bill.id}`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {format(new Date(bill.date), "dd MMM yyyy")}
                      </span>
                      <Badge variant={bill.pendingAmount > 0 ? "destructive" : "outline"} className={bill.pendingAmount === 0 ? "text-green-600 border-green-200 bg-green-50" : ""}>
                        {bill.pendingAmount > 0 ? "Pending" : "Paid"}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {bill.treatments.length} Treatments, {bill.medicines.length} Medicines
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-lg">
                      ₹{bill.finalAmount.toFixed(2)}
                    </div>
                    {bill.discount > 0 && (
                      <div className="text-xs text-muted-foreground line-through">
                        ₹{bill.grandTotal.toFixed(2)}
                      </div>
                    )}
                    {bill.pendingAmount > 0 && (
                      <div className="text-sm text-destructive font-medium">
                        Due: ₹{bill.pendingAmount.toFixed(2)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 pb-4">
          <div>
            <CardTitle className="text-lg">CRM History & Follow-ups</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {crmInteractions.length} interaction{crmInteractions.length !== 1 ? "s" : ""} logged
            </p>
          </div>
          <div className="flex gap-2">
            <Dialog open={isCRMDialogOpen} onOpenChange={(open) => {
              setIsCRMDialogOpen(open);
              if (!open) {
                setEditingInteraction(null);
                crmForm.reset({
                  date: format(new Date(), "yyyy-MM-dd"),
                  type: "Follow-up",
                  channel: "Call",
                  notes: "",
                  outcome: "",
                  nextCallingDate: "",
                });
              }
            }}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" onClick={() => setIsCRMDialogOpen(true)}>
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Log Contact
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>{editingInteraction ? t("Edit CRM Interaction") : t("Log CRM Interaction")}</DialogTitle>
                </DialogHeader>
                <form
                  onSubmit={crmForm.handleSubmit((data) => {
                    if (editingInteraction) {
                      updateInteractionMutation.mutate({ id: editingInteraction.id, ...data });
                    } else {
                      addInteractionMutation.mutate(data);
                    }
                  })}
                  className="space-y-4"
                >
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wider block mb-1">{t("Date")}</label>
                      <Input
                        type="date"
                        name={crmForm.register("date").name}
                        onChange={crmForm.register("date").onChange}
                        onBlur={crmForm.register("date").onBlur}
                        ref={crmForm.register("date").ref}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wider block mb-1">{t("Channel")}</label>
                      <select
                        className="w-full h-10 border rounded-md px-3 bg-background"
                        name={crmForm.register("channel").name}
                        onChange={crmForm.register("channel").onChange}
                        onBlur={crmForm.register("channel").onBlur}
                        ref={crmForm.register("channel").ref}
                      >
                        <option value="Call">{t("Call")}</option>
                        <option value="WhatsApp">{t("WhatsApp")}</option>
                        <option value="Email">{t("Email")}</option>
                        <option value="In-Person">{t("In-Person")}</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider block mb-1">{t("Interaction Type")}</label>
                    <select
                      className="w-full h-10 border rounded-md px-3 bg-background"
                      name={crmForm.register("type").name}
                      onChange={crmForm.register("type").onChange}
                      onBlur={crmForm.register("type").onBlur}
                      ref={crmForm.register("type").ref}
                    >
                      <option value="Follow-up">{t("Follow-up")}</option>
                      <option value="Inquiry">{t("Inquiry")}</option>
                      <option value="Treatment Feedback">{t("Treatment Feedback")}</option>
                      <option value="Appointment Confirmation">{t("Appointment Confirmation")}</option>
                      <option value="Birthday Wish">{t("Birthday Wish")}</option>
                      <option value="Complaint">{t("Complaint")}</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider block mb-1">{t("Notes")}</label>
                    <Textarea
                      placeholder={t("Interaction details...")}
                      className="min-h-[80px]"
                      name={crmForm.register("notes").name}
                      onChange={crmForm.register("notes").onChange}
                      onBlur={crmForm.register("notes").onBlur}
                      ref={crmForm.register("notes").ref}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider block mb-1">{t("Outcome (Optional)")}</label>
                    <Input
                      placeholder={t("e.g., patient booked appointment, will call back later...")}
                      name={crmForm.register("outcome").name}
                      onChange={crmForm.register("outcome").onChange}
                      onBlur={crmForm.register("outcome").onBlur}
                      ref={crmForm.register("outcome").ref}
                    />
                  </div>
                  {!editingInteraction && (
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wider block mb-1">{t("Next Calling Date (Optional)")}</label>
                      <Input
                        type="date"
                        name={crmForm.register("nextCallingDate").name}
                        onChange={crmForm.register("nextCallingDate").onChange}
                        onBlur={crmForm.register("nextCallingDate").onBlur}
                        ref={crmForm.register("nextCallingDate").ref}
                      />
                    </div>
                  )}
                  <div className="flex justify-end gap-3 pt-2">
                    <Button type="button" variant="outline" onClick={() => setIsCRMDialogOpen(false)}>{t("Cancel")}</Button>
                    <Button type="submit" disabled={addInteractionMutation.isPending || updateInteractionMutation.isPending}>
                      {addInteractionMutation.isPending || updateInteractionMutation.isPending ? t("Saving...") : t("Save")}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>

            <Dialog open={isTaskDialogOpen} onOpenChange={setIsTaskDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <CheckSquare className="w-4 h-4 mr-2" />
                  Add Task
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>{t("Add CRM Follow-up Task")}</DialogTitle>
                </DialogHeader>
                <form onSubmit={crmTaskForm.handleSubmit((data) => addTaskMutation.mutate(data))} className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider block mb-1">{t("Due Date")}</label>
                    <Input
                      type="date"
                      name={crmTaskForm.register("dueDate").name}
                      onChange={crmTaskForm.register("dueDate").onChange}
                      onBlur={crmTaskForm.register("dueDate").onBlur}
                      ref={crmTaskForm.register("dueDate").ref}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider block mb-1">{t("Task Priority")}</label>
                    <select
                      className="w-full h-10 border rounded-md px-3 bg-background"
                      name={crmTaskForm.register("priority").name}
                      onChange={crmTaskForm.register("priority").onChange}
                      onBlur={crmTaskForm.register("priority").onBlur}
                      ref={crmTaskForm.register("priority").ref}
                    >
                      <option value="Low">{t("Low")}</option>
                      <option value="Medium">{t("Medium")}</option>
                      <option value="High">{t("High")}</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider block mb-1">{t("Task Description")}</label>
                    <Textarea
                      placeholder={t("e.g., call patient to check recovery post chemical peel...")}
                      className="min-h-[80px]"
                      name={crmTaskForm.register("description").name}
                      onChange={crmTaskForm.register("description").onChange}
                      onBlur={crmTaskForm.register("description").onBlur}
                      ref={crmTaskForm.register("description").ref}
                      required
                    />
                  </div>
                  <div className="flex justify-end gap-3 pt-2">
                    <Button type="button" variant="outline" onClick={() => setIsTaskDialogOpen(false)}>{t("Cancel")}</Button>
                    <Button type="submit" disabled={addTaskMutation.isPending}>
                      {addTaskMutation.isPending ? t("Creating...") : t("Create Task")}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {crmInteractions.length === 0 ? (
            <div className="text-center py-8">
              <MessageSquare className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No interactions logged yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {crmInteractions.map((interaction) => (
                <div key={interaction.id} className="p-4 rounded-lg border bg-card relative hover-elevate">
                  <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
                        {interaction.type}
                      </Badge>
                      <Badge variant="secondary" className="text-xs font-normal">
                        {interaction.channel}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                        onClick={() => {
                          setEditingInteraction(interaction);
                          crmForm.reset({
                            date: interaction.date,
                            type: interaction.type,
                            channel: interaction.channel,
                            notes: interaction.notes,
                            outcome: interaction.outcome || "",
                            nextCallingDate: "",
                          });
                          setIsCRMDialogOpen(true);
                        }}
                        title={t("Edit Log")}
                      >
                        <Pencil className="w-3 h-3" />
                      </Button>
                    </div>
                    <span className="text-xs text-muted-foreground font-medium">
                      {format(new Date(interaction.date), "dd MMM yyyy")}
                    </span>
                  </div>
                  <p className="text-sm font-normal text-foreground mb-1">
                    {interaction.notes}
                  </p>
                  {interaction.outcome && (
                    <div className="text-xs text-muted-foreground mt-2 border-t pt-2 flex items-center gap-1.5">
                      <span className="font-semibold">Outcome:</span>
                      <span>{interaction.outcome}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      </div>
      </div>
    </div>
  );
}
