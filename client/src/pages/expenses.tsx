import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Wallet,
  Plus,
  Search,
  Edit2,
  Trash2,
  Calendar,
  TrendingDown,
} from "lucide-react";
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
import type { Expense } from "@shared/schema";
import { insertExpenseSchema } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { format, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import { z } from "zod";

const expenseFormSchema = insertExpenseSchema;

type ExpenseForm = z.infer<typeof expenseFormSchema>;

const EXPENSE_CATEGORIES = [
  "Rent",
  "Utilities",
  "Salaries",
  "Equipment",
  "Supplies",
  "Maintenance",
  "Marketing",
  "Insurance",
  "Medicine Purchase",
  "Other",
];

export default function Expenses() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [deletingExpense, setDeletingExpense] = useState<Expense | null>(null);

  const { data: expenses = [], isLoading } = useQuery<Expense[]>({
    queryKey: ["/api/expenses"],
  });

  const form = useForm<ExpenseForm>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: {
      description: "",
      amount: 0,
      date: format(new Date(), "yyyy-MM-dd"),
      category: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: ExpenseForm) => {
      return await apiRequest("POST", "/api/expenses", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      toast({
        title: "Expense Added",
        description: "Expense has been recorded successfully.",
      });
      closeDialog();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Add Expense",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ExpenseForm }) => {
      return await apiRequest("PATCH", `/api/expenses/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      toast({
        title: "Expense Updated",
        description: "Expense has been updated successfully.",
      });
      closeDialog();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Update Expense",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/expenses/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      toast({
        title: "Expense Deleted",
        description: "Expense has been removed.",
      });
      setDeletingExpense(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Delete Expense",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingExpense(null);
    form.reset({
      description: "",
      amount: 0,
      date: format(new Date(), "yyyy-MM-dd"),
      category: "",
    });
  };

  const openEditDialog = (expense: Expense) => {
    setEditingExpense(expense);
    form.reset({
      description: expense.description,
      amount: expense.amount,
      date: expense.date,
      category: expense.category,
    });
    setIsDialogOpen(true);
  };

  const onSubmit = (data: ExpenseForm) => {
    if (editingExpense) {
      updateMutation.mutate({ id: editingExpense.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const filteredExpenses = expenses.filter(
    (e) =>
      e.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sortedExpenses = [...filteredExpenses].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  const today = new Date();
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);
  const thisMonthExpenses = expenses.filter((e) =>
    isWithinInterval(new Date(e.date), { start: monthStart, end: monthEnd })
  );
  const thisMonthTotal = thisMonthExpenses.reduce((sum, e) => sum + e.amount, 0);

  const categoryTotals = expenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.amount;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-page-title">
          Expense Master
        </h1>
        <p className="text-muted-foreground">
          Track and manage clinic expenses
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Expenses
            </CardTitle>
            <Wallet className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-expenses">
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                `₹${totalExpenses.toLocaleString()}`
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              All time
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              This Month
            </CardTitle>
            <Calendar className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-month-expenses">
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                `₹${thisMonthTotal.toLocaleString()}`
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {format(today, "MMMM yyyy")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Expense Entries
            </CardTitle>
            <TrendingDown className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-expense-count">
              {isLoading ? <Skeleton className="h-8 w-16" /> : expenses.length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Total records
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Wallet className="w-5 h-5 text-primary" />
                Expense Records
              </CardTitle>
              <div className="flex items-center gap-3">
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Search expenses..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                    data-testid="input-expense-search"
                  />
                </div>
                <Dialog open={isDialogOpen} onOpenChange={(open) => !open && closeDialog()}>
                  <DialogTrigger asChild>
                    <Button onClick={() => setIsDialogOpen(true)} data-testid="button-add-expense">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Expense
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>
                        {editingExpense ? "Edit Expense" : "Add New Expense"}
                      </DialogTitle>
                    </DialogHeader>
                    <Form {...form}>
                      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                          control={form.control}
                          name="description"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Description</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="Enter expense description"
                                  {...field}
                                  data-testid="input-expense-description"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="amount"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Amount (₹)</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    placeholder="0"
                                    {...field}
                                    onChange={(e) =>
                                      field.onChange(parseFloat(e.target.value) || 0)
                                    }
                                    data-testid="input-expense-amount"
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
                                    data-testid="input-expense-date"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <FormField
                          control={form.control}
                          name="category"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Category</FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger data-testid="select-expense-category">
                                    <SelectValue placeholder="Select category" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {EXPENSE_CATEGORIES.map((category) => (
                                    <SelectItem key={category} value={category}>
                                      {category}
                                    </SelectItem>
                                  ))}
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
                            disabled={createMutation.isPending || updateMutation.isPending}
                            data-testid="button-save-expense"
                          >
                            {createMutation.isPending || updateMutation.isPending
                              ? "Saving..."
                              : editingExpense
                              ? "Update"
                              : "Add Expense"}
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
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : sortedExpenses.length === 0 ? (
              <div className="text-center py-12">
                <Wallet className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-1">No expenses found</h3>
                <p className="text-muted-foreground text-sm">
                  {searchQuery
                    ? "Try adjusting your search"
                    : "Add your first expense to get started"}
                </p>
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedExpenses.map((expense) => (
                      <TableRow key={expense.id} data-testid={`row-expense-${expense.id}`}>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(expense.date), "dd MMM yyyy")}
                        </TableCell>
                        <TableCell className="font-medium">
                          {expense.description}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{expense.category}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          ₹{expense.amount.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditDialog(expense)}
                              data-testid={`button-edit-expense-${expense.id}`}
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive"
                              onClick={() => setDeletingExpense(expense)}
                              data-testid={`button-delete-expense-${expense.id}`}
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
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">By Category</CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(categoryTotals).length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-4">
                No expenses recorded yet
              </p>
            ) : (
              <div className="space-y-3">
                {Object.entries(categoryTotals)
                  .sort((a, b) => b[1] - a[1])
                  .map(([category, amount]) => (
                    <div
                      key={category}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                    >
                      <span className="font-medium text-sm">{category}</span>
                      <span className="text-sm">₹{amount.toLocaleString()}</span>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={!!deletingExpense} onOpenChange={() => setDeletingExpense(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Expense</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this expense entry? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              onClick={() => deletingExpense && deleteMutation.mutate(deletingExpense.id)}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
