import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Search, Users, Calendar, TrendingUp, AlertCircle, ChevronRight, Phone } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { Patient, Bill } from "@shared/schema";
import { extractPaginatedData } from "@/lib/utils";
import { format } from "date-fns";

export default function Dashboard() {
  const [searchQuery, setSearchQuery] = useState("");

  const { data: patientsResponse, isLoading: patientsLoading } = useQuery({
    queryKey: ["/api/patients"],
  });
  const patients = extractPaginatedData<Patient>(patientsResponse);

  const { data: billsResponse } = useQuery({
    queryKey: ["/api/bills"],
  });
  const bills = extractPaginatedData<Bill>(billsResponse);

  const filteredPatients = patients.filter(
    (patient) =>
      patient.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      patient.phone.includes(searchQuery)
  );

  const pendingBills = bills.filter((bill) => bill.pendingAmount > 0);
  const todayPatients = patients.filter(
    (p) => p.registrationDate === format(new Date(), "yyyy-MM-dd")
  );
  const totalRevenue = bills.reduce((sum, bill) => sum + bill.grandTotal, 0);
  
  // Today's bills calculations
  const todayBills = bills.filter((bill) => bill.date === format(new Date(), "yyyy-MM-dd"));
  const todayPaidRevenue = todayBills.reduce((sum, bill) => sum + bill.amountPaid, 0);
  const todayPendingAmount = todayBills.reduce((sum, bill) => sum + bill.pendingAmount, 0);

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-page-title">
          Dashboard
        </h1>
        <p className="text-muted-foreground">
          Overview of your clinic's activity and patient records
        </p>
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
              Today's Patients
            </CardTitle>
            <Calendar className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-today-patients">
              {patientsLoading ? <Skeleton className="h-8 w-16" /> : todayPatients.length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {format(new Date(), "dd MMM yyyy")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Today's Paid
            </CardTitle>
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600" data-testid="text-today-paid">
              {patientsLoading ? <Skeleton className="h-8 w-20" /> : `₹${todayPaidRevenue.toLocaleString()}`}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Amount received today
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Today's Pending
            </CardTitle>
            <AlertCircle className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive" data-testid="text-today-pending">
              {patientsLoading ? <Skeleton className="h-8 w-20" /> : `₹${todayPendingAmount.toLocaleString()}`}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Pending from today's bills
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Revenue
            </CardTitle>
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-revenue">
              {patientsLoading ? <Skeleton className="h-8 w-20" /> : `₹${totalRevenue.toLocaleString()}`}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Total grand amount from all bills
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Bills with Pending
            </CardTitle>
            <AlertCircle className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive" data-testid="text-pending-payments">
              {patientsLoading ? <Skeleton className="h-8 w-16" /> : pendingBills.length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Bills with balance due
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <CardTitle className="text-lg font-medium">All Patients</CardTitle>
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
          </div>
        </CardHeader>
        <CardContent>
          {patientsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredPatients.length === 0 ? (
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
              {filteredPatients.map((patient) => {
                const patientBills = bills.filter((b) => b.patientId === patient.id);
                const hasPending = patientBills.some((b) => b.pendingAmount > 0);
                
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
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Phone className="w-3 h-3" />
                            <span data-testid={`text-patient-phone-${patient.id}`}>
                              {patient.phone}
                            </span>
                            <span className="text-border">|</span>
                            <span>
                              Registered: {format(new Date(patient.registrationDate), "dd MMM yyyy")}
                            </span>
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground" />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
