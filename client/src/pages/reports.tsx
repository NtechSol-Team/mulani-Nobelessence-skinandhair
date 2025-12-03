import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Pill,
  Calendar,
  IndianRupee,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
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
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import type { Bill, Medicine, Expense } from "@shared/schema";
import {
  format,
  startOfMonth,
  endOfMonth,
  isWithinInterval,
  subMonths,
} from "date-fns";

const COLORS = ["hsl(174, 55%, 42%)", "hsl(200, 60%, 50%)", "hsl(280, 55%, 55%)", "hsl(35, 80%, 55%)", "hsl(350, 70%, 55%)"];

export default function Reports() {
  const { data: bills = [], isLoading: billsLoading } = useQuery<Bill[]>({
    queryKey: ["/api/bills"],
  });

  const { data: medicines = [], isLoading: medicinesLoading } = useQuery<Medicine[]>({
    queryKey: ["/api/medicines"],
  });

  const { data: expenses = [], isLoading: expensesLoading } = useQuery<Expense[]>({
    queryKey: ["/api/expenses"],
  });

  const isLoading = billsLoading || medicinesLoading || expensesLoading;

  const today = new Date();
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);

  const thisMonthBills = bills.filter((b) =>
    isWithinInterval(new Date(b.date), { start: monthStart, end: monthEnd })
  );
  const thisMonthExpenses = expenses.filter((e) =>
    isWithinInterval(new Date(e.date), { start: monthStart, end: monthEnd })
  );

  const thisMonthRevenue = thisMonthBills.reduce((sum, b) => sum + b.grandTotal, 0);
  const thisMonthTreatmentRevenue = thisMonthBills.reduce(
    (sum, b) => sum + b.treatmentTotal,
    0
  );
  const thisMonthMedicineRevenue = thisMonthBills.reduce(
    (sum, b) => sum + b.medicineTotal,
    0
  );
  const thisMonthExpenseTotal = thisMonthExpenses.reduce((sum, e) => sum + e.amount, 0);

  const medicineProfitData = medicines.map((medicine) => {
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

  const totalMedicineProfit = medicineProfitData.reduce((sum, m) => sum + m.profit, 0);
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

    const revenue = monthBills.reduce((sum, b) => sum + b.grandTotal, 0);
    const expenseTotal = monthExpenses.reduce((sum, e) => sum + e.amount, 0);

    return {
      month: format(date, "MMM"),
      revenue,
      expenses: expenseTotal,
      profit: revenue - expenseTotal,
    };
  });

  const revenueSplit = [
    { name: "Treatments", value: thisMonthTreatmentRevenue },
    { name: "Medicines", value: thisMonthMedicineRevenue },
  ].filter((item) => item.value > 0);

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-page-title">
          Reports & Analytics
        </h1>
        <p className="text-muted-foreground">
          Financial overview and performance metrics for {format(today, "MMMM yyyy")}
        </p>
      </div>

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
            <p className="text-xs text-muted-foreground mt-1">
              From {thisMonthBills.length} bills
            </p>
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
              Net Profit
            </CardTitle>
            <IndianRupee className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${
                totalProfit >= 0 ? "text-primary" : "text-destructive"
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

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Medicine Profit
            </CardTitle>
            <Pill className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary" data-testid="text-medicine-profit">
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                `₹${totalMedicineProfit.toLocaleString()}`
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              From medicine sales
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
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Pill className="w-5 h-5 text-primary" />
            Medicine-wise Profit Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : medicineProfitData.length === 0 ? (
            <div className="text-center py-12">
              <Pill className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-1">No medicine sales data</h3>
              <p className="text-muted-foreground text-sm">
                Medicine profit analysis will appear here once medicines are sold
              </p>
            </div>
          ) : (
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
                  {medicineProfitData
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
