import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Search, Users, Calendar, Phone, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertAppointmentSchema, type Patient, type Bill, type Visit, type Appointment, type Department } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format, startOfMonth, endOfMonth, isWithinInterval, subMonths } from "date-fns";
import { extractPaginatedData } from "@/lib/utils";
import { z } from "zod";

type AppointmentForm = z.infer<typeof insertAppointmentSchema>;

export default function PatientsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [patientFilter, setPatientFilter] = useState<"all" | "new" | "repeat" | "upcoming">("all");
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  const [selectedPatientForAppointment, setSelectedPatientForAppointment] = useState<Patient | null>(null);
  const [patientDateFilter, setPatientDateFilter] = useState<string>("all-time");
  const [patientStartDate, setPatientStartDate] = useState<string>("");
  const [patientEndDate, setPatientEndDate] = useState<string>("");
  const [selectedDepartment, setSelectedDepartment] = useState<string>("All");
  const [viewMode, setViewMode] = useState<"card" | "table">("card");

  const appointmentForm = useForm<AppointmentForm>({
    resolver: zodResolver(insertAppointmentSchema),
    defaultValues: {
      patientId: "",
      date: format(new Date(), "yyyy-MM-dd"),
      reason: "",
      status: "Scheduled",
      type: "New",
    },
  });

  useEffect(() => {
    if (selectedPatientForAppointment) {
      appointmentForm.setValue("patientId", selectedPatientForAppointment.id);
    }
  }, [selectedPatientForAppointment, appointmentForm]);

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
      appointmentForm.reset();
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

  const { data: appointmentsResponse } = useQuery({
    queryKey: ["/api/appointments"],
  });
  const appointments = Array.isArray(appointmentsResponse) ? appointmentsResponse : [];

  const { data: departmentsResponse } = useQuery({
    queryKey: ["/api/departments"],
  });
  const departments = Array.isArray(departmentsResponse) ? (departmentsResponse as Department[]) : [];

  // Parse YYYY-MM-DD strings safely to local Date objects to avoid timezone offset shifts
  const parseLocalDate = (dateStr: string): Date => {
    if (!dateStr) return new Date();
    const [year, month, day] = dateStr.split("-").map(Number);
    return new Date(year, month - 1, day, 12, 0, 0, 0);
  };

  // Helper date ranges for patients tab filters (new/repeat/upcoming)
  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");

  let activeDateStart = parseLocalDate("2000-01-01");
  let activeDateEnd = parseLocalDate("2100-01-01");

  if (patientDateFilter === "today") {
    activeDateStart = parseLocalDate(todayStr);
    activeDateEnd = parseLocalDate(todayStr);
  } else if (patientDateFilter === "this-week") {
    const dayOfWeek = today.getDay();
    const start = new Date(today);
    start.setDate(today.getDate() - dayOfWeek);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    activeDateStart = parseLocalDate(format(start, "yyyy-MM-dd"));
    activeDateEnd = parseLocalDate(format(end, "yyyy-MM-dd"));
  } else if (patientDateFilter === "this-month") {
    activeDateStart = parseLocalDate(format(startOfMonth(today), "yyyy-MM-dd"));
    activeDateEnd = parseLocalDate(format(endOfMonth(today), "yyyy-MM-dd"));
  } else if (patientDateFilter === "last-month") {
    const prevMonth = subMonths(today, 1);
    activeDateStart = parseLocalDate(format(startOfMonth(prevMonth), "yyyy-MM-dd"));
    activeDateEnd = parseLocalDate(format(endOfMonth(prevMonth), "yyyy-MM-dd"));
  } else if (patientDateFilter === "custom" && patientStartDate && patientEndDate) {
    activeDateStart = parseLocalDate(patientStartDate);
    activeDateEnd = parseLocalDate(patientEndDate);
  }

  // Active New Patients
  const activeNewPatients = patients.filter((p) => {
    const regDate = parseLocalDate(p.registrationDate);
    return isWithinInterval(regDate, { start: activeDateStart, end: activeDateEnd });
  });

  // Active Repeat Patients (visits within the date range)
  const activeIntervalVisits = visits.filter((v) => {
    const vDate = parseLocalDate(v.date);
    return isWithinInterval(vDate, { start: activeDateStart, end: activeDateEnd });
  });
  const activePatientIdsWithVisits = new Set(activeIntervalVisits.map((v) => v.patientId));
  const activeRepeatPatients = patients.filter((p) => {
    const regDate = parseLocalDate(p.registrationDate);
    return activePatientIdsWithVisits.has(p.id) && regDate < activeDateStart;
  });

  // Active Upcoming Appointments
  const activeUpcomingAppointments = appointments.filter((ap) => {
    if (ap.status !== "Scheduled") return false;
    const apDate = parseLocalDate(ap.date);
    return isWithinInterval(apDate, { start: activeDateStart, end: activeDateEnd }) && apDate >= parseLocalDate(todayStr);
  });
  const activeUpcomingPatientIds = new Set(activeUpcomingAppointments.map((ap) => ap.patientId));

  // Active All Patients
  const activeAllPatients = patients.filter((p) => {
    const registeredInInterval = isWithinInterval(parseLocalDate(p.registrationDate), { start: activeDateStart, end: activeDateEnd });
    const visitedInInterval = activePatientIdsWithVisits.has(p.id);
    const hasAppointmentInInterval = activeUpcomingPatientIds.has(p.id);
    return registeredInInterval || visitedInInterval || hasAppointmentInInterval;
  });

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

    basePatients = basePatients.filter(
      (patient) =>
        patient.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        patient.phone.includes(searchQuery)
    );

    if (selectedDepartment && selectedDepartment !== "All") {
      basePatients = basePatients.filter(
        (patient) => patient.department === selectedDepartment
      );
    }

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

      return new Date(b.registrationDate).getTime() - new Date(a.registrationDate).getTime();
    });

    return basePatients;
  };

  const displayedPatients = getDisplayedPatients();
  const totalPages = Math.ceil(displayedPatients.length / ITEMS_PER_PAGE);

  useEffect(() => {
    setCurrentPage(1);
  }, [patientFilter, searchQuery, patientDateFilter, patientStartDate, patientEndDate, selectedDepartment]);

  const paginatedPatients = displayedPatients.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Patient Directory</h1>
        <p className="text-muted-foreground text-sm">
          View all registered patients, track their visit histories, and search/filter profiles.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <CardTitle className="text-lg font-medium">All Patients</CardTitle>
              <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Search by name or phone..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={patientDateFilter} onValueChange={setPatientDateFilter}>
                  <SelectTrigger className="w-full sm:w-40 bg-background">
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
                <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                  <SelectTrigger className="w-full sm:w-44 bg-background">
                    <SelectValue placeholder="All Departments" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Departments</SelectItem>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.name}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex border rounded-md p-1 bg-muted shrink-0 h-9 items-center">
                  <button
                    type="button"
                    onClick={() => setViewMode("card")}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-sm transition-all ${
                      viewMode === "card"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Card
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("table")}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-sm transition-all ${
                      viewMode === "table"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Table
                  </button>
                </div>
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
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  patientFilter === "all"
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
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  patientFilter === "new"
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
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  patientFilter === "repeat"
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
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  patientFilter === "upcoming"
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
                Try adjusting your filters or search query.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {viewMode === "table" ? (
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm text-left border-collapse">
                    <thead className="bg-muted/50 text-muted-foreground text-xs uppercase font-semibold">
                      <tr className="border-b">
                        <th className="p-3">Patient Name</th>
                        <th className="p-3">Phone</th>
                        <th className="p-3">Department</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Registered</th>
                        <th className="p-3">Last Visit</th>
                        <th className="p-3">Next Visit</th>
                        <th className="p-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {paginatedPatients.map((patient) => {
                        const patientBills = bills.filter((b) => b.patientId === patient.id);
                        const hasPending = patientBills.some((b) => b.pendingAmount > 0);

                        const patientVisits = visits.filter((v) => v.patientId === patient.id);
                        const lastVisit = patientVisits.length > 0
                          ? patientVisits.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]
                          : null;

                        const nextVisit = appointments
                          .filter(a => a.patientId === patient.id && a.status === "Scheduled")
                          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                          .find(a => new Date(a.date) >= new Date(new Date().setHours(0, 0, 0, 0)));

                        return (
                          <tr key={patient.id} className="hover:bg-muted/30 transition-colors">
                            <td className="p-3 font-medium flex items-center gap-2">
                              <Link href={`/patient/${patient.id}`} className="hover:underline text-primary">
                                {patient.name}
                              </Link>
                              {hasPending && (
                                <Badge variant="destructive" className="text-[10px] px-1 py-0 h-4">
                                  Pending
                                </Badge>
                              )}
                            </td>
                            <td className="p-3 text-muted-foreground">{patient.phone}</td>
                            <td className="p-3">
                              {patient.department ? (
                                <Badge variant="outline" className="text-xs bg-slate-50">
                                  {patient.department}
                                </Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground italic">None</span>
                              )}
                            </td>
                            <td className="p-3">
                              <Badge
                                variant={patient.status === "VIP" ? "default" : patient.status === "Inactive" ? "secondary" : "outline"}
                                className={patient.status === "VIP" ? "bg-amber-500 hover:bg-amber-600 text-white border-transparent" : ""}
                              >
                                {patient.status}
                              </Badge>
                            </td>
                            <td className="p-3 text-muted-foreground text-xs">
                              {format(new Date(patient.registrationDate), "dd MMM yyyy")}
                            </td>
                            <td className="p-3 text-muted-foreground text-xs">
                              {lastVisit ? format(new Date(lastVisit.date), "dd MMM yyyy") : "-"}
                            </td>
                            <td className="p-3 text-xs">
                              {nextVisit ? (
                                <span className="text-blue-600 font-medium flex items-center gap-1">
                                  <Calendar className="w-3.5 h-3.5" />
                                  {format(new Date(nextVisit.date), "dd MMM yyyy")}
                                </span>
                              ) : (
                                "-"
                              )}
                            </td>
                            <td className="p-3 text-right">
                              <Button
                                variant="secondary"
                                size="sm"
                                className="h-8 bg-blue-100 text-blue-700 hover:bg-blue-200 mr-2"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedPatientForAppointment(patient);
                                }}
                              >
                                Book Visit
                              </Button>
                              <Link href={`/patient/${patient.id}`}>
                                <Button variant="outline" size="sm" className="h-8">
                                  View
                                </Button>
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="space-y-2">
                  {paginatedPatients.map((patient) => {
                    const patientBills = bills.filter((b) => b.patientId === patient.id);
                    const hasPending = patientBills.some((b) => b.pendingAmount > 0);

                    const patientVisits = visits.filter((v) => v.patientId === patient.id);
                    const lastVisit = patientVisits.length > 0
                      ? patientVisits.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]
                      : null;

                    const nextVisit = appointments
                      .filter(a => a.patientId === patient.id && a.status === "Scheduled")
                      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                      .find(a => new Date(a.date) >= new Date(new Date().setHours(0, 0, 0, 0)));

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
                                {patient.department && (
                                  <Badge variant="outline" className="text-xs bg-slate-50">
                                    {patient.department}
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
              )}

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
          <Form {...appointmentForm}>
            <form onSubmit={appointmentForm.handleSubmit((data) => createAppointmentMutation.mutate(data))} className="space-y-4">
              <FormField
                control={appointmentForm.control}
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
                control={appointmentForm.control}
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
                control={appointmentForm.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reason for Visit</FormLabel>
                    <FormControl>
                      <Input placeholder="Consultation, Skin peel, etc." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setSelectedPatientForAppointment(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createAppointmentMutation.isPending}>
                  {createAppointmentMutation.isPending ? "Scheduling..." : "Schedule Appointment"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
