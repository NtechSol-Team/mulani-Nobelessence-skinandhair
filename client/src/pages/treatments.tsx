import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Stethoscope,
  Plus,
  Search,
  Edit2,
  Trash2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import type { Treatment } from "@shared/schema";
import { insertTreatmentSchema } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { z } from "zod";

const treatmentFormSchema = insertTreatmentSchema;

type TreatmentForm = z.infer<typeof treatmentFormSchema>;

export default function Treatments() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTreatment, setEditingTreatment] = useState<Treatment | null>(null);
  const [deletingTreatment, setDeletingTreatment] = useState<Treatment | null>(null);

  const { data: treatments = [], isLoading } = useQuery<Treatment[]>({
    queryKey: ["/api/treatments"],
  });

  const form = useForm<TreatmentForm>({
    resolver: zodResolver(treatmentFormSchema),
    defaultValues: {
      name: "",
      defaultPrice: 0,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: TreatmentForm) => {
      return await apiRequest("POST", "/api/treatments", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/treatments"] });
      toast({
        title: "Treatment Added",
        description: "Treatment has been added successfully.",
      });
      closeDialog();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Add Treatment",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: TreatmentForm }) => {
      return await apiRequest("PATCH", `/api/treatments/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/treatments"] });
      toast({
        title: "Treatment Updated",
        description: "Treatment has been updated successfully.",
      });
      closeDialog();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Update Treatment",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/treatments/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/treatments"] });
      toast({
        title: "Treatment Deleted",
        description: "Treatment has been removed.",
      });
      setDeletingTreatment(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Delete Treatment",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingTreatment(null);
    form.reset({
      name: "",
      defaultPrice: 0,
    });
  };

  const openEditDialog = (treatment: Treatment) => {
    setEditingTreatment(treatment);
    form.reset({
      name: treatment.name,
      defaultPrice: treatment.defaultPrice,
    });
    setIsDialogOpen(true);
  };

  const onSubmit = (data: TreatmentForm) => {
    if (editingTreatment) {
      updateMutation.mutate({ id: editingTreatment.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const filteredTreatments = treatments.filter((t) =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-6 max-w-[1200px] mx-auto space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-page-title">
          Treatment Master
        </h1>
        <p className="text-muted-foreground">
          Manage available treatments and their default prices
        </p>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Stethoscope className="w-5 h-5 text-primary" />
              Treatments ({treatments.length})
            </CardTitle>
            <div className="flex items-center gap-3">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search treatments..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  data-testid="input-treatment-search"
                />
              </div>
              <Dialog open={isDialogOpen} onOpenChange={(open) => !open && closeDialog()}>
                <DialogTrigger asChild>
                  <Button onClick={() => setIsDialogOpen(true)} data-testid="button-add-treatment">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Treatment
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>
                      {editingTreatment ? "Edit Treatment" : "Add New Treatment"}
                    </DialogTitle>
                  </DialogHeader>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Treatment Name</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Enter treatment name"
                                {...field}
                                data-testid="input-treatment-name"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="defaultPrice"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Default Price (₹)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                placeholder="0"
                                {...field}
                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                data-testid="input-treatment-price"
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
                          data-testid="button-save-treatment"
                        >
                          {createMutation.isPending || updateMutation.isPending
                            ? "Saving..."
                            : editingTreatment
                            ? "Update"
                            : "Add Treatment"}
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
          ) : filteredTreatments.length === 0 ? (
            <div className="text-center py-12">
              <Stethoscope className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-1">No treatments found</h3>
              <p className="text-muted-foreground text-sm">
                {searchQuery
                  ? "Try adjusting your search"
                  : "Add your first treatment to get started"}
              </p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Treatment Name</TableHead>
                    <TableHead className="text-right">Default Price</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTreatments.map((treatment) => (
                    <TableRow key={treatment.id} data-testid={`row-treatment-${treatment.id}`}>
                      <TableCell className="font-medium">{treatment.name}</TableCell>
                      <TableCell className="text-right">
                        ₹{treatment.defaultPrice.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(treatment)}
                            data-testid={`button-edit-treatment-${treatment.id}`}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive"
                            onClick={() => setDeletingTreatment(treatment)}
                            data-testid={`button-delete-treatment-${treatment.id}`}
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

      <AlertDialog open={!!deletingTreatment} onOpenChange={() => setDeletingTreatment(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Treatment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingTreatment?.name}"? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              onClick={() => deletingTreatment && deleteMutation.mutate(deletingTreatment.id)}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
