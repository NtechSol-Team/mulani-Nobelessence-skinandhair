import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Pill,
  Calendar,
  IndianRupee,
  ChevronDown,
  ChevronUp,
  Activity,
  Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import type { Bill, Medicine, Expense, Patient } from "@shared/schema";
import { extractPaginatedData } from "@/lib/utils";
import {
  format,
  startOfMonth,
  endOfMonth,
  isWithinInterval,
  subMonths,
} from "date-fns";

const COLORS = ["hsl(174, 55%, 42%)", "hsl(200, 60%, 50%)", "hsl(280, 55%, 55%)", "hsl(35, 80%, 55%)", "hsl(350, 70%, 55%)"];

export default function Reports() {
  const [dateFilter, setDateFilter] = useState("current-month");
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");
  const [medicineReportTab, setMedicineReportTab] = useState<"period" | "monthly" | "overall">("period");
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  const [treatmentTrendMode, setTreatmentTrendMode] = useState<"count" | "revenue">("count");
  const { data: billsResponse, isLoading: billsLoading } = useQuery({
    queryKey: ["/api/bills"],
  });
  const bills = extractPaginatedData<Bill>(billsResponse);

  const { data: medicinesResponse, isLoading: medicinesLoading } = useQuery({
    queryKey: ["/api/medicines"],
  });
  const medicines = extractPaginatedData<Medicine>(medicinesResponse);

  const { data: expensesResponse, isLoading: expensesLoading } = useQuery({
    queryKey: ["/api/expenses"],
  });
  const expenses = extractPaginatedData<Expense>(expensesResponse);

  const { data: patientsResponse, isLoading: patientsLoading } = useQuery({
    queryKey: ["/api/patients"],
  });
  const patients = extractPaginatedData<Patient>(patientsResponse);

  const { data: paymentLedgersResponse, isLoading: paymentLedgersLoading } = useQuery({
    queryKey: ["/api/payment-ledgers"],
  });
  const paymentLedgers = Array.isArray(paymentLedgersResponse) ? paymentLedgersResponse : [];

  const isLoading = billsLoading || medicinesLoading || expensesLoading || patientsLoading || paymentLedgersLoading;

  const today = new Date();
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);

  // Calculate date range based on filter
  let dateRangeStart = monthStart;
  let dateRangeEnd = monthEnd;

  if (dateFilter === "current-month") {
    dateRangeStart = monthStart;
    dateRangeEnd = monthEnd;
  } else if (dateFilter === "last-month") {
    const lastMonth = subMonths(today, 1);
    dateRangeStart = startOfMonth(lastMonth);
    dateRangeEnd = endOfMonth(lastMonth);
  } else if (dateFilter === "last-3-months") {
    dateRangeStart = startOfMonth(subMonths(today, 2));
    dateRangeEnd = monthEnd;
  } else if (dateFilter === "last-6-months") {
    dateRangeStart = startOfMonth(subMonths(today, 5));
    dateRangeEnd = monthEnd;
  } else if (dateFilter === "custom" && customStartDate && customEndDate) {
    dateRangeStart = new Date(customStartDate);
    dateRangeEnd = new Date(customEndDate);
  }

  const thisMonthBills = bills.filter((b) =>
    isWithinInterval(new Date(b.date), { start: dateRangeStart, end: dateRangeEnd })
  );
  const thisMonthExpenses = expenses.filter((e) =>
    isWithinInterval(new Date(e.date), { start: dateRangeStart, end: dateRangeEnd })
  );

  // Revenue = sum of finalAmount for all bills in the period
  const thisMonthRevenue = thisMonthBills.reduce(
    (sum, b) => sum + (typeof b.finalAmount === 'number' ? b.finalAmount : parseFloat(String(b.finalAmount)) || 0),
    0
  );

  // Total discount = sum of (grandTotal - finalAmount) for all bills
  const thisMonthDiscount = thisMonthBills.reduce(
    (sum, b) => {
      const grandTotal = typeof b.grandTotal === 'number' ? b.grandTotal : parseFloat(String(b.grandTotal)) || 0;
      const finalAmount = typeof b.finalAmount === 'number' ? b.finalAmount : parseFloat(String(b.finalAmount)) || 0;
      return sum + (grandTotal - finalAmount);
    },
    0
  );

  const thisMonthTreatmentRevenue = thisMonthBills.reduce(
    (sum, b) => sum + b.treatmentTotal,
    0
  );
  const thisMonthMedicineRevenue = thisMonthBills.reduce(
    (sum, b) => sum + b.medicineTotal,
    0
  );
  const thisMonthExpenseTotal = thisMonthExpenses.reduce((sum, e) => sum + e.amount, 0);

  // Payment Breakdown
  const thisMonthPayments = paymentLedgers.filter((p) =>
    isWithinInterval(new Date(p.date), { start: dateRangeStart, end: dateRangeEnd })
  );
  const cashPayments = thisMonthPayments.filter(p => p.paymentMode === "Cash").reduce((sum, p) => sum + p.amount, 0);
  const onlinePayments = thisMonthPayments.filter(p => p.paymentMode === "Online").reduce((sum, p) => sum + p.amount, 0);

  // Medicine profit data filtered by selected date range
  const filteredMedicineProfitData = medicines.map((medicine) => {
    const soldItems = thisMonthBills.flatMap((b) =>
      b.medicines.filter((m) => m.medicineId === medicine.id)
    );
    const quantitySold = soldItems.reduce((sum, m) => sum + m.quantity, 0);
    const totalRevenue = soldItems.reduce((sum, m) => sum + m.total, 0);
    const totalCost = quantitySold * medicine.purchaseCost;
    const profit = totalRevenue - totalCost;

    return {
      medicineId: medicine.id,
      medicineName: medicine.name,
      quantitySold,
      totalRevenue,
      totalCost,
      profit,
    };
  }).filter((m) => m.quantitySold > 0);

  // Overall medicine profit data (all time)
  const overallMedicineProfitData = medicines.map((medicine) => {
    const soldItems = bills.flatMap((b) =>
      b.medicines.filter((m) => m.medicineId === medicine.id)
    );
    const quantitySold = soldItems.reduce((sum, m) => sum + m.quantity, 0);
    const totalRevenue = soldItems.reduce((sum, m) => sum + m.total, 0);
    const totalCost = quantitySold * medicine.purchaseCost;
    const profit = totalRevenue - totalCost;

    return {
      medicineId: medicine.id,
      medicineName: medicine.name,
      quantitySold,
      totalRevenue,
      totalCost,
      profit,
    };
  }).filter((m) => m.quantitySold > 0);

  // Monthly breakdown: medicine sales for each of the last 6 months
  const monthlyMedicineSales = Array.from({ length: 6 }, (_, i) => {
    const date = subMonths(today, 5 - i);
    const start = startOfMonth(date);
    const end = endOfMonth(date);
    const monthLabel = format(date, "MMM yyyy");

    const monthBills = bills.filter((b) =>
      isWithinInterval(new Date(b.date), { start, end })
    );

    const medicineSales = medicines.map((medicine) => {
      const soldItems = monthBills.flatMap((b) =>
        b.medicines.filter((m) => m.medicineId === medicine.id)
      );
      const quantitySold = soldItems.reduce((sum, m) => sum + m.quantity, 0);
      const totalRevenue = soldItems.reduce((sum, m) => sum + m.total, 0);
      const totalCost = quantitySold * medicine.purchaseCost;
      const profit = totalRevenue - totalCost;

      return {
        medicineId: medicine.id,
        medicineName: medicine.name,
        quantitySold,
        totalRevenue,
        profit,
      };
    }).filter((m) => m.quantitySold > 0);

    return {
      month: monthLabel,
      medicineSales,
      totalQuantity: medicineSales.reduce((sum, m) => sum + m.quantitySold, 0),
      totalRevenue: medicineSales.reduce((sum, m) => sum + m.totalRevenue, 0),
      totalProfit: medicineSales.reduce((sum, m) => sum + m.profit, 0),
    };
  });

  // Use filtered data for the medicine profit card
  const totalMedicineProfit = filteredMedicineProfitData.reduce((sum, m) => sum + m.profit, 0);
  const totalProfit = thisMonthRevenue - thisMonthExpenseTotal;

  const last6Months = Array.from({ length: 6 }, (_, i) => {
    const date = subMonths(today, 5 - i);
    const start = startOfMonth(date);
    const end = endOfMonth(date);

    const monthBills = bills.filter((b) =>
      isWithinInterval(new Date(b.date), { start, end })
    );
    const monthExpenses = expenses.filter((e) =>
      isWithinInterval(new Date(e.date), { start, end })
    );

    const revenue = monthBills.reduce((sum, b) => sum + (b.finalAmount !== undefined && b.finalAmount !== null ? b.finalAmount : b.grandTotal), 0);
    const expenseTotal = monthExpenses.reduce((sum, e) => sum + e.amount, 0);
    const uniquePatientIds = new Set(monthBills.map(b => b.patientId));

    // New patients: Registered within this month
    const newPatients = patients.filter((p) => {
      const regDate = new Date(p.registrationDate);
      return isWithinInterval(regDate, { start, end });
    }).length;

    // Repeat patients: Visited this month but registered before this month
    let repeatPatients = 0;
    uniquePatientIds.forEach(pid => {
      const p = patients.find(patient => patient.id === pid);
      if (p) {
        const regDate = new Date(p.registrationDate);
        if (regDate < start) {
          repeatPatients++;
        }
      }
    });

    return {
      month: format(date, "MMM"),
      revenue,
      expenses: expenseTotal,
      profit: revenue - expenseTotal,
      patients: uniquePatientIds.size,
      newPatients,
      repeatPatients,
    };
  });

  const revenueSplit = [
    { name: "Treatments", value: thisMonthTreatmentRevenue },
    { name: "Medicines", value: thisMonthMedicineRevenue },
  ].filter((item) => item.value > 0);

  // Treatment Trends - Count treatment frequency from bills
  const rawTreatmentTrends = thisMonthBills.reduce((acc, bill) => {
    bill.treatments.forEach((treatment) => {
      const existing = acc.find((t) => t.treatmentId === treatment.treatmentId);
      if (existing) {
        existing.count += 1;
        existing.totalRevenue += treatment.price;
      } else {
        acc.push({
          treatmentId: treatment.treatmentId,
          treatmentName: treatment.treatmentName,
          count: 1,
          totalRevenue: treatment.price,
        });
      }
    });
    return acc;
  }, [] as { treatmentId: string; treatmentName: string; count: number; totalRevenue: number }[]);

  const treatmentTrends = rawTreatmentTrends
    .sort((a, b) => treatmentTrendMode === "count" ? b.count - a.count : b.totalRevenue - a.totalRevenue)
    .slice(0, 5); // Top 5 treatments

  // Calculate max count for progress bar percentages
  const maxTreatmentValue = treatmentTrends.length > 0 ? treatmentTrends[0][treatmentTrendMode === 'count' ? 'count' : 'totalRevenue'] : 0;

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-page-title">
          Reports & Analytics
        </h1>
        <p className="text-muted-foreground">
          Financial overview and performance metrics
        </p>
      </div>

      <Card className="bg-card/50">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <label className="text-sm font-medium">Filter by Date:</label>
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Select date range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="current-month">Current Month</SelectItem>
                <SelectItem value="last-month">Last Month</SelectItem>
                <SelectItem value="last-3-months">Last 3 Months</SelectItem>
                <SelectItem value="last-6-months">Last 6 Months</SelectItem>
                <SelectItem value="custom">Custom Range</SelectItem>
              </SelectContent>
            </Select>
            {dateFilter === "custom" && (
              <div className="flex flex-col sm:flex-row gap-2 flex-1">
                <Input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  placeholder="Start date"
                  className="flex-1"
                />
                <Input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  placeholder="End date"
                  className="flex-1"
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Monthly Revenue
            </CardTitle>
            <TrendingUp className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-monthly-revenue">
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                `₹${thisMonthRevenue.toLocaleString()}`
              )}
            </div>
            <div className="text-xs text-muted-foreground mt-2 flex items-center justify-between">
              <span>Cash: <span className="font-medium text-foreground">₹{cashPayments.toLocaleString()}</span></span>
              <span>Online: <span className="font-medium text-foreground">₹{onlinePayments.toLocaleString()}</span></span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Monthly Expenses
            </CardTitle>
            <TrendingDown className="w-4 h-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive" data-testid="text-monthly-expenses">
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                `₹${thisMonthExpenseTotal.toLocaleString()}`
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {thisMonthExpenses.length} expense entries
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Discounts
            </CardTitle>
            <IndianRupee className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-discount">
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                `₹${thisMonthDiscount.toLocaleString()}`
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Given this period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Net Profit
            </CardTitle>
            <IndianRupee className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${totalProfit >= 0 ? "text-primary" : "text-destructive"
                }`}
              data-testid="text-net-profit"
            >
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                `₹${totalProfit.toLocaleString()}`
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Revenue - Expenses
            </p>
          </CardContent>
        </Card>


      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <BarChart3 className="w-5 h-5 text-primary" />
              6-Month Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={last6Months}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="month"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                  />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                    labelStyle={{ color: "hsl(var(--foreground))" }}
                  />
                  <Bar
                    dataKey="revenue"
                    fill="hsl(174, 55%, 42%)"
                    name="Revenue"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="expenses"
                    fill="hsl(0, 65%, 50%)"
                    name="Expenses"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calendar className="w-5 h-5 text-primary" />
              Revenue Split
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : revenueSplit.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                No revenue data for this month
              </div>
            ) : (
              <div className="flex items-center gap-6">
                <ResponsiveContainer width="50%" height={200}>
                  <PieChart>
                    <Pie
                      data={revenueSplit}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                    >
                      {revenueSplit.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                      formatter={(value: number) => `₹${value.toLocaleString()}`}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-3 flex-1">
                  {revenueSplit.map((item, index) => (
                    <div key={item.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <span className="text-sm font-medium">{item.name}</span>
                      </div>
                      <span className="text-sm">₹{item.value.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="w-5 h-5 text-primary" />
            Patient Visits (6-Month Trend)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-[220px] w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={last6Months} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="month"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                />
                <Line
                  type="monotone"
                  dataKey="newPatients"
                  stroke="hsl(200, 60%, 50%)"
                  strokeWidth={2}
                  name="New Patients"
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
                <Line
                  type="monotone"
                  dataKey="repeatPatients"
                  stroke="hsl(280, 55%, 55%)"
                  strokeWidth={2}
                  name="Repeat Patients"
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Treatment Trends Chart */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Activity className="w-5 h-5 text-primary" />
                Top 5 Treatment Trends
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Most popular treatments based on billing {treatmentTrendMode === 'count' ? 'frequency' : 'revenue'}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 text-right">
              <div className="flex p-1 bg-muted rounded-lg">
                <button
                  onClick={() => setTreatmentTrendMode("count")}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${treatmentTrendMode === "count"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                    }`}
                >
                  By Count
                </button>
                <button
                  onClick={() => setTreatmentTrendMode("revenue")}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${treatmentTrendMode === "revenue"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                    }`}
                >
                  By Revenue
                </button>
              </div>
              <div className="flex flex-col sm:items-end">
                <div className="text-2xl font-bold text-primary">
                  {treatmentTrendMode === "count"
                    ? treatmentTrends.reduce((sum, t) => sum + t.count, 0)
                    : `₹${treatmentTrends.reduce((sum, t) => sum + t.totalRevenue, 0).toLocaleString()}`}
                </div>
                <p className="text-xs text-muted-foreground">Total {treatmentTrendMode === "count" ? "Treatments" : "Revenue"}</p>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : treatmentTrends.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Activity className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No treatment data for this period</p>
                <p className="text-sm">Treatment statistics will appear once bills are created</p>
              </div>
            </div>
          ) : (
            <div className="grid lg:grid-cols-2 gap-8">
              {/* Donut Chart */}
              <div className="flex flex-col items-center justify-center">
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={treatmentTrends}
                      dataKey={treatmentTrendMode === "count" ? "count" : "totalRevenue"}
                      nameKey="treatmentName"
                      cx="50%"
                      cy="50%"
                      innerRadius={70}
                      outerRadius={110}
                      paddingAngle={2}
                      strokeWidth={0}
                    >
                      {treatmentTrends.map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        padding: "8px 12px",
                      }}
                      formatter={(value: number, name: string) => [
                        treatmentTrendMode === "count" ? `${value} treatments` : `₹${value.toLocaleString()}`,
                        name
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Legend */}
                <div className="flex flex-wrap justify-center gap-4 mt-2">
                  {treatmentTrends.slice(0, 5).map((treatment, index) => (
                    <div key={treatment.treatmentId} className="flex items-center gap-1.5">
                      <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span className="text-xs text-muted-foreground">
                        {treatment.treatmentName.length > 15
                          ? `${treatment.treatmentName.slice(0, 15)}...`
                          : treatment.treatmentName}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Treatment List */}
              <div className="space-y-4">
                {treatmentTrends.map((treatment, index) => {
                  const value = treatmentTrendMode === "count" ? treatment.count : treatment.totalRevenue;
                  const percentage = maxTreatmentValue > 0 ? (value / maxTreatmentValue) * 100 : 0;

                  return (
                    <div
                      key={treatment.treatmentId}
                      className="group"
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold text-white"
                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                          >
                            {index + 1}
                          </div>
                          <div>
                            <h4 className="font-medium text-sm leading-tight">
                              {treatment.treatmentName}
                            </h4>
                            <p className="text-xs text-muted-foreground">
                              ₹{treatment.totalRevenue.toLocaleString()} revenue
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-semibold">
                            {treatmentTrendMode === "count" ? treatment.count : `₹${treatment.totalRevenue.toLocaleString()}`}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {treatmentTrendMode === "count" ? (treatment.count === 1 ? "treatment" : "treatments") : "revenue"}
                          </p>
                        </div>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500 ease-out"
                          style={{
                            width: `${percentage}%`,
                            backgroundColor: COLORS[index % COLORS.length],
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Pill className="w-5 h-5 text-primary" />
              Medicine-wise Profit Analysis
            </CardTitle>
            <div className="flex gap-2">
              <button
                onClick={() => setMedicineReportTab("period")}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${medicineReportTab === "period"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-muted/80"
                  }`}
              >
                Selected Period
              </button>
              <button
                onClick={() => setMedicineReportTab("monthly")}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${medicineReportTab === "monthly"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-muted/80"
                  }`}
              >
                Monthly Breakdown
              </button>
              <button
                onClick={() => setMedicineReportTab("overall")}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${medicineReportTab === "overall"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-muted/80"
                  }`}
              >
                Overall (All Time)
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : medicineReportTab === "monthly" ? (
            // Monthly Breakdown View with Collapsible Dropdowns
            <div className="space-y-3">
              {monthlyMedicineSales.map((monthData) => {
                const isExpanded = expandedMonths.has(monthData.month);
                const toggleMonth = () => {
                  setExpandedMonths((prev) => {
                    const newSet = new Set(prev);
                    if (newSet.has(monthData.month)) {
                      newSet.delete(monthData.month);
                    } else {
                      newSet.add(monthData.month);
                    }
                    return newSet;
                  });
                };

                return (
                  <div key={monthData.month} className="border rounded-lg overflow-hidden">
                    <button
                      onClick={toggleMonth}
                      className="w-full bg-muted/50 px-4 py-3 hover:bg-muted/70 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {isExpanded ? (
                            <ChevronUp className="w-5 h-5 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-muted-foreground" />
                          )}
                          <h4 className="font-semibold text-lg">{monthData.month}</h4>
                        </div>
                        <div className="flex gap-4 text-sm">
                          <span>
                            <span className="text-muted-foreground">Qty:</span>{" "}
                            <span className="font-medium">{monthData.totalQuantity}</span>
                          </span>
                          <span>
                            <span className="text-muted-foreground">Revenue:</span>{" "}
                            <span className="font-medium">₹{monthData.totalRevenue.toLocaleString()}</span>
                          </span>
                          <span>
                            <span className="text-muted-foreground">Profit:</span>{" "}
                            <span className={`font-medium ${monthData.totalProfit >= 0 ? "text-primary" : "text-destructive"}`}>
                              ₹{monthData.totalProfit.toLocaleString()}
                            </span>
                          </span>
                        </div>
                      </div>
                    </button>
                    {isExpanded && (
                      <>
                        {monthData.medicineSales.length === 0 ? (
                          <div className="px-4 py-6 text-center text-muted-foreground border-t">
                            No medicine sales this month
                          </div>
                        ) : (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Medicine Name</TableHead>
                                <TableHead className="text-right">Qty Sold</TableHead>
                                <TableHead className="text-right">Revenue</TableHead>
                                <TableHead className="text-right">Profit</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {monthData.medicineSales
                                .sort((a, b) => b.quantitySold - a.quantitySold)
                                .map((item) => (
                                  <TableRow key={item.medicineId}>
                                    <TableCell className="font-medium">
                                      {item.medicineName}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      {item.quantitySold}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      ₹{item.totalRevenue.toFixed(2)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      <span
                                        className={
                                          item.profit >= 0 ? "text-primary" : "text-destructive"
                                        }
                                      >
                                        ₹{item.profit.toFixed(2)}
                                      </span>
                                    </TableCell>
                                  </TableRow>
                                ))}
                            </TableBody>
                          </Table>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            // Period or Overall View
            (() => {
              const dataToShow = medicineReportTab === "period" ? filteredMedicineProfitData : overallMedicineProfitData;
              const totalProfit = dataToShow.reduce((sum, m) => sum + m.profit, 0);
              const totalRevenue = dataToShow.reduce((sum, m) => sum + m.totalRevenue, 0);
              const totalQty = dataToShow.reduce((sum, m) => sum + m.quantitySold, 0);

              return dataToShow.length === 0 ? (
                <div className="text-center py-12">
                  <Pill className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-1">No medicine sales data</h3>
                  <p className="text-muted-foreground text-sm">
                    {medicineReportTab === "period"
                      ? "No medicine sales in the selected period"
                      : "Medicine profit analysis will appear here once medicines are sold"}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Summary Stats */}
                  <div className="grid grid-cols-3 gap-4 p-4 bg-muted/30 rounded-lg">
                    <div className="text-center">
                      <div className="text-2xl font-bold">{totalQty}</div>
                      <div className="text-sm text-muted-foreground">Total Quantity Sold</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold">₹{totalRevenue.toLocaleString()}</div>
                      <div className="text-sm text-muted-foreground">Total Revenue</div>
                    </div>
                    <div className="text-center">
                      <div className={`text-2xl font-bold ${totalProfit >= 0 ? "text-primary" : "text-destructive"}`}>
                        ₹{totalProfit.toLocaleString()}
                      </div>
                      <div className="text-sm text-muted-foreground">Total Profit</div>
                    </div>
                  </div>

                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Medicine Name</TableHead>
                          <TableHead className="text-right">Qty Sold</TableHead>
                          <TableHead className="text-right">Revenue</TableHead>
                          <TableHead className="text-right">Cost</TableHead>
                          <TableHead className="text-right">Profit</TableHead>
                          <TableHead className="text-right">Margin</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dataToShow
                          .sort((a, b) => b.profit - a.profit)
                          .map((item) => {
                            const margin =
                              item.totalRevenue > 0
                                ? ((item.profit / item.totalRevenue) * 100).toFixed(1)
                                : 0;

                            return (
                              <TableRow
                                key={item.medicineId}
                                data-testid={`row-medicine-profit-${item.medicineId}`}
                              >
                                <TableCell className="font-medium">
                                  {item.medicineName}
                                </TableCell>
                                <TableCell className="text-right">
                                  {item.quantitySold}
                                </TableCell>
                                <TableCell className="text-right">
                                  ₹{item.totalRevenue.toFixed(2)}
                                </TableCell>
                                <TableCell className="text-right text-muted-foreground">
                                  ₹{item.totalCost.toFixed(2)}
                                </TableCell>
                                <TableCell className="text-right">
                                  <span
                                    className={
                                      item.profit >= 0 ? "text-primary" : "text-destructive"
                                    }
                                  >
                                    ₹{item.profit.toFixed(2)}
                                  </span>
                                </TableCell>
                                <TableCell className="text-right">
                                  <Badge
                                    variant={Number(margin) >= 20 ? "default" : "secondary"}
                                  >
                                    {margin}%
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              );
            })()
          )}
        </CardContent>
      </Card>
    </div>
  );
}
