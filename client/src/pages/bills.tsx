/**
 * BILL MANAGEMENT PAGE
 * 
 * Payment Tracking System:
 * Supports cumulative payments across multiple visits for the same bill.
 * 
 * Example Flow:
 * Visit 1: Create bill for ₹1000, patient pays ₹500 → Paid: ₹500, Pending: ₹500
 * Visit 2: Record payment ₹300 → Enter TOTAL ₹800 → Paid: ₹800, Pending: ₹200
 * Visit 3: Record payment ₹200 → Enter TOTAL ₹1000 → Paid: ₹1000, Pending: ₹0 ✓
 * 
 * Key: User must enter the CUMULATIVE total, not just the current visit amount.
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  Trash2,
  Edit2,
  Plus,
  AlertCircle,
  Check,
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
import type { Bill, Medicine, Treatment, BillMedicineItem, BillTreatmentItem } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";

export default function BillingManage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [recentBillSearch, setRecentBillSearch] = useState("");
  const [pendingBillSearch, setPendingBillSearch] = useState("");
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [selectedBillForPayment, setSelectedBillForPayment] = useState<Bill | null>(null);
  const [paymentDialogAmount, setPaymentDialogAmount] = useState("");
  const [billToDelete, setBillToDelete] = useState<Bill | null>(null);
  const [billToEdit, setBillToEdit] = useState<Bill | null>(null);
  const [isEditBillDialogOpen, setIsEditBillDialogOpen] = useState(false);
  const [editingTreatments, setEditingTreatments] = useState<BillTreatmentItem[]>([]);
  const [editingMedicines, setEditingMedicines] = useState<BillMedicineItem[]>([]);

  const { data: bills = [], isLoading: billsLoading } = useQuery<Bill[]>({
    queryKey: ["/api/bills"],
  });

  const { data: medicines = [] } = useQuery<Medicine[]>({
    queryKey: ["/api/medicines"],
  });

  const { data: treatments = [] } = useQuery<Treatment[]>({
    queryKey: ["/api/treatments"],
  });

  const adjustPaymentMutation = useMutation({
    mutationFn: async ({ billId, addAmount }: { billId: string; addAmount: number }) => {
      return await apiRequest("PATCH", `/api/bills/${billId}/payment`, {
        addAmount,
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
    mutationFn: async ({
      billId,
      treatments,
      medicines,
    }: {
      billId: string;
      treatments: BillTreatmentItem[];
      medicines: BillMedicineItem[];
    }) => {
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

  // Separate pending and recent bills
  const pendingBills = bills
    .filter((b) => b.pendingAmount > 0)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .filter((bill) =>
      bill.patientName.toLowerCase().includes(pendingBillSearch.toLowerCase().trim())
    );

  const recentBills = bills
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .filter((bill) =>
      bill.patientName.toLowerCase().includes(recentBillSearch.toLowerCase().trim())
    )
    .slice(0, 15);

  const BillCard = ({
    bill,
    onPayment,
    onEdit,
    onDelete,
  }: {
    bill: Bill;
    onPayment: (bill: Bill) => void;
    onEdit: (bill: Bill) => void;
    onDelete: (bill: Bill) => void;
  }) => (
    <div className="p-4 border rounded-lg space-y-3 hover-elevate">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <p className="font-medium">{bill.patientName}</p>
          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
            <Phone className="w-3 h-3" />
            Bill Date: {format(new Date(bill.date), "dd MMM yyyy")}
          </p>
        </div>
        <Badge variant={bill.pendingAmount > 0 ? "destructive" : "default"}>
          {bill.pendingAmount > 0 ? "Pending" : "Settled"}
        </Badge>
      </div>

      <div className="space-y-1 text-sm">
        {bill.treatments.length > 0 && (
          <p className="text-muted-foreground">
            <span className="font-medium">Treatments:</span> {bill.treatments.map((t) => t.treatmentName).join(", ")}
          </p>
        )}
        {bill.medicines.length > 0 && (
          <p className="text-muted-foreground">
            <span className="font-medium">Medicines:</span> {bill.medicines.length} item(s)
          </p>
        )}
      </div>

      <div className="bg-muted/50 p-3 rounded space-y-2">
        <div className="flex justify-between text-sm font-semibold border-b pb-2">
          <span>Grand Total:</span>
          <span>₹{bill.grandTotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span>Amount Paid (All Visits):</span>
          <span className="font-medium text-green-600">₹{bill.amountPaid.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span>Still Pending:</span>
          <span className={`font-medium ${bill.pendingAmount > 0 ? 'text-destructive' : 'text-green-600'}`}>
            ₹{bill.pendingAmount.toFixed(2)}
          </span>
        </div>
        {bill.pendingAmount === 0 && (
          <div className="text-xs text-center text-green-600 font-semibold mt-2 pt-2 border-t">
            ✓ Bill Settled
          </div>
        )}
      </div>

      <div className="flex gap-2">
        {bill.pendingAmount > 0 && (
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            onClick={() => onPayment(bill)}
          >
            <Check className="w-4 h-4 mr-1" />
            Record Payment
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={() => onEdit(bill)}
        >
          <Edit2 className="w-4 h-4" />
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="text-destructive"
          onClick={() => onDelete(bill)}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Bill Management</h1>
        <p className="text-muted-foreground">
          View recent bills and manage pending payments
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Bills */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Recent Bills</CardTitle>
            <div className="mt-3 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by patient name..."
                value={recentBillSearch}
                onChange={(e) => setRecentBillSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </CardHeader>
          <CardContent>
            {billsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-32 w-full" />
                ))}
              </div>
            ) : recentBills.length === 0 ? (
              <div className="text-center py-8">
                <AlertCircle className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No bills found</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {recentBills.map((bill) => (
                  <BillCard
                    key={bill.id}
                    bill={bill}
                    onPayment={(b) => {
                      setSelectedBillForPayment(b);
                      setPaymentDialogAmount("");
                      setIsPaymentDialogOpen(true);
                    }}
                    onEdit={openEditBillDialog}
                    onDelete={(b) => setBillToDelete(b)}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pending Bills */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg text-destructive">Pending Bills</CardTitle>
            <div className="mt-3 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by patient name..."
                value={pendingBillSearch}
                onChange={(e) => setPendingBillSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </CardHeader>
          <CardContent>
            {billsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-32 w-full" />
                ))}
              </div>
            ) : pendingBills.length === 0 ? (
              <div className="text-center py-8">
                <AlertCircle className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No pending bills</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {pendingBills.map((bill) => (
                  <BillCard
                    key={bill.id}
                    bill={bill}
                    onPayment={(b) => {
                      setSelectedBillForPayment(b);
                      setPaymentDialogAmount("");
                      setIsPaymentDialogOpen(true);
                    }}
                    onEdit={openEditBillDialog}
                    onDelete={(b) => setBillToDelete(b)}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Payment Dialog */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
          </DialogHeader>
          {selectedBillForPayment && (
            <div className="space-y-4">
              <div className="p-3 bg-muted/50 rounded-lg space-y-2 text-sm border">
                <div className="text-xs font-semibold text-muted-foreground mb-2">BILL SUMMARY</div>
                <div className="flex justify-between">
                  <span>Grand Total:</span>
                  <span className="font-medium">₹{selectedBillForPayment.grandTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-green-600">
                  <span>Already Paid:</span>
                  <span className="font-medium">₹{selectedBillForPayment.amountPaid.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-destructive border-t pt-2 font-semibold">
                  <span>Still Pending:</span>
                  <span>₹{selectedBillForPayment.pendingAmount.toFixed(2)}</span>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  Add Amount
                  <span className="text-xs text-muted-foreground ml-2">(this payment)</span>
                </label>
                <Input
                  type="number"
                  min="0"
                  max={selectedBillForPayment.pendingAmount}
                  value={paymentDialogAmount}
                  onChange={(e) => setPaymentDialogAmount(e.target.value)}
                  placeholder="0"
                  className="text-lg"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Enter only the amount being paid in this transaction. The system will add it to previous payments.
                </p>
              </div>

              {paymentDialogAmount && (
                <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg space-y-1 text-sm border border-blue-200 dark:border-blue-800">
                  <div className="text-xs font-semibold text-blue-900 dark:text-blue-100 mb-2">AFTER THIS PAYMENT:</div>
                  <div className="flex justify-between">
                    <span>Total Paid:</span>
                    <span className="font-medium text-green-600">₹{(selectedBillForPayment.amountPaid + parseFloat(paymentDialogAmount)).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Remaining Pending:</span>
                    <span className={`font-medium ${(selectedBillForPayment.pendingAmount - parseFloat(paymentDialogAmount)) > 0 ? 'text-destructive' : 'text-green-600'}`}>
                      ₹{(selectedBillForPayment.pendingAmount - parseFloat(paymentDialogAmount)).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}

              <div className="flex gap-3 justify-end">
                <Button variant="outline" onClick={() => setIsPaymentDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  disabled={adjustPaymentMutation.isPending || !paymentDialogAmount}
                  onClick={() => {
                    const addAmount = parseFloat(paymentDialogAmount) || 0;
                    if (addAmount <= 0) {
                      toast({
                        title: "Invalid Amount",
                        description: "Please enter an amount greater than 0",
                        variant: "destructive",
                      });
                      return;
                    }
                    if (addAmount > selectedBillForPayment.pendingAmount) {
                      toast({
                        title: "Amount Exceeds Pending",
                        description: `Only ₹${selectedBillForPayment.pendingAmount.toFixed(2)} pending on this bill`,
                        variant: "destructive",
                      });
                      return;
                    }
                    adjustPaymentMutation.mutate({
                      billId: selectedBillForPayment.id,
                      addAmount,
                    });
                  }}
                >
                  {adjustPaymentMutation.isPending ? "Saving..." : "Record Payment"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Bill Dialog */}
      <Dialog open={isEditBillDialogOpen} onOpenChange={setIsEditBillDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Bill</DialogTitle>
          </DialogHeader>
          {billToEdit ? (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium">Patient: {billToEdit.patientName}</p>
                <p className="text-sm text-muted-foreground">
                  Date: {format(new Date(billToEdit.date), "dd MMM yyyy")}
                </p>
              </div>

              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium">Treatments</label>
                  <Select onValueChange={addEditingTreatment}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Add treatment" />
                    </SelectTrigger>
                    <SelectContent>
                      {treatments.map((treatment) => (
                        <SelectItem key={treatment.id} value={treatment.id}>
                          {treatment.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {editingTreatments.length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-2 bg-muted/30 rounded">
                    No treatments
                  </div>
                ) : (
                  <div className="space-y-2">
                    {editingTreatments.map((treatment, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-2 bg-muted/30 rounded"
                      >
                        <span className="text-sm font-medium">{treatment.treatmentName}</span>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min="0"
                            value={treatment.price}
                            onChange={(e) =>
                              updateEditingTreatmentPrice(index, parseFloat(e.target.value) || 0)
                            }
                            className="h-7 w-20 text-xs"
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-destructive"
                            onClick={() => removeEditingTreatment(index)}
                          >
                            <Trash2 className="w-3 h-3" />
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
                    <Plus className="w-3 h-3 mr-1" />
                    Add
                  </Button>
                </div>
                {editingMedicines.length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-2 bg-muted/30 rounded">
                    No medicines
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {editingMedicines.map((med, index) => (
                      <div key={index} className="p-2 bg-muted/30 rounded space-y-2">
                        <div className="flex items-center gap-2">
                          <Select
                            value={med.medicineId}
                            onValueChange={(value) => updateEditingMedicine(index, value)}
                          >
                            <SelectTrigger className="flex-1 h-8 text-xs">
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent>
                              {medicines.map((medicine) => (
                                <SelectItem key={medicine.id} value={medicine.id}>
                                  {medicine.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-destructive"
                            onClick={() => removeEditingMedicine(index)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                        {med.medicineId && (
                          <div className="grid grid-cols-3 gap-1">
                            <Input
                              type="number"
                              min="1"
                              value={med.quantity}
                              onChange={(e) =>
                                updateEditingMedicineQuantity(index, parseInt(e.target.value) || 1)
                              }
                              className="h-7 text-xs"
                              placeholder="Qty"
                            />
                            <Input
                              type="number"
                              min="0"
                              value={med.unitPrice}
                              onChange={(e) =>
                                updateEditingMedicinePrice(index, parseFloat(e.target.value) || 0)
                              }
                              className="h-7 text-xs"
                              placeholder="Price"
                            />
                            <div className="h-7 flex items-center text-xs font-medium">
                              ₹{med.total.toFixed(0)}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t pt-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Treatment Total:</span>
                  <span>₹{editingTreatments.reduce((sum, t) => sum + t.price, 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Medicine Total:</span>
                  <span>₹{editingMedicines.reduce((sum, m) => sum + m.total, 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span>Grand Total:</span>
                  <span>
                    ₹
                    {(
                      editingTreatments.reduce((sum, t) => sum + t.price, 0) +
                      editingMedicines.reduce((sum, m) => sum + m.total, 0)
                    ).toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setIsEditBillDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
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
          ) : (
            <p className="text-sm text-muted-foreground">Loading...</p>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={!!billToDelete} onOpenChange={() => setBillToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Bill</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this bill for "{billToDelete?.patientName}"?
              This will also restore the medicine stock. This action cannot be undone.
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
