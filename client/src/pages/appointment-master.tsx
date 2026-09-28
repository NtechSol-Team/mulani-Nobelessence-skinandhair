
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
    Calendar as CalendarIcon,
    Plus,
    Search,
    Edit2,
    Trash2,
    User,
    Clock,
    CheckCircle2,
    XCircle,
    AlertCircle,
    MessageCircle,
    UserX,
    RefreshCw,
    Phone,
    ChevronDown,
    Stethoscope
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import type { Appointment, Patient, Department } from "@shared/schema";
import { extractPaginatedData } from "@/lib/utils";
import { insertAppointmentSchema, APPOINTMENT_STATUSES, type AppointmentStatus } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { format, addDays, parseISO, differenceInCalendarDays } from "date-fns";
import { z } from "zod";

const appointmentFormSchema = z.object({
    isNewPatient: z.boolean().default(false),
    patientId: z.string().optional(),
    newPatientName: z.string().optional(),
    newPatientPhone: z.string().optional(),
    date: z.string(),
    time: z.string().default("09:00"),
    reason: z.string().optional().default(""),
    status: z.enum(APPOINTMENT_STATUSES).default("Scheduled"),
    type: z.enum(["New", "Follow-up"]).default("New"),
    department: z.string().optional().default(""),
}).superRefine((data, ctx) => {
    if (data.isNewPatient) {
        if (!data.newPatientName || data.newPatientName.trim().length === 0) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Patient Name is required",
                path: ["newPatientName"],
            });
        }
        if (!data.newPatientPhone || !/^\d{10}$/.test(data.newPatientPhone)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Phone number must be exactly 10 digits",
                path: ["newPatientPhone"],
            });
        }
    } else {
        if (!data.patientId || data.patientId.trim().length === 0) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Patient selection is required",
                path: ["patientId"],
            });
        }
    }
});

type AppointmentForm = z.infer<typeof appointmentFormSchema>;

// Convert 24h "16:00" to "4:00 PM"; falls back to the raw value if it can't be parsed.
function formatTime12h(time: string): string {
    const [hours, minutes] = (time || "").split(":");
    const hour = parseInt(hours, 10);
    if (Number.isNaN(hour) || minutes === undefined) return time;
    return `${hour % 12 || 12}:${minutes} ${hour >= 12 ? "PM" : "AM"}`;
}

function openWhatsAppChat(rawPhone: string, message: string) {
    let phone = rawPhone.replace(/\D/g, "");
    if (phone.length === 10) {
        phone = "91" + phone;
    }
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank");
}

