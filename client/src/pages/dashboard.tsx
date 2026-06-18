import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Search, Users, Calendar, TrendingUp, AlertCircle, ChevronRight, Phone, ChevronDown, Receipt } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { Patient, Bill, Visit, Appointment, PaymentLedger } from "@shared/schema";
import { extractPaginatedData } from "@/lib/utils";
import { format, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertAppointmentSchema } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

type AppointmentForm = z.infer<typeof insertAppointmentSchema>;

export default function Dashboard() {
  const [searchQuery, setSearchQuery] = useState("");
  const [patientFilter, setPatientFilter] = useState<"all" | "new" | "repeat" | "upcoming">("all");
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedPatientForAppointment, setSelectedPatientForAppointment] = useState<Patient | null>(null);
  const [selectedBillForDetails, setSelectedBillForDetails] = useState<Bill | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const isToday = selectedDate === format(new Date(), "yyyy-MM-dd");

  const [patientDateFilter, setPatientDateFilter] = useState<string>("all-time");
  const [patientStartDate, setPatientStartDate] = useState<string>("");
  const [patientEndDate, setPatientEndDate] = useState<string>("");

  const form = useForm<AppointmentForm>({
    resolver: zodResolver(insertAppointmentSchema),
    defaultValues: {
      patientId: "",
      date: format(new Date(), "yyyy-MM-dd"),
      reason: "",
      status: "Scheduled",
      type: "New",
    },
  });

  // Reset form when patient is selected
  useEffect(() => {
    if (selectedPatientForAppointment) {
      form.setValue("patientId", selectedPatientForAppointment.id);
    }
  }, [selectedPatientForAppointment, form]);

  const createAppointmentMutation = useMutation({
    mutationFn: async (data: AppointmentForm) => {
      return await apiRequest("POST", "/api/appointments", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      toast({
        title: "Appointment Scheduled",
        description: "Upcoming visit assigned successfully.",
      });
      setSelectedPatientForAppointment(null);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Schedule",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const { data: patientsResponse, isLoading: patientsLoading } = useQuery({
    queryKey: ["/api/patients"],
  });
  const patients = extractPaginatedData<Patient>(patientsResponse);

  const { data: billsResponse } = useQuery({
    queryKey: ["/api/bills"],
  });
  const bills = extractPaginatedData<Bill>(billsResponse);

  const { data: visitsResponse } = useQuery({
    queryKey: ["/api/visits"],
  });
  const visits = extractPaginatedData<Visit>(visitsResponse);

  const { data: appointmentsResponse, isLoading: appointmentsLoading } = useQuery({
    queryKey: ["/api/appointments"],
  });
  const appointments = Array.isArray(appointmentsResponse) ? appointmentsResponse : [];

  const { data: paymentLedgersResponse } = useQuery({
    queryKey: ["/api/payment-ledgers"],
  });
  const paymentLedgers = Array.isArray(paymentLedgersResponse) ? paymentLedgersResponse : [];

  const pendingBills = bills.filter((bill) => bill.pendingAmount > 0);

  // Get selected date string
  // (Using the selectedDate state from above)

  // Get unique patient IDs from selected date's visits
  const patientIdsWithTodayVisits = new Set(
    visits
      .filter((v) => v.date === selectedDate)
      .map((v) => v.patientId)
  );

  // Include patients registered on selected date OR with visits on selected date
  const todayPatients = patients.filter(
    (p) => p.registrationDate === selectedDate || patientIdsWithTodayVisits.has(p.id)
  );

  // Selected date's bills calculations
  const todayBills = bills.filter((bill) => bill.date === selectedDate);
  const todayPendingAmount = todayBills.reduce((sum, bill) => sum + bill.pendingAmount, 0);

  // Selected date's payments (from ledger)
  const todayPayments = paymentLedgers.filter((payment) => payment.date === selectedDate);
  const todayPaidRevenue = todayPayments.reduce((sum, payment) => sum + payment.amount, 0);

  // Selected date's Appointments
  const todayAppointments = appointments.filter(a => a.date === selectedDate);

  // Total pending amount from all bills
  const totalPendingAmount = pendingBills.reduce((sum, bill) => sum + bill.pendingAmount, 0);

  // This month's statistics
  const currentMonthStart = startOfMonth(new Date());
  const currentMonthEnd = endOfMonth(new Date());

  // Get visits for this month
  const thisMonthVisits = visits.filter((v) => {
    const visitDate = new Date(v.date);
    return isWithinInterval(visitDate, { start: currentMonthStart, end: currentMonthEnd });
  });

  // Patients with at least 1 visit this month
  const uniquePatientIdsWithVisitsThisMonth = new Set(thisMonthVisits.map((v) => v.patientId));

  // Filter patients for search
  const filteredPatients = patients.filter(
    (patient) =>
      patient.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      patient.phone.includes(searchQuery)
  );

  // New patients this month = Patients registered this month
  const newPatientsThisMonth = patients.filter((p) => {
    const regDate = new Date(p.registrationDate);
    return isWithinInterval(regDate, { start: currentMonthStart, end: currentMonthEnd });
  });

  // Repeat visit patients this month = Patients registered BEFORE this month who have a visit THIS month
  const repeatPatientsThisMonth = patients.filter((p) => {
    const regDate = new Date(p.registrationDate);
    const wasRegisteredBeforeThisMonth = regDate < currentMonthStart;
    const hasVisitThisMonth = uniquePatientIdsWithVisitsThisMonth.has(p.id);
    return wasRegisteredBeforeThisMonth && hasVisitThisMonth;
  });
  const repeatVisitPatientsCount = repeatPatientsThisMonth.length;

  // Active Date Filter interval calculations for "All Patients" section
  const getPatientDateInterval = (): { start: Date; end: Date } | null => {
    if (patientDateFilter === "all-time") return null;

    const now = new Date();
    let start = new Date();
    let end = new Date();

    if (patientDateFilter === "today") {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else if (patientDateFilter === "this-week") {
      const day = now.getDay();
      start = new Date(now.setDate(now.getDate() - day));
      start.setHours(0, 0, 0, 0);
      end = new Date(start);
      end.setDate(end.getDate() + 6);
      end.setHours(23, 59, 59, 999);
    } else if (patientDateFilter === "this-month") {
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    } else if (patientDateFilter === "last-month") {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    } else if (patientDateFilter === "custom") {
      if (!patientStartDate || !patientEndDate) return null;
      start = new Date(patientStartDate);
      start.setHours(0, 0, 0, 0);
      end = new Date(patientEndDate);
      end.setHours(23, 59, 59, 999);
    } else {
      return null;
    }

    return { start, end };
  };

  const pInterval = getPatientDateInterval();

  // New Patients in active interval
  const activeNewPatients = patients.filter((p) => {
    const regDate = new Date(p.registrationDate);
    const interval = pInterval || { start: currentMonthStart, end: currentMonthEnd };
    return isWithinInterval(regDate, interval);
  });

  // Visits in active interval
  const activeIntervalVisits = visits.filter((v) => {
    const visitDate = new Date(v.date);
    const interval = pInterval || { start: currentMonthStart, end: currentMonthEnd };
    return isWithinInterval(visitDate, interval);
  });
  const activePatientIdsWithVisits = new Set(activeIntervalVisits.map((v) => v.patientId));

  // Repeat Patients in active interval (registered before interval start, visited during interval)
  const activeRepeatPatients = patients.filter((p) => {
    const regDate = new Date(p.registrationDate);
    const intervalStart = pInterval ? pInterval.start : currentMonthStart;
    return regDate < intervalStart && activePatientIdsWithVisits.has(p.id);
  });

  // Scheduled appointments in active interval
  const activeUpcomingAppointments = appointments.filter((a) => {
    if (a.status !== "Scheduled") return false;
    const apDate = new Date(a.date);
    if (pInterval) {
      return isWithinInterval(apDate, pInterval);
    } else {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      return apDate >= todayStart;
    }
  });
  const activeUpcomingPatientIds = new Set(activeUpcomingAppointments.map((a) => a.patientId));

  // All patients related to active interval
  const activeAllPatients = patients.filter((p) => {
    if (!pInterval) return true;
    const regDate = new Date(p.registrationDate);
    const registeredInInterval = isWithinInterval(regDate, pInterval);
    const visitedInInterval = activePatientIdsWithVisits.has(p.id);
    const hasAppointmentInInterval = activeUpcomingPatientIds.has(p.id);
    return registeredInInterval || visitedInInterval || hasAppointmentInInterval;
  });

  // Get displayed patients based on filter
  const getDisplayedPatients = () => {
    let basePatients = [];

    if (patientFilter === "new") {
      basePatients = activeNewPatients;
    } else if (patientFilter === "repeat") {
      basePatients = activeRepeatPatients;
    } else if (patientFilter === "upcoming") {
      basePatients = patients.filter((p) => activeUpcomingPatientIds.has(p.id));
    } else {
      basePatients = activeAllPatients;
    }

    // Filter by search query
    basePatients = basePatients.filter(
      (patient) =>
        patient.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        patient.phone.includes(searchQuery)
    );

    // Apply sorting
    basePatients.sort((a, b) => {
      if (patientFilter === "upcoming") {
        const aNext = activeUpcomingAppointments
          .filter(ap => ap.patientId === a.id)
          .sort((ap1, ap2) => new Date(ap1.date).getTime() - new Date(ap2.date).getTime())[0];
        const bNext = activeUpcomingAppointments
          .filter(ap => ap.patientId === b.id)
          .sort((ap1, ap2) => new Date(ap1.date).getTime() - new Date(ap2.date).getTime())[0];

        if (!aNext) return 1;
        if (!bNext) return -1;
        return new Date(aNext.date).getTime() - new Date(bNext.date).getTime();
      }

      if (patientFilter === "repeat") {
        const aVisits = activeIntervalVisits.filter((v) => v.patientId === a.id);
        const bVisits = activeIntervalVisits.filter((v) => v.patientId === b.id);
        const aLast = aVisits.length > 0 ? Math.max(...aVisits.map(v => new Date(v.date).getTime())) : 0;
        const bLast = bVisits.length > 0 ? Math.max(...bVisits.map(v => new Date(v.date).getTime())) : 0;
        return bLast - aLast;
      }

      // Default: sort by registration date (newest first)
      return new Date(b.registrationDate).getTime() - new Date(a.registrationDate).getTime();
    });

    return basePatients;
  };

  const displayedPatients = getDisplayedPatients();
  const totalPages = Math.ceil(displayedPatients.length / ITEMS_PER_PAGE);

  // Reset to first page when filter, search, or date filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [patientFilter, searchQuery, patientDateFilter, patientStartDate, patientEndDate]);

  // Get current page entries
  const paginatedPatients = displayedPatients.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-page-title">
            Dashboard
          </h1>
          <p className="text-muted-foreground">
            Overview of your clinic's activity and patient records
          </p>
        </div>
        <div className="flex items-center gap-3 bg-muted/50 p-2 rounded-lg border">
          <label className="text-sm font-medium whitespace-nowrap pl-2">
            Overview Date:
          </label>
          <Input 
            type="date" 
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-auto h-9"
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Patients
            </CardTitle>
            <Users className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-patients">
              {patientsLoading ? <Skeleton className="h-8 w-16" /> : patients.length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Registered in system
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {isToday ? "Today's Patients" : "Patients"}
            </CardTitle>
            <Calendar className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-today-patients">
              {patientsLoading ? <Skeleton className="h-8 w-16" /> : todayPatients.length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {format(new Date(selectedDate), "dd MMM yyyy")}
            </p>
          </CardContent>
        </Card>

        <Popover>
          <PopoverTrigger asChild>
            <Card className="cursor-pointer hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {isToday ? "Today's Paid" : "Paid"}
                </CardTitle>
                <div className="flex items-center gap-1">
                  <TrendingUp className="w-4 h-4 text-muted-foreground" />
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600" data-testid="text-today-paid">
                  {patientsLoading ? <Skeleton className="h-8 w-20" /> : `₹${todayPaidRevenue.toLocaleString()}`}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Click to view payments
                </p>
              </CardContent>
            </Card>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0 max-h-96 overflow-hidden" align="start">
            <div className="p-3 border-b bg-muted/50">
              <h4 className="font-semibold text-sm">
                {isToday ? "Today's Payments" : "Payments"} ({todayPayments.length})
              </h4>
              <p className="text-xs text-muted-foreground">
                Amounts received on {format(new Date(selectedDate), "dd MMM yyyy")}
              </p>
            </div>
            <div className="max-h-72 overflow-y-auto">
              {todayPayments.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground text-sm">
                  No payments on this date
                </div>
              ) : (
                todayPayments.map((payment) => {
                  const bill = bills.find((b) => b.id === payment.billId);
                  const patientName = bill ? bill.patientName : "Unknown";
                  return (
                    <div
                      key={payment.id}
                      className="flex items-center justify-between p-3 hover:bg-muted/50 cursor-pointer border-b last:border-b-0 transition-colors"
                      onClick={() => {
                        if (bill) setSelectedBillForDetails(bill);
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                          <TrendingUp className="w-4 h-4 text-green-600" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{patientName}</p>
                          <p className="text-xs text-muted-foreground">
                            Bill from {bill ? format(new Date(bill.date), "dd MMM yyyy") : ""}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-green-600 text-sm">
                          ₹{payment.amount.toLocaleString()}
                        </p>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mt-0.5">
                          {payment.paymentMode}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </PopoverContent>
        </Popover>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {isToday ? "Today's Pending" : "Pending from Date"}
            </CardTitle>
            <AlertCircle className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive" data-testid="text-today-pending">
              {patientsLoading ? <Skeleton className="h-8 w-20" /> : `₹${todayPendingAmount.toLocaleString()}`}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {isToday ? "Pending from today's bills" : `Pending from ${format(new Date(selectedDate), "dd MMM yyyy")} bills`}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              New Patients This Month
            </CardTitle>
            <Users className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600" data-testid="text-monthly-unique-patients">
              {patientsLoading ? <Skeleton className="h-8 w-16" /> : newPatientsThisMonth.length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              First-time registrations ({format(currentMonthStart, "MMM yyyy")})
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Repeat Visit Patients
            </CardTitle>
            <Calendar className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600" data-testid="text-repeat-visit-patients">
              {patientsLoading ? <Skeleton className="h-8 w-16" /> : repeatVisitPatientsCount}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Follow-up visits this month
            </p>
          </CardContent>
        </Card>

        <Popover>
          <PopoverTrigger asChild>
            <Card className="cursor-pointer hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Bills with Pending
                </CardTitle>
                <div className="flex items-center gap-1">
                  <AlertCircle className="w-4 h-4 text-muted-foreground" />
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive" data-testid="text-pending-payments">
                  {patientsLoading ? <Skeleton className="h-8 w-16" /> : pendingBills.length}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Click to view all pending bills
                </p>
              </CardContent>
            </Card>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0 max-h-96 overflow-hidden" align="start">
            <div className="p-3 border-b bg-muted/50">
              <h4 className="font-semibold text-sm">Pending Bills ({pendingBills.length})</h4>
              <p className="text-xs text-muted-foreground">Click on a bill to view details</p>
            </div>
            <div className="max-h-72 overflow-y-auto">
              {pendingBills.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground text-sm">
                  No pending bills
                </div>
              ) : (
                pendingBills
                  .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                  .map((bill) => (
                    <div
                      key={bill.id}
                      className="flex items-center justify-between p-3 hover:bg-muted/50 cursor-pointer border-b last:border-b-0 transition-colors"
                      onClick={() => setSelectedBillForDetails(bill)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-destructive/10 flex items-center justify-center">
                          <Receipt className="w-4 h-4 text-destructive" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{bill.patientName}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(bill.date), "dd MMM yyyy")}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-destructive text-sm">
                          ₹{bill.pendingAmount.toLocaleString()}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          of ₹{bill.finalAmount.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </PopoverContent>
        </Popover>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Pending Amount
            </CardTitle>
            <AlertCircle className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive" data-testid="text-total-pending-amount">
              {patientsLoading ? <Skeleton className="h-8 w-20" /> : `₹${totalPendingAmount.toLocaleString()}`}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Outstanding balance from all bills
            </p>
          </CardContent>
        </Card>
      </div>

      {todayPatients.length > 0 && (
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-medium flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              {isToday ? "Today's Patients" : "Patients on Date"} ({todayPatients.length})
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-2">
              Patients registered or visited on {format(new Date(selectedDate), "dd MMMM yyyy")}
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {todayPatients.map((patient) => {
                const patientTodayBills = bills.filter(
                  (b) =>
                    b.patientId === patient.id &&
                    b.date === selectedDate
                );
                const patientTodayVisits = visits.filter(
                  (v) =>
                    v.patientId === patient.id &&
                    v.date === selectedDate
                );
                const todayTotal = patientTodayBills.reduce((sum, b) => sum + b.grandTotal, 0);
                
                // Get payments made today for this patient
                const patientTodayPayments = todayPayments.filter((p) => p.patientId === patient.id);
                const todayPaid = patientTodayPayments.reduce((sum, p) => sum + p.amount, 0);
                
                const todayPending = patientTodayBills.reduce((sum, b) => sum + b.pendingAmount, 0);

                return (
                  <div
                    key={patient.id}
                    className="group relative p-4 rounded-lg border bg-gradient-to-r from-blue-50 to-cyan-50 hover:shadow-md transition-all"
                  >
                    <div
                      className="flex items-center justify-between cursor-pointer"
                      onClick={() => setLocation(`/patient/${patient.id}`)}
                    >
                      <div className="flex items-center gap-4 flex-1">
                        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-600 text-white font-medium">
                          {patient.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-lg group-hover:text-blue-700 transition-colors">{patient.name}</div>
                          <div className="text-sm text-muted-foreground flex items-center gap-2">
                            <Phone className="w-3 h-3" />
                            {patient.phone}
                          </div>
                          {patientTodayVisits.length > 0 && (
                            <div className="text-xs text-blue-600 mt-1">
                              Visit: {patientTodayVisits[0].diagnosis}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="space-y-1">
                            {patientTodayVisits.length > 0 && (
                              <div className="text-sm">
                                <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                                  Visit({patientTodayVisits.length})
                                </Badge>
                              </div>
                            )}
                            {patientTodayBills.length > 0 ? (
                              <div className="text-sm">
                                <span className="text-muted-foreground">Bills:</span>{" "}
                                <span className="font-semibold">{patientTodayBills.length}</span>
                              </div>
                            ) : null}
                            {patientTodayBills.length > 0 && (
                              <div className="text-sm">
                                <span className="text-green-600 font-semibold">₹{todayPaid.toLocaleString()}</span>
                                {todayPending > 0 && (
                                  <span className="text-red-600 font-semibold ml-2">
                                    Pending: ₹{todayPending.toLocaleString()}
                                  </span>
                                )}
                              </div>
                            )}
                            {patientTodayBills.length === 0 && patientTodayVisits.length > 0 && (
                              <div className="text-xs text-muted-foreground">No bills yet</div>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col gap-2 z-10">
                          <Button
                            size="sm"
                            className="bg-blue-600 hover:bg-blue-700 text-white h-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              sessionStorage.setItem("preselectedPatientId", patient.id);
                              setLocation("/billing");
                            }}
                          >
                            Create Bill
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            className="h-8 bg-blue-100 text-blue-700 hover:bg-blue-200"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedPatientForAppointment(patient);
                            }}
                          >
                            Assign Upcoming Visit
                          </Button>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <CardTitle className="text-lg font-medium">All Patients</CardTitle>
              <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                <div className="relative w-full sm:w-80">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Search by name or phone..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                    data-testid="input-patient-search"
                  />
                </div>
                <Select value={patientDateFilter} onValueChange={setPatientDateFilter}>
                  <SelectTrigger className="w-full sm:w-48 bg-background">
                    <SelectValue placeholder="All Time" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all-time">All Time</SelectItem>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="this-week">This Week</SelectItem>
                    <SelectItem value="this-month">This Month</SelectItem>
                    <SelectItem value="last-month">Last Month</SelectItem>
                    <SelectItem value="custom">Custom Range</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {patientDateFilter === "custom" && (
              <div className="flex flex-col sm:flex-row gap-2 w-full max-w-md">
                <Input
                  type="date"
                  value={patientStartDate}
                  onChange={(e) => setPatientStartDate(e.target.value)}
                  placeholder="Start date"
                  className="flex-1"
                />
                <Input
                  type="date"
                  value={patientEndDate}
                  onChange={(e) => setPatientEndDate(e.target.value)}
                  placeholder="End date"
                  className="flex-1"
                />
              </div>
            )}

            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setPatientFilter("all")}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${patientFilter === "all"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-muted/80"
                  }`}
              >
                All ({
                  activeAllPatients.filter((p) =>
                    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    p.phone.includes(searchQuery)
                  ).length
                })
              </button>
              <button
                onClick={() => setPatientFilter("new")}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${patientFilter === "new"
                  ? "bg-blue-600 text-white"
                  : "bg-blue-100 text-blue-700 hover:bg-blue-200"
                  }`}
              >
                New ({
                  activeNewPatients.filter((p) =>
                    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    p.phone.includes(searchQuery)
                  ).length
                })
              </button>
              <button
                onClick={() => setPatientFilter("repeat")}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${patientFilter === "repeat"
                  ? "bg-purple-600 text-white"
                  : "bg-purple-100 text-purple-700 hover:bg-purple-200"
                  }`}
              >
                Repeat Visits ({
                  activeRepeatPatients.filter((p) =>
                    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    p.phone.includes(searchQuery)
                  ).length
                })
              </button>
              <button
                onClick={() => setPatientFilter("upcoming")}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${patientFilter === "upcoming"
                  ? "bg-blue-600 text-white"
                  : "bg-blue-100 text-blue-700 hover:bg-blue-200"
                  }`}
              >
                Upcoming Visits ({
                  patients.filter((p) =>
                    activeUpcomingPatientIds.has(p.id) &&
                    (p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                     p.phone.includes(searchQuery))
                  ).length
                })
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {patientsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : displayedPatients.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-1">No patients found</h3>
              <p className="text-muted-foreground text-sm">
                {searchQuery
                  ? "Try adjusting your search"
                  : "Register your first patient to get started"}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="space-y-2">
                {paginatedPatients.map((patient) => {
                  const patientBills = bills.filter((b) => b.patientId === patient.id);
                  const hasPending = patientBills.some((b) => b.pendingAmount > 0);

                  // Get last visit date for this patient
                  const patientVisits = visits.filter((v) => v.patientId === patient.id);
                  const lastVisit = patientVisits.length > 0
                    ? patientVisits.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]
                    : null;

                  // Get next scheduled visit
                  const nextVisit = appointments
                    .filter(a => a.patientId === patient.id && a.status === "Scheduled")
                    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                    .find(a => new Date(a.date) >= new Date(new Date().setHours(0, 0, 0, 0)));

                  // Determine what date to show prominently on the right side
                  let rightDateLabel = "";
                  let rightDateVal = "";
                  if (patientFilter === "upcoming" && nextVisit) {
                    rightDateLabel = "Next Visit";
                    rightDateVal = nextVisit.date;
                  } else if (patientFilter === "repeat" && lastVisit) {
                    rightDateLabel = "Last Visit";
                    rightDateVal = lastVisit.date;
                  } else if (patientFilter === "new") {
                    rightDateLabel = "Registered";
                    rightDateVal = patient.registrationDate;
                  } else {
                    if (nextVisit) {
                      rightDateLabel = "Next Visit";
                      rightDateVal = nextVisit.date;
                    } else if (lastVisit) {
                      rightDateLabel = "Last Visit";
                      rightDateVal = lastVisit.date;
                    } else {
                      rightDateLabel = "Registered";
                      rightDateVal = patient.registrationDate;
                    }
                  }

                  return (
                    <Link
                      key={patient.id}
                      href={`/patient/${patient.id}`}
                      className="block"
                    >
                      <div
                        className="flex items-center justify-between p-4 rounded-lg border bg-card hover-elevate cursor-pointer transition-all"
                        data-testid={`card-patient-${patient.id}`}
                      >
                        <div className="flex items-center gap-4">
                          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary font-medium">
                            {patient.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium" data-testid={`text-patient-name-${patient.id}`}>
                                {patient.name}
                              </span>
                              {hasPending && (
                                <Badge variant="destructive" className="text-xs">
                                  Pending
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                              <Phone className="w-3 h-3" />
                              <span data-testid={`text-patient-phone-${patient.id}`}>
                                {patient.phone}
                              </span>
                              <span className="text-border">|</span>
                              <span>
                                Registered: {format(new Date(patient.registrationDate), "dd MMM yyyy")}
                              </span>
                              {lastVisit && (
                                <>
                                  <span className="text-border">|</span>
                                  <span>
                                    Last Visit: {format(new Date(lastVisit.date), "dd MMM yyyy")}
                                  </span>
                                </>
                              )}
                              {nextVisit && (
                                <>
                                  <span className="text-border">|</span>
                                  <span className="text-blue-600 font-medium flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    Next Visit: {format(new Date(nextVisit.date), "dd MMM yyyy")}
                                    {nextVisit.reason && ` (${nextVisit.reason})`}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          {rightDateVal && (
                            <div className="text-right hidden sm:block pr-2 border-r mr-2 border-border/60">
                              <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold block">
                                {rightDateLabel}
                              </span>
                              <span className={`text-sm font-semibold ${rightDateLabel === "Next Visit" ? "text-blue-600" : "text-foreground"}`}>
                                {format(new Date(rightDateVal), "dd MMM yyyy")}
                              </span>
                            </div>
                          )}
                          <ChevronRight className="w-5 h-5 text-muted-foreground" />
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t mt-4">
                  <p className="text-sm text-muted-foreground">
                    Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, displayedPatients.length)} of {displayedPatients.length} patients
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>
                    <div className="flex items-center px-4 text-sm font-medium">
                      Page {currentPage} of {totalPages}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedPatientForAppointment} onOpenChange={(open) => !open && setSelectedPatientForAppointment(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Upcoming Visit</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((data) => createAppointmentMutation.mutate(data))} className="space-y-4">
              <FormField
                control={form.control}
                name="patientId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Patient</FormLabel>
                    <FormControl>
                      <Input value={selectedPatientForAppointment?.name || ""} disabled readOnly />
                    </FormControl>
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
                      <Input placeholder="e.g. Follow-up" {...field} />
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
                      <Input type="date" {...field} />
                    </FormControl>
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
                <Button type="button" variant="outline" onClick={() => setSelectedPatientForAppointment(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createAppointmentMutation.isPending}>
                  {createAppointmentMutation.isPending ? "Assigning..." : "Assign Visit"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Bill Details Dialog */}
      <Dialog open={!!selectedBillForDetails} onOpenChange={(open) => !open && setSelectedBillForDetails(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5" />
              Bill Details
            </DialogTitle>
          </DialogHeader>
          {selectedBillForDetails && (
            <div className="space-y-4">
              {/* Patient Info */}
              <div className="bg-muted/50 p-4 rounded-lg">
                <h4 className="font-semibold text-lg">{selectedBillForDetails.patientName}</h4>
                <p className="text-sm text-muted-foreground">
                  Bill Date: {format(new Date(selectedBillForDetails.date), "dd MMM yyyy")}
                </p>
              </div>

              {/* Treatments */}
              {selectedBillForDetails.treatments.length > 0 && (
                <div>
                  <h5 className="font-medium text-sm mb-2">Treatments</h5>
                  <div className="space-y-1">
                    {selectedBillForDetails.treatments.map((t, i) => (
                      <div key={i} className="flex justify-between text-sm py-1 border-b last:border-b-0">
                        <span>{t.treatmentName}</span>
                        <span className="font-medium">₹{t.price.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Medicines */}
              {selectedBillForDetails.medicines.length > 0 && (
                <div>
                  <h5 className="font-medium text-sm mb-2">Medicines</h5>
                  <div className="space-y-1">
                    {selectedBillForDetails.medicines.map((m, i) => (
                      <div key={i} className="flex justify-between text-sm py-1 border-b last:border-b-0">
                        <span>{m.medicineName} × {m.quantity}</span>
                        <span className="font-medium">₹{m.total.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Payment Summary */}
              <div className="bg-muted/30 p-4 rounded-lg space-y-2 border">
                <div className="flex justify-between text-sm">
                  <span>Final Amount:</span>
                  <span className="font-semibold">₹{selectedBillForDetails.finalAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm text-green-600">
                  <span>Amount Paid:</span>
                  <span className="font-semibold">₹{selectedBillForDetails.amountPaid.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm text-destructive border-t pt-2">
                  <span className="font-semibold">Pending Amount:</span>
                  <span className="font-bold">₹{selectedBillForDetails.pendingAmount.toLocaleString()}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setSelectedBillForDetails(null);
                    setLocation("/billing");
                  }}
                >
                  Go to Bills Page
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => {
                    setSelectedBillForDetails(null);
                    setLocation(`/patient/${selectedBillForDetails.patientId}`);
                  }}
                >
                  View Patient Profile
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
