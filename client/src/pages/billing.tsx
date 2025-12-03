import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Receipt,
  Search,
  Plus,
  Trash2,
  AlertCircle,
  Check,
  FileText,
  Edit2,
  Phone,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import type {
  Patient,
  Medicine,
  Treatment,
  Bill,
  BillMedicineItem,
  BillTreatmentItem,
} from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { z } from "zod";

export default function Billing() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [selectedBillForPayment, setSelectedBillForPayment] = useState<Bill | null>(null);
  const [paymentDialogAmount, setPaymentDialogAmount] = useState("");
  const [recentBillSearch, setRecentBillSearch] = useState("");

  const [selectedTreatments, setSelectedTreatments] = useState<BillTreatmentItem[]>([]);
  const [selectedMedicines, setSelectedMedicines] = useState<BillMedicineItem[]>([]);
  const [amountPaid, setAmountPaid] = useState("");
  const [billToDelete, setBillToDelete] = useState<Bill | null>(null);
  const [billToEdit, setBillToEdit] = useState<Bill | null>(null);
  const [isEditBillDialogOpen, setIsEditBillDialogOpen] = useState(false);
  const [editingTreatments, setEditingTreatments] = useState<BillTreatmentItem[]>([]);
  const [editingMedicines, setEditingMedicines] = useState<BillMedicineItem[]>([]);

  const { data: patients = [], isLoading: patientsLoading } = useQuery<Patient[]>({
    queryKey: ["/api/patients"],
  });

  const { data: medicines = [] } = useQuery<Medicine[]>({
    queryKey: ["/api/medicines"],
  });

  const { data: treatments = [] } = useQuery<Treatment[]>({
    queryKey: ["/api/treatments"],
  });

  const { data: bills = [], isLoading: billsLoading } = useQuery<Bill[]>({
    queryKey: ["/api/bills"],
  });

  const filteredPatients = patients.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.phone.includes(searchQuery)
  );

  const createBillMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPatient) throw new Error("Please select a patient");

      const treatmentTotal = selectedTreatments.reduce((sum, t) => sum + t.price, 0);
      const medicineTotal = selectedMedicines.reduce((sum, m) => sum + m.total, 0);
      const grandTotal = treatmentTotal + medicineTotal;
      const paid = parseFloat(amountPaid) || 0;

      return await apiRequest("POST", "/api/bills", {
        patientId: selectedPatient.id,
        date: format(new Date(), "yyyy-MM-dd"),
        treatments: selectedTreatments,
        medicines: selectedMedicines,
        treatmentTotal,
        medicineTotal,
        grandTotal,
        amountPaid: paid,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bills"] });
      queryClient.invalidateQueries({ queryKey: ["/api/medicines"] });
      toast({
        title: "Bill Created",
        description: "Bill has been saved successfully.",
      });
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Create Bill",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const adjustPaymentMutation = useMutation({
    mutationFn: async ({ billId, amount }: { billId: string; amount: number }) => {
      return await apiRequest("PATCH", `/api/bills/${billId}/payment`, {
        amountPaid: amount,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bills"] });
      toast({
        title: "Payment Updated",
        description: "Payment has been recorded successfully.",
      });
      setIsPaymentDialogOpen(false);
      setSelectedBillForPayment(null);
      setPaymentDialogAmount("");
    },
    onError: (error: Error) => {
      toast({
        title: "Payment Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateBillMutation = useMutation({
    mutationFn: async ({ billId, treatments, medicines }: { billId: string; treatments: BillTreatmentItem[]; medicines: BillMedicineItem[] }) => {
      const treatmentTotal = treatments.reduce((sum, t) => sum + t.price, 0);
      const medicineTotal = medicines.reduce((sum, m) => sum + m.total, 0);
      const grandTotal = treatmentTotal + medicineTotal;
      
      if (!billToEdit) throw new Error("Bill not found");
      
      return await apiRequest("PATCH", `/api/bills/${billId}`, {
        patientId: billToEdit.patientId,
        date: billToEdit.date,
        treatments,
        medicines,
        treatmentTotal,
        medicineTotal,
        grandTotal,
        amountPaid: billToEdit.amountPaid,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bills"] });
      queryClient.invalidateQueries({ queryKey: ["/api/medicines"] });
      toast({
        title: "Bill Updated",
        description: "Bill has been updated successfully.",
      });
      setIsEditBillDialogOpen(false);
      setBillToEdit(null);
      setEditingTreatments([]);
      setEditingMedicines([]);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Update Bill",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteBillMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/bills/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bills"] });
      queryClient.invalidateQueries({ queryKey: ["/api/medicines"] });
      toast({
        title: "Bill Deleted",
        description: "Bill has been removed successfully.",
      });
      setBillToDelete(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Delete Bill",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setSelectedPatient(null);
    setSelectedTreatments([]);
    setSelectedMedicines([]);
    setAmountPaid("");
    setSearchQuery("");
  };

  const addTreatment = (treatmentId: string) => {
    const treatment = treatments.find((t) => t.id === treatmentId);
    if (treatment) {
      setSelectedTreatments([
        ...selectedTreatments,
        {
          treatmentId: treatment.id,
          treatmentName: treatment.name,
          price: treatment.defaultPrice,
        },
      ]);
    }
  };

  const updateTreatmentPrice = (index: number, price: number) => {
    const updated = [...selectedTreatments];
    updated[index].price = price;
    setSelectedTreatments(updated);
  };

  const removeTreatment = (index: number) => {
    setSelectedTreatments(selectedTreatments.filter((_, i) => i !== index));
  };

  const addMedicine = () => {
    setSelectedMedicines([
      ...selectedMedicines,
      {
        medicineId: "",
        medicineName: "",
        quantity: 1,
        unitPrice: 0,
        total: 0,
      },
    ]);
  };

  const updateMedicine = (index: number, medicineId: string) => {
    const medicine = medicines.find((m) => m.id === medicineId);
    if (medicine) {
      const updated = [...selectedMedicines];
      updated[index] = {
        medicineId: medicine.id,
        medicineName: medicine.name,
        quantity: 1,
        unitPrice: medicine.sellingPrice,
        total: medicine.sellingPrice,
      };
      setSelectedMedicines(updated);
    }
  };

  const updateMedicineQuantity = (index: number, quantity: number) => {
    const updated = [...selectedMedicines];
    updated[index].quantity = quantity;
    updated[index].total = updated[index].unitPrice * quantity;
    setSelectedMedicines(updated);
  };

  const updateMedicinePrice = (index: number, price: number) => {
    const updated = [...selectedMedicines];
    updated[index].unitPrice = price;
    updated[index].total = price * updated[index].quantity;
    setSelectedMedicines(updated);
  };

  const removeMedicine = (index: number) => {
    setSelectedMedicines(selectedMedicines.filter((_, i) => i !== index));
  };

  // Edit bill functions
  const openEditBillDialog = (bill: Bill) => {
    setBillToEdit(bill);
    setEditingTreatments([...bill.treatments]);
    setEditingMedicines([...bill.medicines]);
    setIsEditBillDialogOpen(true);
  };

  const addEditingTreatment = (treatmentId: string) => {
    const treatment = treatments.find((t) => t.id === treatmentId);
    if (treatment) {
      setEditingTreatments([
        ...editingTreatments,
        {
          treatmentId: treatment.id,
          treatmentName: treatment.name,
          price: treatment.defaultPrice,
        },
      ]);
    }
  };

  const updateEditingTreatmentPrice = (index: number, price: number) => {
    const updated = [...editingTreatments];
    updated[index].price = price;
    setEditingTreatments(updated);
  };

  const removeEditingTreatment = (index: number) => {
    setEditingTreatments(editingTreatments.filter((_, i) => i !== index));
  };

  const addEditingMedicine = () => {
    setEditingMedicines([
      ...editingMedicines,
      {
        medicineId: "",
        medicineName: "",
        quantity: 1,
        unitPrice: 0,
        total: 0,
      },
    ]);
  };

  const updateEditingMedicine = (index: number, medicineId: string) => {
    const medicine = medicines.find((m) => m.id === medicineId);
    if (medicine) {
      const updated = [...editingMedicines];
      updated[index] = {
        medicineId: medicine.id,
        medicineName: medicine.name,
        quantity: 1,
        unitPrice: medicine.sellingPrice,
        total: medicine.sellingPrice,
      };
      setEditingMedicines(updated);
    }
  };

  const updateEditingMedicineQuantity = (index: number, quantity: number) => {
    const updated = [...editingMedicines];
    updated[index].quantity = quantity;
    updated[index].total = updated[index].unitPrice * quantity;
    setEditingMedicines(updated);
  };

  const updateEditingMedicinePrice = (index: number, price: number) => {
    const updated = [...editingMedicines];
    updated[index].unitPrice = price;
    updated[index].total = price * updated[index].quantity;
    setEditingMedicines(updated);
  };

  const removeEditingMedicine = (index: number) => {
    setEditingMedicines(editingMedicines.filter((_, i) => i !== index));
  };

  const treatmentTotal = selectedTreatments.reduce((sum, t) => sum + t.price, 0);
  const medicineTotal = selectedMedicines.reduce((sum, m) => sum + m.total, 0);
  const grandTotal = treatmentTotal + medicineTotal;
  const paid = parseFloat(amountPaid) || 0;
  const pendingAmount = grandTotal - paid;

  const pendingBills = bills.filter((b) => b.pendingAmount > 0);
  const recentBills = [...bills]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .filter((bill) =>
      bill.patientName.toLowerCase().includes(recentBillSearch.toLowerCase().trim())
    )
    .slice(0, 10);

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-page-title">
          Medicine & Billing
        </h1>
        <p className="text-muted-foreground">
          Create bills and manage patient payments
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="lg:row-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Receipt className="w-5 h-5 text-primary" />
              New Bill
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <label className="text-sm font-medium mb-2 block">Select Patient</label>
              {selectedPatient ? (
                <div className="p-4 rounded-lg bg-muted/50 border">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">
                        {selectedPatient.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium" data-testid="text-selected-patient">
                          {selectedPatient.name}
                        </p>
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {selectedPatient.phone}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedPatient(null)}
                    >
                      Change
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name or phone..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                      data-testid="input-patient-search"
                    />
                  </div>
                  {searchQuery && (
                    <div className="max-h-48 overflow-y-auto border rounded-lg divide-y">
                      {filteredPatients.length === 0 ? (
                        <div className="p-3 text-sm text-muted-foreground text-center">
                          No patients found
                        </div>
                      ) : (
                        filteredPatients.map((patient) => (
                          <button
                            key={patient.id}
                            onClick={() => {
                              setSelectedPatient(patient);
                              setSearchQuery("");
                            }}
                            className="w-full p-3 text-left hover-elevate flex items-center gap-3"
                            data-testid={`button-select-patient-${patient.id}`}
                          >
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-medium">
                              {patient.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium text-sm">{patient.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {patient.phone}
                              </p>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-medium">Treatments</label>
                <Select onValueChange={addTreatment}>
                  <SelectTrigger className="w-48" data-testid="select-treatment">
                    <SelectValue placeholder="Add treatment" />
                  </SelectTrigger>
                  <SelectContent>
                    {treatments.map((treatment) => (
                      <SelectItem
                        key={treatment.id}
                        value={treatment.id}
                        data-testid={`option-treatment-${treatment.id}`}
                      >
                        {treatment.name} - ₹{treatment.defaultPrice}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedTreatments.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-4 bg-muted/30 rounded-lg">
                  No treatments added
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedTreatments.map((treatment, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                    >
                      <span className="text-sm font-medium">{treatment.treatmentName}</span>
                      <div className="flex items-center gap-3">
                        <Input
                          type="number"
                          min="0"
                          value={treatment.price}
                          onChange={(e) =>
                            updateTreatmentPrice(index, parseFloat(e.target.value) || 0)
                          }
                          className="h-8 w-24"
                          data-testid={`input-treatment-price-${index}`}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          onClick={() => removeTreatment(index)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-medium">Medicines</label>
                <Button variant="outline" size="sm" onClick={addMedicine} data-testid="button-add-medicine">
                  <Plus className="w-4 h-4 mr-1" />
                  Add Medicine
                </Button>
              </div>
              {selectedMedicines.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-4 bg-muted/30 rounded-lg">
                  No medicines added
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedMedicines.map((med, index) => (
                    <div
                      key={index}
                      className="p-3 bg-muted/30 rounded-lg space-y-3"
                    >
                      <div className="flex items-center gap-2">
                        <Select
                          value={med.medicineId}
                          onValueChange={(value) => updateMedicine(index, value)}
                        >
                          <SelectTrigger className="flex-1" data-testid={`select-medicine-${index}`}>
                            <SelectValue placeholder="Select medicine" />
                          </SelectTrigger>
                          <SelectContent>
                            {medicines.map((medicine) => (
                              <SelectItem
                                key={medicine.id}
                                value={medicine.id}
                                disabled={medicine.quantity === 0}
                              >
                                {medicine.name} (Stock: {medicine.quantity})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 text-destructive shrink-0"
                          onClick={() => removeMedicine(index)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                      {med.medicineId && (
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="text-xs text-muted-foreground">Qty</label>
                            <Input
                              type="number"
                              min="1"
                              value={med.quantity}
                              onChange={(e) =>
                                updateMedicineQuantity(index, parseInt(e.target.value) || 1)
                              }
                              className="h-8"
                              data-testid={`input-medicine-qty-${index}`}
                            />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">Price</label>
                            <Input
                              type="number"
                              min="0"
                              value={med.unitPrice}
                              onChange={(e) =>
                                updateMedicinePrice(index, parseFloat(e.target.value) || 0)
                              }
                              className="h-8"
                              data-testid={`input-medicine-price-${index}`}
                            />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">Total</label>
                            <div className="h-8 flex items-center font-medium text-sm">
                              ₹{med.total.toFixed(2)}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t pt-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Treatment Total</span>
                <span>₹{treatmentTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Medicine Total</span>
                <span>₹{medicineTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-semibold text-lg border-t pt-3">
                <span>Grand Total</span>
                <span data-testid="text-grand-total">₹{grandTotal.toFixed(2)}</span>
              </div>
            </div>

            <div className="border-t pt-4">
              <label className="text-sm font-medium mb-2 block">Amount Paid</label>
              <Input
                type="number"
                placeholder="Enter amount paid"
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
                data-testid="input-amount-paid"
              />
              {pendingAmount > 0 && (
                <p className="text-sm text-destructive mt-2 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  Pending: ₹{pendingAmount.toFixed(2)}
                </p>
              )}
            </div>

            <Button
              className="w-full"
              disabled={!selectedPatient || grandTotal === 0 || createBillMutation.isPending}
              onClick={() => createBillMutation.mutate()}
              data-testid="button-create-bill"
            >
              {createBillMutation.isPending ? "Creating..." : "Create Bill"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <AlertCircle className="w-5 h-5 text-destructive" />
              Pending Payments
              {pendingBills.length > 0 && (
                <Badge variant="destructive">{pendingBills.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {billsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : pendingBills.length === 0 ? (
              <div className="text-center py-8">
                <Check className="w-10 h-10 text-primary mx-auto mb-3" />
                <p className="text-muted-foreground">No pending payments</p>
              </div>
            ) : (
              <div className="space-y-2">
                {pendingBills.map((bill) => (
                  <div
                    key={bill.id}
                    className="p-3 rounded-lg border bg-card hover-elevate cursor-pointer"
                    onClick={() => {
                      setSelectedBillForPayment(bill);
                      setPaymentDialogAmount(bill.amountPaid.toString());
                      setIsPaymentDialogOpen(true);
                    }}
                    data-testid={`card-pending-bill-${bill.id}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{bill.patientName}</p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(bill.date), "dd MMM yyyy")}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-destructive">
                          ₹{bill.pendingAmount.toFixed(2)}
                        </p>
                        <p className="text-xs text-muted-foreground">pending</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="w-5 h-5 text-primary" />
              Recent Bills
            </CardTitle>
            {bills.length > 0 && (
              <div className="mt-2">
                <Input
                  placeholder="Search patient..."
                  value={recentBillSearch}
                  onChange={(e) => setRecentBillSearch(e.target.value)}
                  className="h-9"
                  data-testid="input-recent-bill-search"
                />
              </div>
            )}
          </CardHeader>
          <CardContent>
            {billsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : bills.length === 0 ? (
              <div className="text-center py-8">
                <Receipt className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No bills created yet</p>
              </div>
            ) : recentBills.length === 0 ? (
              <div className="text-center py-8">
                <Search className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No bills match that name</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {recentBills.map((bill) => (
                  <div
                    key={bill.id}
                    className="p-3 rounded-lg border bg-card"
                    data-testid={`card-bill-${bill.id}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="font-medium">{bill.patientName}</p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(bill.date), "dd MMM yyyy")}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">₹{bill.grandTotal.toFixed(2)}</p>
                        {bill.pendingAmount > 0 ? (
                          <Badge variant="destructive" className="text-xs">
                            ₹{bill.pendingAmount} pending
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            Paid
                          </Badge>
                        )}
                        <div className="flex justify-end gap-2 mt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => {
                              setSelectedBillForPayment(bill);
                              setPaymentDialogAmount(bill.amountPaid.toString());
                              setIsPaymentDialogOpen(true);
                            }}
                          >
                            Edit Payment
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive"
                            onClick={() => setBillToDelete(bill)}
                            data-testid={`button-delete-bill-${bill.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                      {(bill.treatments.length > 0 || bill.medicines.length > 0) && (
                        <div className="mt-3 space-y-2 text-sm">
                          {bill.treatments.length > 0 && (
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <p className="text-xs text-muted-foreground uppercase tracking-wide">
                                  Treatments
                                </p>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 text-xs"
                                  onClick={() => openEditBillDialog(bill)}
                                >
                                  <Edit2 className="w-3 h-3 mr-1" />
                                  Edit
                                </Button>
                              </div>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {bill.treatments.map((treatment) => (
                                  <Badge key={treatment.treatmentId} variant="outline" className="text-xs">
                                    {treatment.treatmentName} · ₹{treatment.price.toFixed(2)}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                          {bill.medicines.length > 0 && (
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <p className="text-xs text-muted-foreground uppercase tracking-wide">
                                  Medicines
                                </p>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 text-xs"
                                  onClick={() => openEditBillDialog(bill)}
                                >
                                  <Edit2 className="w-3 h-3 mr-1" />
                                  Edit
                                </Button>
                              </div>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {bill.medicines.map((medicine) => (
                                  <Badge key={medicine.medicineId} variant="outline" className="text-xs">
                                    {medicine.medicineName} ×{medicine.quantity} · ₹
                                    {medicine.total.toFixed(2)}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Payment</DialogTitle>
          </DialogHeader>
          {selectedBillForPayment && (
            <div className="space-y-4">
              <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Patient</span>
                  <span className="font-medium">{selectedBillForPayment.patientName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Bill Date</span>
                  <span>{format(new Date(selectedBillForPayment.date), "dd MMM yyyy")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Grand Total</span>
                  <span>₹{selectedBillForPayment.grandTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Current Paid</span>
                  <span>₹{selectedBillForPayment.amountPaid.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-semibold text-destructive border-t pt-2">
                  <span>Current Pending</span>
                  <span>₹{selectedBillForPayment.pendingAmount.toFixed(2)}</span>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Amount Paid</label>
                <Input
                  type="number"
                  min={0}
                  max={selectedBillForPayment.grandTotal}
                  value={paymentDialogAmount}
                  onChange={(e) => setPaymentDialogAmount(e.target.value)}
                  data-testid="input-edit-amount-paid"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Set the total amount paid for this bill (0 to ₹
                  {selectedBillForPayment.grandTotal.toFixed(2)}).
                </p>
              </div>

              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsPaymentDialogOpen(false);
                    setPaymentDialogAmount("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  disabled={
                    adjustPaymentMutation.isPending ||
                    !paymentDialogAmount ||
                    isNaN(parseFloat(paymentDialogAmount))
                  }
                  onClick={() => {
                    const amount = parseFloat(paymentDialogAmount || "0");
                    const safeAmount = Math.max(
                      0,
                      Math.min(amount, selectedBillForPayment.grandTotal),
                    );
                    adjustPaymentMutation.mutate({
                      billId: selectedBillForPayment.id,
                      amount: safeAmount,
                    });
                  }}
                  data-testid="button-confirm-edit-payment"
                >
                  {adjustPaymentMutation.isPending ? "Updating..." : "Update Payment"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isEditBillDialogOpen} onOpenChange={setIsEditBillDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Bill - {billToEdit?.patientName}</DialogTitle>
          </DialogHeader>
          {billToEdit && (
            <div className="space-y-6">
              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium">Treatments</label>
                  <Select onValueChange={addEditingTreatment}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Add treatment" />
                    </SelectTrigger>
                    <SelectContent>
                      {treatments.map((treatment) => (
                        <SelectItem key={treatment.id} value={treatment.id}>
                          {treatment.name} - ₹{treatment.defaultPrice}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {editingTreatments.length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-4 bg-muted/30 rounded-lg">
                    No treatments added
                  </div>
                ) : (
                  <div className="space-y-2">
                    {editingTreatments.map((treatment, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                      >
                        <span className="text-sm font-medium">{treatment.treatmentName}</span>
                        <div className="flex items-center gap-3">
                          <Input
                            type="number"
                            min="0"
                            value={treatment.price}
                            onChange={(e) =>
                              updateEditingTreatmentPrice(index, parseFloat(e.target.value) || 0)
                            }
                            className="h-8 w-24"
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            onClick={() => removeEditingTreatment(index)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium">Medicines</label>
                  <Button variant="outline" size="sm" onClick={addEditingMedicine}>
                    <Plus className="w-4 h-4 mr-1" />
                    Add Medicine
                  </Button>
                </div>
                {editingMedicines.length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-4 bg-muted/30 rounded-lg">
                    No medicines added
                  </div>
                ) : (
                  <div className="space-y-3">
                    {editingMedicines.map((med, index) => (
                      <div
                        key={index}
                        className="p-3 bg-muted/30 rounded-lg space-y-3"
                      >
                        <div className="flex items-center gap-2">
                          <Select
                            value={med.medicineId}
                            onValueChange={(value) => updateEditingMedicine(index, value)}
                          >
                            <SelectTrigger className="flex-1">
                              <SelectValue placeholder="Select medicine" />
                            </SelectTrigger>
                            <SelectContent>
                              {medicines.map((medicine) => (
                                <SelectItem
                                  key={medicine.id}
                                  value={medicine.id}
                                  disabled={medicine.quantity === 0}
                                >
                                  {medicine.name} (Stock: {medicine.quantity})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-destructive shrink-0"
                            onClick={() => removeEditingMedicine(index)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                        {med.medicineId && (
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <label className="text-xs text-muted-foreground">Qty</label>
                              <Input
                                type="number"
                                min="1"
                                value={med.quantity}
                                onChange={(e) =>
                                  updateEditingMedicineQuantity(index, parseInt(e.target.value) || 1)
                                }
                                className="h-8"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground">Price</label>
                              <Input
                                type="number"
                                min="0"
                                value={med.unitPrice}
                                onChange={(e) =>
                                  updateEditingMedicinePrice(index, parseFloat(e.target.value) || 0)
                                }
                                className="h-8"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground">Total</label>
                              <div className="h-8 flex items-center font-medium text-sm">
                                ₹{med.total.toFixed(2)}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t pt-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Treatment Total</span>
                  <span>₹{editingTreatments.reduce((sum, t) => sum + t.price, 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Medicine Total</span>
                  <span>₹{editingMedicines.reduce((sum, m) => sum + m.total, 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-semibold text-lg border-t pt-3">
                  <span>Grand Total</span>
                  <span>
                    ₹
                    {(
                      editingTreatments.reduce((sum, t) => sum + t.price, 0) +
                      editingMedicines.reduce((sum, m) => sum + m.total, 0)
                    ).toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setIsEditBillDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  disabled={updateBillMutation.isPending}
                  onClick={() => {
                    if (billToEdit) {
                      updateBillMutation.mutate({
                        billId: billToEdit.id,
                        treatments: editingTreatments,
                        medicines: editingMedicines,
                      });
                    }
                  }}
                >
                  {updateBillMutation.isPending ? "Updating..." : "Update Bill"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!billToDelete} onOpenChange={() => setBillToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Bill</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this bill for "
              {billToDelete?.patientName}"? This will also restore the medicine stock for this
              bill. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              onClick={() => billToDelete && deleteBillMutation.mutate(billToDelete.id)}
            >
              {deleteBillMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