export default function AppointmentMaster() {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedDate, setSelectedDate] = useState("");
    const [dateFilter, setDateFilter] = useState<"today" | "tomorrow" | "all" | "custom">("today");
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
    const [deletingAppointment, setDeletingAppointment] = useState<Appointment | null>(null);
    // Set while the dialog is re-booking a patient who did not come; the source is marked "Rescheduled" once the new one is saved.
    const [reappointSource, setReappointSource] = useState<Appointment | null>(null);
    // The Not Come section starts collapsed; the header still shows the count and a "Follow-up Needed" badge.
    const [isNotComeOpen, setIsNotComeOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const { data: appointmentsResponse, isLoading } = useQuery({
        queryKey: ["/api/appointments"],
    });
    // Since api returns array directly based on my implementation
    const appointments = Array.isArray(appointmentsResponse) ? appointmentsResponse : [];

    const { data: patientsResponse, isLoading: patientsLoading } = useQuery({
        queryKey: ["/api/patients"],
    });
    const patients = extractPaginatedData<Patient>(patientsResponse);

    const { data: departmentsResponse } = useQuery({
        queryKey: ["/api/departments"],
    });
    const departments = extractPaginatedData<Department>(departmentsResponse);
    const [departmentFilter, setDepartmentFilter] = useState<string>("all");

    const form = useForm<any>({
        resolver: zodResolver(appointmentFormSchema),
        defaultValues: {
            isNewPatient: false,
            patientId: "",
            newPatientName: "",
            newPatientPhone: "",
            date: format(new Date(), "yyyy-MM-dd"),
            time: "09:00",
            reason: "",
            status: "Scheduled",
            type: "New",
            department: "",
        },
    });

    const createMutation = useMutation({
        mutationFn: async (data: any) => {
            return await apiRequest("POST", "/api/appointments", data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
            toast(reappointSource ? {
                title: "Patient Re-appointed",
                description: `${reappointSource.patientName || "Patient"} has a new appointment. The missed one is marked as Rescheduled.`,
            } : {
                title: "Appointment Scheduled",
                description: "New appointment has been successfully created.",
            });
            closeDialog();
        },
        onError: (error: Error) => {
            toast({
                title: "Failed to Schedule",
                description: error.message,
                variant: "destructive",
            });
        },
    });

    const updateMutation = useMutation({
        mutationFn: async ({ id, data }: { id: string; data: any }) => {
            return await apiRequest("PATCH", `/api/appointments/${id}`, data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
            toast({
                title: "Appointment Updated",
                description: "Appointment details have been updated.",
            });
            closeDialog();
        },
        onError: (error: Error) => {
            toast({
                title: "Failed to Update",
                description: error.message,
                variant: "destructive",
            });
        },
    });

    // Quick status change from a card/row (Not Come, Came, Rescheduled) without opening the edit dialog.
    const statusMutation = useMutation({
        mutationFn: async ({ appt, status }: { appt: Appointment; status: AppointmentStatus; silent?: boolean }) => {
            return await apiRequest("PATCH", `/api/appointments/${appt.id}`, {
                patientId: appt.patientId,
                date: appt.date,
                time: appt.time,
                reason: appt.reason,
                status,
                type: appt.type || "New",
                department: appt.department || "",
            });
        },
        onSuccess: (_data, { appt, status, silent }) => {
            queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
            if (silent) return;
            const name = appt.patientName || "Patient";
            toast(
                status === "No Show"
                    ? { title: "Marked as Not Come", description: `${name} moved to the Not Come list. Re-appoint from there.` }
                    : status === "Completed"
                        ? { title: "Marked as Completed", description: `${name}'s appointment is completed.` }
                        : { title: "Appointment Updated", description: "Status has been updated." },
            );
        },
        onError: (error: Error) => {
            toast({
                title: "Failed to Update",
                description: error.message,
                variant: "destructive",
            });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            return await apiRequest("DELETE", `/api/appointments/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
            toast({
                title: "Appointment Cancelled",
                description: "Appointment has been removed.",
            });
            setDeletingAppointment(null);
        },
        onError: (error: Error) => {
            toast({
                title: "Failed to Delete",
                description: error.message,
                variant: "destructive",
            });
        },
    });

    const closeDialog = () => {
        setIsDialogOpen(false);
        setEditingAppointment(null);
        setReappointSource(null);
        form.reset({
            isNewPatient: false,
            patientId: "",
            newPatientName: "",
            newPatientPhone: "",
            date: format(new Date(), "yyyy-MM-dd"),
            time: "09:00",
            reason: "",
            status: "Scheduled",
            type: "New",
            department: "None",
        });
    };

    const openEditDialog = (appointment: Appointment) => {
        setEditingAppointment(appointment);
        const patient = patients.find(p => p.id === appointment.patientId);
        const deptToSet = (appointment.department && appointment.department !== "None" && appointment.department !== "")
            ? appointment.department
            : (patient?.department && patient.department !== "None" && patient.department !== "")
                ? patient.department
                : "None";
        form.reset({
            isNewPatient: false,
            patientId: appointment.patientId,
            newPatientName: "",
            newPatientPhone: "",
            date: appointment.date,
            time: appointment.time,
            reason: appointment.reason,
            status: appointment.status as AppointmentStatus,
            type: appointment.type || "New",
            department: deptToSet,
        });
        setIsDialogOpen(true);
    };

    // Re-book a patient who did not come: new appointment (default tomorrow), same patient/time/reason.
    const openReappointDialog = (appointment: Appointment) => {
        setEditingAppointment(null);
        setReappointSource(appointment);
        const patient = patients.find(p => p.id === appointment.patientId);
        const deptToSet = (appointment.department && appointment.department !== "None" && appointment.department !== "")
            ? appointment.department
            : (patient?.department && patient.department !== "None" && patient.department !== "")
                ? patient.department
                : "None";
        form.reset({
            isNewPatient: false,
            patientId: appointment.patientId,
            newPatientName: "",
            newPatientPhone: "",
            date: format(addDays(new Date(), 1), "yyyy-MM-dd"),
            time: appointment.time,
            reason: appointment.reason,
            status: "Scheduled",
            type: appointment.type || "New",
            department: deptToSet,
        });
        setIsDialogOpen(true);
    };

    const onSubmit = async (data: AppointmentForm) => {
        try {
            setIsSubmitting(true);
            const source = reappointSource; // closeDialog() clears it when the create succeeds
            let patientIdToUse = data.patientId;

            const chosenDept = data.department && data.department !== "None" ? data.department : "";

            if (data.isNewPatient && !editingAppointment) {
                // Register new patient
                const patientData = {
                    name: data.newPatientName!,
                    phone: data.newPatientPhone!,
                    registrationDate: format(new Date(), "yyyy-MM-dd"),
                    dob: "",
                    status: "Active" as const,
                    source: "Walk-in" as const,
                    department: chosenDept,
                };
                const response = await apiRequest("POST", "/api/patients", patientData);
                const newPatient = await response.json();
                patientIdToUse = newPatient.id;

                queryClient.invalidateQueries({ queryKey: ["/api/patients"] });
            }

            const appointmentData = {
                patientId: patientIdToUse!,
                date: data.date,
                time: data.time,
                reason: data.reason,
                status: data.status,
                type: data.type,
                department: chosenDept,
            };

            if (editingAppointment) {
                await updateMutation.mutateAsync({ id: editingAppointment.id, data: appointmentData }).catch(() => {});
            } else {
                const created = await createMutation.mutateAsync(appointmentData).then(() => true).catch(() => false);
                if (created && source) {
                    // Only after the new appointment exists, so a failed save never loses the missed one.
                    await statusMutation.mutateAsync({ appt: source, status: "Rescheduled", silent: true }).catch(() => {});
                }
            }
        } catch (error: any) {
            toast({
                title: "Error Scheduling Appointment",
                description: error.message || "An error occurred",
                variant: "destructive",
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const getApptDept = (appt: Appointment) => {
        if (appt.department && appt.department.trim() !== "" && appt.department !== "None") {
            return appt.department;
        }
        const patient = patients.find(p => p.id === appt.patientId);
        if (patient?.department && patient.department.trim() !== "" && patient.department !== "None") {
            return patient.department;
        }
        return "General / Unassigned";
    };

    const filteredAppointments = appointments.filter((appt: Appointment) => {
        const patientName = appt.patientName || patients.find(p => p.id === appt.patientId)?.name || "";
        const matchesSearch =
            patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            appt.reason.toLowerCase().includes(searchQuery.toLowerCase());
        
        const todayStr = format(new Date(), "yyyy-MM-dd");
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = format(tomorrow, "yyyy-MM-dd");

        let matchesDate = true;
        if (dateFilter === "today") {
            matchesDate = appt.date === todayStr;
        } else if (dateFilter === "tomorrow") {
            matchesDate = appt.date === tomorrowStr;
        } else if (dateFilter === "custom") {
            matchesDate = !selectedDate || appt.date === selectedDate;
        } // if dateFilter is "all", matchesDate is true

        const matchesDepartment = departmentFilter === "all" || getApptDept(appt) === departmentFilter;

        return matchesSearch && matchesDate && matchesDepartment;
    });

    const todayStr = format(new Date(), "yyyy-MM-dd");

    // A patient who did not come. Staff mark this explicitly (Today's card, or a past row in the list) -
    // we don't guess from the date, because most past appointments are simply never ticked as completed.
    // These leave the normal lists and are tracked in the Not Come section instead.
    const isMissed = (a: Appointment) => a.status === "No Show";

    const todaysAppointments = appointments.filter(
        a => a.date === todayStr && a.status !== "No Show" && a.status !== "Rescheduled" && (departmentFilter === "all" || getApptDept(a) === departmentFilter)
    );

    // Group today's appointments by department category for category-wise bifurcation
    const todaysByDept = todaysAppointments.reduce((groups: Record<string, Appointment[]>, appt) => {
        const deptName = getApptDept(appt);
        if (!groups[deptName]) {
            groups[deptName] = [];
        }
        groups[deptName].push(appt);
        return groups;
    }, {});

    const missedAppointments = appointments
        .filter(isMissed)
        .sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time));

    // How often each patient has missed an appointment (Not Come + ones already re-booked), for tracking repeat no-shows.
    const missCountByPatient = appointments.reduce((acc: Record<string, number>, a) => {
        if (a.status === "No Show" || a.status === "Rescheduled") {
            acc[a.patientId] = (acc[a.patientId] || 0) + 1;
        }
        return acc;
    }, {});

    // Split and sort appointments chronologically / reverse-chronologically
    const upcomingAppointments = filteredAppointments
        .filter(a => a.isUpcoming && !isMissed(a) && a.status !== "Rescheduled")
        .sort((a, b) => {
            const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
            if (dateDiff !== 0) return dateDiff;
            return a.time.localeCompare(b.time);
        });

    const pastAppointments = filteredAppointments
        .filter(a => !isMissed(a) && (!a.isUpcoming || a.status === "Rescheduled"))
        .sort((a, b) => {
            const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
            if (dateDiff !== 0) return dateDiff;
            return b.time.localeCompare(a.time);
        });

    // Helper to format date headers nicely
    const formatDateHeader = (dateStr: string) => {
        const todayStr = format(new Date(), "yyyy-MM-dd");
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = format(tomorrow, "yyyy-MM-dd");

        if (dateStr === todayStr) {
            return `Today - ${format(new Date(dateStr), "EEEE, dd MMM yyyy")}`;
        } else if (dateStr === tomorrowStr) {
            return `Tomorrow - ${format(new Date(dateStr), "EEEE, dd MMM yyyy")}`;
        }
        return format(new Date(dateStr), "EEEE, dd MMM yyyy");
    };

    // Group upcoming appointments by date for chronological display
    const groupedUpcoming = upcomingAppointments.reduce((groups: Record<string, Appointment[]>, appt) => {
        const dateKey = appt.date;
        if (!groups[dateKey]) {
            groups[dateKey] = [];
        }
        groups[dateKey].push(appt);
        return groups;
    }, {});

    const sendWhatsApp = (appt: Appointment) => {
        const patient = patients.find(p => p.id === appt.patientId);
        if (!patient) {
            toast({
                title: "Error",
                description: "Patient details not found",
                variant: "destructive"
            });
            return;
        }

        // Format: Your appointment has been confirmed for 23 December 2025 at 04:00 PM at Primecare Skin & Health. Please arrive 10 minutes early. We look forward to seeing you!
        const dateStr = format(new Date(appt.date), "d MMMM yyyy");

        const timeStr = formatTime12h(appt.time);

        const message = `Hello ${patient.name},

Your appointment has been confirmed for ${dateStr} at ${timeStr} at Primecare Skin & Health.
Please arrive 10 minutes early. We look forward to seeing you!

Warm regards,
Primecare Skin & Health`;
        openWhatsAppChat(patient.phone, message);
    };

    // "We missed you" follow-up for a patient who did not come.
    const sendMissedWhatsApp = (appt: Appointment) => {
        const patient = patients.find(p => p.id === appt.patientId);
        if (!patient) {
            toast({
                title: "Error",
                description: "Patient details not found",
                variant: "destructive"
            });
            return;
        }

        const dateStr = format(new Date(appt.date), "d MMMM yyyy");
        const message = `Hello ${patient.name},

We missed you at your appointment on ${dateStr} at ${formatTime12h(appt.time)} at Primecare Skin & Health.
Would you like to reschedule? Please reply with a date and time that suits you and we will book it for you.

Warm regards,
Primecare Skin & Health`;
        openWhatsAppChat(patient.phone, message);
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "Scheduled":
                return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200">Scheduled</Badge>;
            case "Completed":
                return <Badge className="bg-green-100 text-green-800 hover:bg-green-200">Completed</Badge>;
            case "Cancelled":
                return <Badge className="bg-red-100 text-red-800 hover:bg-red-200">Cancelled</Badge>;
            case "No Show":
                return <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-200">Not Come</Badge>;
            case "Rescheduled":
                return <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-200">Rescheduled</Badge>;
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };

    return (
        <div className="p-6 max-w-[1600px] mx-auto space-y-6">
            <div className="flex flex-col gap-2">
                <h1 className="text-2xl font-semibold tracking-tight">
                    Upcoming Appointment Master
                </h1>
                <p className="text-muted-foreground">
                    Manage patient appointments and schedules
                </p>
            </div>

            {/* Today's Appointment Module - Highlighted */}
            <Card className="border-l-4 border-l-blue-600 shadow-md">
                <CardHeader className="pb-3 bg-blue-50/50">
                    <CardTitle className="text-lg font-medium flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <CalendarIcon className="w-5 h-5 text-blue-600" />
                            Today's Appointments ({todaysAppointments.length}) {departmentFilter !== "all" && <span className="text-sm font-normal text-blue-700">({departmentFilter})</span>}
                        </div>
                        <Badge variant={todaysAppointments.length > 0 ? "default" : "secondary"}>
                            {todaysAppointments.length > 0 ? "Action Required" : "No Appointments"}
                        </Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                    {todaysAppointments.length === 0 ? (
                        <div className="text-center py-4 text-muted-foreground">
                            No appointments scheduled for today.
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {Object.entries(todaysByDept).map(([deptName, deptAppts]) => (
                                <div key={deptName} className="space-y-3">
                                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground/90 border-b border-border/60 pb-1.5 pt-1">
                                        <Stethoscope className="w-4 h-4 text-indigo-600" />
                                        <span>{deptName}</span>
                                        <Badge variant="secondary" className="text-xs font-normal bg-indigo-50 text-indigo-700 border border-indigo-200">
                                            {deptAppts.length} {deptAppts.length === 1 ? "appointment" : "appointments"}
                                        </Badge>
                                    </div>
                                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                        {deptAppts.map((appt) => (
                                            <div key={appt.id} className="p-3 border rounded-md bg-card flex flex-col gap-3 shadow-sm hover:border-blue-200 transition-colors">
                                                <div className="flex justify-between items-start gap-2">
                                                    <div className="flex items-start gap-2.5">
                                                        {/* Tickbox to complete */}
                                                        <div className="pt-0.5">
                                                            <input
                                                                type="checkbox"
                                                                checked={appt.status === "Completed"}
                                                                disabled={appt.status === "Completed" || updateMutation.isPending}
                                                                onChange={async (e) => {
                                                                    if (e.target.checked) {
                                                                        const appointmentData = {
                                                                            patientId: appt.patientId,
                                                                            date: appt.date,
                                                                            time: appt.time,
                                                                            reason: appt.reason,
                                                                            status: "Completed",
                                                                            type: appt.type,
                                                                            department: appt.department,
                                                                        };
                                                                        await updateMutation.mutateAsync({ id: appt.id, data: appointmentData }).catch(() => {});
                                                                    }
                                                                }}
                                                                className="h-4.5 w-4.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer disabled:cursor-not-allowed"
                                                            />
                                                        </div>
                                                        <div>
                                                            <div className={`font-medium flex items-center gap-1.5 ${appt.status === "Completed" ? "line-through text-muted-foreground" : ""}`}>
                                                                <span>{appt.patientName || patients.find(p => p.id === appt.patientId)?.name || "Unknown Patient"}</span>
                                                                {appt.type && (
                                                                    <Badge variant="outline" className={`text-[9px] px-1 py-0 h-4 ${
                                                                        appt.type === "Follow-up"
                                                                            ? "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-50"
                                                                            : "bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-50"
                                                                    }`}>
                                                                        {appt.type}
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                            <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                                                <Clock className="w-3 h-3 text-muted-foreground" />
                                                                {appt.time}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <Badge variant="outline" className={
                                                        appt.status === "Scheduled" ? "bg-blue-50 text-blue-700 border-blue-200" :
                                                            appt.status === "Completed" ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-100"
                                                    }>{appt.status}</Badge>
                                                </div>
                                                
                                                {appt.reason && (
                                                    <div className="text-xs text-muted-foreground bg-muted/30 p-2 rounded" title={appt.reason}>
                                                        <span className="font-semibold text-foreground/70 mr-1">Reason:</span>
                                                        {appt.reason}
                                                    </div>
                                                )}

                                                {/* Action Buttons: Not Come, Reschedule & Edit */}
                                                <div className="flex gap-2 justify-end pt-1 border-t border-border/40">
                                                    {appt.status === "Scheduled" && (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="h-7 text-xs px-2 flex items-center gap-1 text-orange-700 hover:bg-orange-50 hover:text-orange-700 hover:border-orange-200"
                                                            disabled={statusMutation.isPending}
                                                            title="Patient did not come - move to the Not Come list"
                                                            onClick={() => statusMutation.mutate({ appt, status: "No Show" })}
                                                        >
                                                            <UserX className="w-3 h-3" />
                                                            Not Come
                                                        </Button>
                                                    )}
                                                    {appt.status !== "Completed" && (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="h-7 text-xs px-2 flex items-center gap-1 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200"
                                                            onClick={() => openEditDialog(appt)}
                                                        >
                                                            <Clock className="w-3 h-3" />
                                                            Reschedule
                                                        </Button>
                                                    )}
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground"
                                                        onClick={() => openEditDialog(appt)}
                                                    >
                                                        Edit Details
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Not Come / Pending Re-appointment - patients who missed their appointment */}
            <Collapsible open={isNotComeOpen} onOpenChange={setIsNotComeOpen}>
            <Card className="border-l-4 border-l-orange-500 shadow-md">
                <CardHeader className="p-0 bg-orange-50/50">
                    <CollapsibleTrigger className="group w-full text-left px-6 py-4 flex items-center justify-between gap-3 hover:bg-orange-50 transition-colors rounded-tr-lg">
                        <span className="flex flex-col gap-1">
                            <span className="text-lg font-medium flex items-center gap-2">
                                <UserX className="w-5 h-5 text-orange-600" />
                                Not Come / Pending Re-appointment ({missedAppointments.length})
                            </span>
                            <span className="text-xs text-muted-foreground">
                                Patients who did not come. Call or message them, then re-appoint so they are not lost.
                            </span>
                        </span>
                        <span className="flex items-center gap-3 shrink-0">
                            <Badge variant={missedAppointments.length > 0 ? "destructive" : "secondary"}>
                                {missedAppointments.length > 0 ? "Follow-up Needed" : "All Clear"}
                            </Badge>
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <span className="group-data-[state=open]:hidden">Show</span>
                                <span className="hidden group-data-[state=open]:inline">Hide</span>
                                <ChevronDown className="w-4 h-4 transition-transform group-data-[state=open]:rotate-180" />
                            </span>
                        </span>
                    </CollapsibleTrigger>
                </CardHeader>
                <CollapsibleContent>
                <CardContent className="pt-4">
                    {missedAppointments.length === 0 ? (
                        <div className="text-center py-4 text-muted-foreground">
                            No missed appointments. Patients you mark as "Not Come" appear here, ready to re-appoint.
                        </div>
                    ) : (
                        <div className="border rounded-lg overflow-hidden max-h-[28rem] overflow-y-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Patient</TableHead>
                                        <TableHead>Missed Appointment</TableHead>
                                        <TableHead>Reason</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {missedAppointments.map((appt) => {
                                        const patient = patients.find(p => p.id === appt.patientId);
                                        const daysAgo = differenceInCalendarDays(new Date(), parseISO(appt.date));
                                        const missCount = missCountByPatient[appt.patientId] || 0;
                                        return (
                                            <TableRow key={appt.id}>
                                                <TableCell>
                                                    <div className="flex flex-col gap-0.5">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className="font-medium">{appt.patientName || patient?.name || "Unknown Patient"}</span>
                                                            {missCount >= 2 && (
                                                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 bg-red-50 text-red-700 border-red-200 hover:bg-red-50">
                                                                    Missed x{missCount}
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        {patient?.phone && (
                                                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                                <Phone className="w-3 h-3" />
                                                                {patient.phone}
                                                            </span>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span>{format(parseISO(appt.date), "dd MMM yyyy")} - {appt.time}</span>
                                                        <span className="text-xs text-muted-foreground">
                                                            {daysAgo <= 0 ? "Today" : daysAgo === 1 ? "Yesterday" : `${daysAgo} days ago`}
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>{appt.reason}</TableCell>
                                                <TableCell>{getStatusBadge(appt.status)}</TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-1">
                                                        <Button
                                                            size="sm"
                                                            className="h-8 text-xs flex items-center gap-1"
                                                            onClick={() => openReappointDialog(appt)}
                                                        >
                                                            <RefreshCw className="w-3 h-3" />
                                                            Re-appoint
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                                            title="Send 'we missed you' WhatsApp message"
                                                            onClick={() => sendMissedWhatsApp(appt)}
                                                        >
                                                            <MessageCircle className="w-4 h-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                                            title="Patient actually came - mark as completed"
                                                            disabled={statusMutation.isPending}
                                                            onClick={() => statusMutation.mutate({ appt, status: "Completed" })}
                                                        >
                                                            <CheckCircle2 className="w-4 h-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            title="Edit appointment"
                                                            onClick={() => openEditDialog(appt)}
                                                        >
                                                            <Edit2 className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
                </CollapsibleContent>
            </Card>
            </Collapsible>

            <Card>
                <CardHeader className="pb-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <CalendarIcon className="w-5 h-5 text-primary" />
                            All Appointments
                        </CardTitle>
                        <div className="flex items-center gap-3 flex-wrap">
                            <div className="relative w-full sm:w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                    type="search"
                                    placeholder="Search patient or reason..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-9"
                                />
                            </div>
                            <div className="flex border rounded-md p-0.5 bg-muted items-center">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    type="button"
                                    onClick={() => setDateFilter("today")}
                                    className={`h-8 px-3 text-xs ${dateFilter === "today" ? "bg-background text-foreground shadow-sm hover:bg-background" : "text-muted-foreground"}`}
                                >
                                    Today
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    type="button"
                                    onClick={() => setDateFilter("tomorrow")}
                                    className={`h-8 px-3 text-xs ${dateFilter === "tomorrow" ? "bg-background text-foreground shadow-sm hover:bg-background" : "text-muted-foreground"}`}
                                >
                                    Tomorrow
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    type="button"
                                    onClick={() => setDateFilter("all")}
                                    className={`h-8 px-3 text-xs ${dateFilter === "all" ? "bg-background text-foreground shadow-sm hover:bg-background" : "text-muted-foreground"}`}
                                >
                                    All
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    type="button"
                                    onClick={() => setDateFilter("custom")}
                                    className={`h-8 px-3 text-xs ${dateFilter === "custom" ? "bg-background text-foreground shadow-sm hover:bg-background" : "text-muted-foreground"}`}
                                >
                                    Custom Date
                                </Button>
                            </div>
                             <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                                <SelectTrigger className="w-[180px] h-10">
                                    <SelectValue placeholder="All Departments" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Departments</SelectItem>
                                    {departments.map((dept) => (
                                        <SelectItem key={dept.id} value={dept.name}>
                                            {dept.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {dateFilter === "custom" && (
                                <div className="flex items-center gap-2">
                                    <Input
                                        type="date"
                                        value={selectedDate}
                                        onChange={(e) => setSelectedDate(e.target.value)}
                                        className="w-40 h-10 border rounded px-3"
                                        title="Filter by Specific Date"
                                    />
                                    {selectedDate && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setSelectedDate("")}
                                            className="h-10 px-2 text-xs"
                                        >
                                            Clear Date
                                        </Button>
                                    )}
                                </div>
                            )}
                            <Dialog open={isDialogOpen} onOpenChange={(open) => !open && closeDialog()}>
                                <DialogTrigger asChild>
                                    <Button onClick={() => setIsDialogOpen(true)}>
                                        <Plus className="w-4 h-4 mr-2" />
                                        New Appointment
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
                                    <DialogHeader>
                                        <DialogTitle>
                                            {editingAppointment ? "Edit Appointment" : reappointSource ? "Re-appoint Patient" : "Schedule New Appointment"}
                                        </DialogTitle>
                                    </DialogHeader>
                                    <Form {...form}>
                                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

                                            {/* Patient Type toggle */}
                                            {!editingAppointment && !reappointSource && (
                                                <div className="flex items-center gap-6 p-3 bg-muted/40 border border-border/60 rounded-md mb-2">
                                                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Patient type:</label>
                                                    <div className="flex items-center gap-4">
                                                        <label className="flex items-center gap-1.5 text-sm font-medium cursor-pointer">
                                                            <input
                                                                type="radio"
                                                                checked={!form.watch("isNewPatient")}
                                                                onChange={() => {
                                                                    form.setValue("isNewPatient", false);
                                                                    form.clearErrors(["newPatientName", "newPatientPhone", "patientId"]);
                                                                }}
                                                                className="h-4 w-4 text-primary accent-primary"
                                                            />
                                                            Existing Patient
                                                        </label>
                                                        <label className="flex items-center gap-1.5 text-sm font-medium cursor-pointer">
                                                            <input
                                                                type="radio"
                                                                checked={form.watch("isNewPatient")}
                                                                onChange={() => {
                                                                    form.setValue("isNewPatient", true);
                                                                    form.clearErrors(["newPatientName", "newPatientPhone", "patientId"]);
                                                                }}
                                                                className="h-4 w-4 text-primary accent-primary"
                                                            />
                                                            New Patient
                                                        </label>
                                                    </div>
                                                </div>
                                            )}

                                            {!form.watch("isNewPatient") ? (
                                                <FormField
                                                    control={form.control}
                                                    name="patientId"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Patient</FormLabel>
                                                            <Select
                                                                onValueChange={(val) => {
                                                                    field.onChange(val);
                                                                    const selPatient = patients.find(p => p.id === val);
                                                                    if (selPatient?.department && !form.getValues("department")) {
                                                                        form.setValue("department", selPatient.department);
                                                                    }
                                                                }}
                                                                value={field.value}
                                                                disabled={!!editingAppointment || !!reappointSource} // Patient is fixed on edit / re-appoint
                                                            >
                                                                <FormControl>
                                                                    <SelectTrigger>
                                                                        <SelectValue placeholder={patientsLoading ? "Loading..." : "Select Patient"} />
                                                                    </SelectTrigger>
                                                                </FormControl>
                                                                <SelectContent>
                                                                    {patients.map((patient) => (
                                                                        <SelectItem key={patient.id} value={patient.id}>
                                                                            {patient.name} ({patient.phone})
                                                                        </SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            ) : (
                                                <div className="space-y-4 p-4 border border-blue-100 bg-blue-50/20 rounded-md">
                                                    <h3 className="text-xs font-semibold text-blue-700 uppercase tracking-wider">New Patient Registration</h3>
                                                    <FormField
                                                        control={form.control}
                                                        name="newPatientName"
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel>Patient Full Name</FormLabel>
                                                                <FormControl>
                                                                    <Input placeholder="Enter full name" {...field} />
                                                                </FormControl>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />
                                                    <FormField
                                                        control={form.control}
                                                        name="newPatientPhone"
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel>Phone Number</FormLabel>
                                                                <FormControl>
                                                                    <Input placeholder="10-digit mobile number" {...field} />
                                                                </FormControl>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />
                                                </div>
                                            )}

                                            <FormField
                                                control={form.control}
                                                name="department"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Treatment Department</FormLabel>
                                                        <Select
                                                            onValueChange={field.onChange}
                                                            value={field.value}
                                                        >
                                                            <FormControl>
                                                                <SelectTrigger>
                                                                    <SelectValue placeholder="Select Department" />
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                <SelectItem value="None">None / General</SelectItem>
                                                                {departments.map((dept) => (
                                                                    <SelectItem key={dept.id} value={dept.name}>
                                                                        {dept.name}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />

                                            <FormField
                                                control={form.control}
                                                name="reason"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Reason for Visit</FormLabel>
                                                        <FormControl>
                                                            <Input
                                                                placeholder="e.g. Regular Checkup, Follow-up"
                                                                {...field}
                                                            />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />

                                            <FormField
                                                control={form.control}
                                                name="date"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Date</FormLabel>
                                                        <FormControl>
                                                            <Input
                                                                type="date"
                                                                {...field}
                                                            />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />

                                            <FormField
                                                control={form.control}
                                                name="time"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Time</FormLabel>
                                                        <FormControl>
                                                            <Input
                                                                type="time"
                                                                {...field}
                                                            />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />

                                            <FormField
                                                control={form.control}
                                                name="status"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Status</FormLabel>
                                                        <Select
                                                            onValueChange={field.onChange}
                                                            value={field.value}
                                                        >
                                                            <FormControl>
                                                                <SelectTrigger>
                                                                    <SelectValue placeholder="Select status" />
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                <SelectItem value="Scheduled">Scheduled</SelectItem>
                                                                <SelectItem value="Completed">Completed</SelectItem>
                                                                <SelectItem value="Cancelled">Cancelled</SelectItem>
                                                                <SelectItem value="No Show">Not Come</SelectItem>
                                                                {field.value === "Rescheduled" && (
                                                                    <SelectItem value="Rescheduled">Rescheduled</SelectItem>
                                                                )}
                                                            </SelectContent>
                                                        </Select>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />

                                            <FormField
                                                control={form.control}
                                                name="type"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Appointment Tag</FormLabel>
                                                        <Select
                                                            onValueChange={field.onChange}
                                                            value={field.value || "New"}
                                                        >
                                                            <FormControl>
                                                                <SelectTrigger>
                                                                    <SelectValue placeholder="Select type" />
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                <SelectItem value="New">New</SelectItem>
                                                                <SelectItem value="Follow-up">Follow-up</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />

                                            <div className="flex justify-end gap-3 pt-2">
                                                <Button type="button" variant="outline" onClick={closeDialog}>
                                                    Cancel
                                                </Button>
                                                <Button
                                                    type="submit"
                                                    disabled={isSubmitting || createMutation.isPending || updateMutation.isPending}
                                                >
                                                    {isSubmitting || createMutation.isPending || updateMutation.isPending
                                                        ? "Saving..."
                                                        : editingAppointment
                                                            ? "Update"
                                                            : "Schedule"}
                                                </Button>
                                            </div>
                                        </form>
                                    </Form>
                                </DialogContent>
                            </Dialog>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="space-y-3">
                            {[1, 2, 3].map((i) => (
                                <Skeleton key={i} className="h-12 w-full" />
                            ))}
                        </div>
                    ) : (
                        <Tabs defaultValue="upcoming" className="w-full">
                            <TabsList className="mb-4">
                                <TabsTrigger value="upcoming">Upcoming ({upcomingAppointments.length})</TabsTrigger>
                                <TabsTrigger value="history">History ({pastAppointments.length})</TabsTrigger>
                            </TabsList>

                            <TabsContent value="upcoming">
                                {upcomingAppointments.length === 0 ? (
                                    <div className="text-center py-12">
                                        <CalendarIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                                        <h3 className="text-lg font-medium mb-1">No upcoming appointments</h3>
                                        <p className="text-muted-foreground text-sm">
                                            Schedule a new appointment to get started
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-6">
                                        {Object.entries(groupedUpcoming).sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime()).map(([dateStr, appts]) => (
                                            <div key={dateStr} className="space-y-2">
                                                <div className="text-xs font-semibold text-primary bg-primary/5 border border-primary/10 px-3 py-1.5 rounded flex items-center gap-2 w-fit">
                                                    <CalendarIcon className="w-3.5 h-3.5" />
                                                    {formatDateHeader(dateStr)}
                                                </div>
                                                <AppointmentsTable
                                                    appointments={appts}
                                                    patients={patients}
                                                    getStatusBadge={getStatusBadge}
                                                    onEdit={openEditDialog}
                                                    onDelete={setDeletingAppointment}
                                                    onWhatsApp={sendWhatsApp}
                                                    onNotCome={(appt: Appointment) => statusMutation.mutate({ appt, status: "No Show" })}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </TabsContent>

                            <TabsContent value="history">
                                {pastAppointments.length === 0 ? (
                                    <div className="text-center py-12">
                                        <CalendarIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                                        <h3 className="text-lg font-medium mb-1">No past appointments</h3>
                                    </div>
                                ) : (
                                    <AppointmentsTable
                                        appointments={pastAppointments}
                                        patients={patients}
                                        getStatusBadge={getStatusBadge}
                                        onEdit={openEditDialog}
                                        onDelete={setDeletingAppointment}
                                        onWhatsApp={sendWhatsApp}
                                        onNotCome={(appt: Appointment) => statusMutation.mutate({ appt, status: "No Show" })}
                                    />
                                )}
                            </TabsContent>
                        </Tabs>
                    )}
                </CardContent>
            </Card>

            <AlertDialog open={!!deletingAppointment} onOpenChange={() => setDeletingAppointment(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Cancel Appointment</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to cancel this appointment for {deletingAppointment?.patientName}? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Close</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground"
                            onClick={() => deletingAppointment && deleteMutation.mutate(deletingAppointment.id)}
                        >
                            {deleteMutation.isPending ? "Cancelling..." : "Confirm Cancel"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div >
    );
}

function AppointmentsTable({ appointments, patients, getStatusBadge, onEdit, onDelete, onWhatsApp, onNotCome }: any) {
    const todayStr = format(new Date(), "yyyy-MM-dd");
    return (
        <div className="border rounded-lg overflow-hidden">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Date & Time</TableHead>
                        <TableHead>Patient</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {appointments.map((appt: Appointment) => (
                        <TableRow key={appt.id}>
                            <TableCell className="font-medium">
                                <div className="flex flex-col">
                                    <span>{format(new Date(appt.date), "dd MMM yyyy")}</span>
                                    <span className="text-xs text-muted-foreground">{appt.time}</span>
                                </div>
                            </TableCell>
                            <TableCell>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-medium">{appt.patientName || "Unknown Patient"}</span>
                                    {appt.type && (
                                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-5 ${
                                            appt.type === "Follow-up"
                                                ? "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-50"
                                                : "bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-50"
                                        }`}>
                                            {appt.type}
                                        </Badge>
                                    )}
                                    {appt.department && (
                                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-50">
                                            {appt.department}
                                        </Badge>
                                    )}
                                </div>
                            </TableCell>
                            <TableCell>{appt.reason}</TableCell>
                            <TableCell>{getStatusBadge(appt.status)}</TableCell>
                            <TableCell className="text-right">
                                <div className="flex justify-end gap-1">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                        title="Send WhatsApp Message"
                                        onClick={() => onWhatsApp(appt)}
                                    >
                                        <MessageCircle className="w-4 h-4" />
                                    </Button>
                                    {onNotCome && appt.status === "Scheduled" && appt.date <= todayStr && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                                            title="Patient did not come - move to the Not Come list"
                                            onClick={() => onNotCome(appt)}
                                        >
                                            <UserX className="w-4 h-4" />
                                        </Button>
                                    )}
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => onEdit(appt)}
                                    >
                                        <Edit2 className="w-4 h-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="text-destructive"
                                        onClick={() => onDelete(appt)}
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
