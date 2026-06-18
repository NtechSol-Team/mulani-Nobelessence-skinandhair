import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Pill,
  Plus,
  Search,
  Edit2,
  Trash2,
  AlertTriangle,
  Package,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
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
import type { Medicine } from "@shared/schema";
import { insertMedicineSchema } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { extractPaginatedData } from "@/lib/utils";
import { z } from "zod";

const medicineFormSchema = insertMedicineSchema;

type MedicineForm = z.infer<typeof medicineFormSchema>;

export default function Medicines() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMedicine, setEditingMedicine] = useState<Medicine | null>(null);
  const [deletingMedicine, setDeletingMedicine] = useState<Medicine | null>(null);

  const { data: medicinesResponse, isLoading } = useQuery({
    queryKey: ["/api/medicines"],
  });
  const medicines = extractPaginatedData<Medicine>(medicinesResponse);

  const form = useForm<MedicineForm>({
    resolver: zodResolver(medicineFormSchema),
    defaultValues: {
      name: "",
      purchaseCost: 0,
      sellingPrice: 0,
      quantity: 0,
      type: "Medicine",
      vendorName: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: MedicineForm) => {
      return await apiRequest("POST", "/api/medicines", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/medicines"] });
      toast({
        title: "Medicine Added",
        description: "Medicine has been added successfully.",
      });
      closeDialog();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Add Medicine",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: MedicineForm }) => {
      return await apiRequest("PATCH", `/api/medicines/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/medicines"] });
      toast({
        title: "Medicine Updated",
        description: "Medicine has been updated successfully.",
      });
      closeDialog();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Update Medicine",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/medicines/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/medicines"] });
      toast({
        title: "Medicine Deleted",
        description: "Medicine has been removed.",
      });
      setDeletingMedicine(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Delete Medicine",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingMedicine(null);
    form.reset({
      name: "",
      purchaseCost: 0,
      sellingPrice: 0,
      quantity: 0,
      type: "Medicine",
      vendorName: "",
    });
  };

  const openEditDialog = (medicine: Medicine) => {
    setEditingMedicine(medicine);
    form.reset({
      name: medicine.name,
      purchaseCost: medicine.purchaseCost,
      sellingPrice: medicine.sellingPrice,
      quantity: medicine.quantity,
      type: medicine.type || "Medicine",
      vendorName: medicine.vendorName || "",
    });
    setIsDialogOpen(true);
  };

  const onSubmit = (data: MedicineForm) => {
    if (editingMedicine) {
      updateMutation.mutate({ id: editingMedicine.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const filteredMedicines = medicines.filter((m) =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const lowStockMedicines = medicines.filter((m) => m.quantity <= 3);
  const totalStockValue = medicines.reduce(
    (sum, m) => sum + m.purchaseCost * m.quantity,
    0
  );

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-page-title">
          Medicine Master
        </h1>
        <p className="text-muted-foreground">
          Manage medicine inventory with purchase and selling prices
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Medicines
            </CardTitle>
            <Pill className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-medicines">
              {isLoading ? <Skeleton className="h-8 w-16" /> : medicines.length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Low Stock Items
            </CardTitle>
            <AlertTriangle className="w-4 h-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive" data-testid="text-low-stock">
              {isLoading ? <Skeleton className="h-8 w-16" /> : lowStockMedicines.length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Stock Value
            </CardTitle>
            <Package className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-stock-value">
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                `₹${totalStockValue.toLocaleString()}`
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Pill className="w-5 h-5 text-primary" />
              Medicine Inventory
            </CardTitle>
            <div className="flex items-center gap-3">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search medicines..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  data-testid="input-medicine-search"
                />
              </div>
              <Dialog open={isDialogOpen} onOpenChange={(open) => !open && closeDialog()}>
                <DialogTrigger asChild>
                  <Button onClick={() => setIsDialogOpen(true)} data-testid="button-add-medicine">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Medicine
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>
                      {editingMedicine ? "Edit Medicine" : "Add New Medicine"}
                    </DialogTitle>
                  </DialogHeader>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Medicine Name</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Enter medicine name"
                                {...field}
                                data-testid="input-medicine-name"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="purchaseCost"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Purchase Cost (₹)</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  placeholder="0"
                                  {...field}
                                  onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                  data-testid="input-purchase-cost"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="sellingPrice"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Selling Price (₹)</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  placeholder="0"
                                  {...field}
                                  onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                  data-testid="input-selling-price"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name="type"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Type</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              value={field.value}
                            >
                              <FormControl>
                                <SelectTrigger data-testid="select-medicine-type">
                                  <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="Medicine">Medicine</SelectItem>
                                <SelectItem value="Equipment">Surgery Equipment</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="vendorName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Vendor Name</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Enter vendor name"
                                {...field}
                                data-testid="input-vendor-name"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="quantity"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Stock Quantity</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                placeholder="0"
                                {...field}
                                onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                data-testid="input-quantity"
                              />
                            </FormControl>
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
                          data-testid="button-save-medicine"
                        >
                          {createMutation.isPending || updateMutation.isPending
                            ? "Saving..."
                            : editingMedicine
                            ? "Update"
                            : "Add Medicine"}
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
          ) : filteredMedicines.length === 0 ? (
            <div className="text-center py-12">
              <Pill className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-1">No medicines found</h3>
              <p className="text-muted-foreground text-sm">
                {searchQuery
                  ? "Try adjusting your search"
                  : "Add your first medicine to get started"}
              </p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Medicine Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead className="text-right">Purchase Cost</TableHead>
                    <TableHead className="text-right">Selling Price</TableHead>
                    <TableHead className="text-right">Margin</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMedicines.map((medicine) => {
                    const margin = medicine.sellingPrice - medicine.purchaseCost;
                    const marginPercent = medicine.purchaseCost > 0
                      ? ((margin / medicine.purchaseCost) * 100).toFixed(1)
                      : 0;

                    return (
                      <TableRow key={medicine.id} data-testid={`row-medicine-${medicine.id}`}>
                        <TableCell className="font-medium">{medicine.name}</TableCell>
                        <TableCell>
                          <Badge variant={medicine.type === "Equipment" ? "outline" : "secondary"}>
                            {medicine.type === "Equipment" ? "Surgery Equipment" : "Medicine"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{medicine.vendorName || "—"}</TableCell>
                        <TableCell className="text-right">
                          ₹{medicine.purchaseCost.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">
                          ₹{medicine.sellingPrice.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-primary">
                            ₹{margin.toFixed(2)} ({marginPercent}%)
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          {medicine.quantity <= 3 ? (
                            <Badge variant="destructive">{medicine.quantity}</Badge>
                          ) : (
                            <Badge variant="secondary">{medicine.quantity}</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditDialog(medicine)}
                              data-testid={`button-edit-medicine-${medicine.id}`}
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive"
                              onClick={() => setDeletingMedicine(medicine)}
                              data-testid={`button-delete-medicine-${medicine.id}`}
                            >
                              <Trash2 className="w-4 h-4" />
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
      </Card>

      <AlertDialog open={!!deletingMedicine} onOpenChange={() => setDeletingMedicine(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Medicine</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingMedicine?.name}"? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              onClick={() => deletingMedicine && deleteMutation.mutate(deletingMedicine.id)}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
