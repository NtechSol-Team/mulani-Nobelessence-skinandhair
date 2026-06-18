import { useState, Fragment } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ShieldAlert,
  Plus,
  Search,
  Edit2,
  Trash2,
  Lock,
  Eye,
  EyeOff,
  UserCheck,
  Check,
  X,
  AlertCircle
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
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
  DialogTrigger,
  DialogDescription,
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
import { Badge } from "@/components/ui/badge";
import { User, registerSchema } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { z } from "zod";

const modulesList = [
  { id: "patients", label: "Patient Registry & Visits" },
  { id: "appointments", label: "Appointments" },
  { id: "billing", label: "Billing & Invoices" },
  { id: "expenses", label: "Expenses" },
  { id: "medicines", label: "Medicine Master" },
  { id: "treatments", label: "Treatment Master" },
  { id: "crm", label: "CRM (Leads & Follow-ups)" },
  { id: "reports", label: "Reports & Analytics" },
];

const medColumns = [
  { id: "name", label: "Medicine Name" },
  { id: "type", label: "Type" },
  { id: "vendorName", label: "Vendor" },
  { id: "purchaseCost", label: "Purchase Cost" },
  { id: "sellingPrice", label: "Selling Price" },
  { id: "margin", label: "Margin" },
  { id: "quantity", label: "Stock" },
  { id: "actions", label: "Actions" },
];

const defaultPermissions = () => {
  const perm: Record<string, { view: boolean; add: boolean; edit: boolean; delete: boolean; fields?: Record<string, boolean> }> = {};
  modulesList.forEach((m) => {
    perm[m.id] = { view: false, add: false, edit: false, delete: false };
    if (m.id === "medicines") {
      perm[m.id].fields = {
        name: true,
        type: true,
        vendorName: true,
        purchaseCost: true,
        sellingPrice: true,
        margin: true,
        quantity: true,
        actions: true,
      };
    }
  });
  return perm;
};

export default function UsersPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);

  const { data: users, isLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const form = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      password: "",
      role: "Staff",
      permissions: defaultPermissions(),
    },
  });

  const selectedRole = form.watch("role");

  const createMutation = useMutation({
    mutationFn: async (data: z.infer<typeof registerSchema>) => {
      return await apiRequest("POST", "/api/users", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "User Created",
        description: "Staff user credentials and permissions have been saved.",
      });
      closeDialog();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Add User",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<z.infer<typeof registerSchema>> }) => {
      return await apiRequest("PATCH", `/api/users/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "User Updated",
        description: "User details and access rights have been successfully updated.",
      });
      closeDialog();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Update User",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "User Deleted",
        description: "The user account was removed successfully.",
      });
      setDeletingUser(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Delete User",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingUser(null);
    setShowPassword(false);
    form.reset({
      username: "",
      password: "",
      role: "Staff",
      permissions: defaultPermissions(),
    });
  };

  const openEditDialog = (u: any) => {
    setEditingUser(u);
    // Prefill the form, mapping permissions from DB
    const prefilledPermissions = defaultPermissions();
    if (u.permissions) {
      modulesList.forEach((m) => {
        if (u.permissions[m.id]) {
          prefilledPermissions[m.id] = {
            view: !!u.permissions[m.id].view,
            add: !!u.permissions[m.id].add,
            edit: !!u.permissions[m.id].edit,
            delete: !!u.permissions[m.id].delete,
            ...(m.id === "medicines" ? {
              fields: {
                name: u.permissions[m.id].fields?.name !== false,
                type: u.permissions[m.id].fields?.type !== false,
                vendorName: u.permissions[m.id].fields?.vendorName !== false,
                purchaseCost: u.permissions[m.id].fields?.purchaseCost !== false,
                sellingPrice: u.permissions[m.id].fields?.sellingPrice !== false,
                margin: u.permissions[m.id].fields?.margin !== false,
                quantity: u.permissions[m.id].fields?.quantity !== false,
                actions: u.permissions[m.id].fields?.actions !== false,
              }
            } : {})
          };
        }
      });
    }
    form.reset({
      username: u.username,
      password: u.password || "", // prefill raw password if available, otherwise blank
      role: u.role,
      permissions: prefilledPermissions,
    });
    setIsDialogOpen(true);
  };

  const onSubmit = (data: z.infer<typeof registerSchema>) => {
    if (editingUser) {
      updateMutation.mutate({ id: editingUser.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const filteredUsers = (users || []).filter((u) =>
    u.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight text-foreground" data-testid="text-page-title">
              User & Access Control
            </h1>
            <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20">
              SuperAdmin Portal
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm">
            Manage practice personnel logins and configure module-wise View, Add, Edit, and Delete authorization checklist.
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => !open && closeDialog()}>
          <DialogTrigger asChild>
            <Button onClick={() => setIsDialogOpen(true)} className="shadow-sm gap-2">
              <Plus className="w-4 h-4" />
              Add Staff User
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[700px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-primary" />
                {editingUser ? "Modify User Account" : "Create New User Account"}
              </DialogTitle>
              <DialogDescription>
                Configure credentials and specific functional permissions. Standard passwords are saved in secure plain text format.
              </DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold">Username</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. frontdesk" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold">Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              type={showPassword ? "text" : "password"}
                              placeholder="Min 6 characters"
                              className="pr-10"
                              {...field}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                              onClick={() => setShowPassword(!showPassword)}
                            >
                              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold">Role</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a role" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="SuperAdmin">SuperAdmin (Full Access)</SelectItem>
                            <SelectItem value="Staff">Staff (Custom Permissions)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {selectedRole === "SuperAdmin" ? (
                  <div className="bg-primary/5 rounded-lg border border-primary/20 p-4 flex items-start gap-3">
                    <ShieldAlert className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-sm text-primary">SuperAdmin Elevated Privileges</h4>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        This user possesses root administrative level execution. All modular access control checklists (view, add, edit, delete) are automatically granted and bypassed.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex flex-col gap-1">
                      <h3 className="text-sm font-bold text-foreground">Modular Permissions Grid</h3>
                      <p className="text-xs text-muted-foreground">
                        Select specific module tabs this user should see, add, edit, or delete items on.
                      </p>
                    </div>

                    <div className="border rounded-lg overflow-hidden bg-background">
                      <Table>
                        <TableHeader className="bg-muted/50">
                          <TableRow>
                            <TableHead className="w-[240px] text-xs font-bold uppercase">Module Page</TableHead>
                            <TableHead className="text-center text-xs font-bold uppercase w-[80px]">View</TableHead>
                            <TableHead className="text-center text-xs font-bold uppercase w-[80px]">Add</TableHead>
                            <TableHead className="text-center text-xs font-bold uppercase w-[80px]">Edit</TableHead>
                            <TableHead className="text-center text-xs font-bold uppercase w-[80px]">Delete</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {modulesList.map((m) => (
                            <Fragment key={m.id}>
                              <TableRow className="hover:bg-muted/30">
                                <TableCell className="font-medium text-xs py-3">{m.label}</TableCell>
                                
                                {/* View Checkbox */}
                                <TableCell className="text-center py-2">
                                  <FormField
                                    control={form.control}
                                    name={`permissions.${m.id}.view` as any}
                                    render={({ field }) => (
                                      <FormControl>
                                        <Checkbox
                                          checked={field.value}
                                          onCheckedChange={field.onChange}
                                          className="h-4 w-4"
                                        />
                                      </FormControl>
                                    )}
                                  />
                                </TableCell>

                                {/* Add Checkbox */}
                                <TableCell className="text-center py-2">
                                  <FormField
                                    control={form.control}
                                    name={`permissions.${m.id}.add` as any}
                                    render={({ field }) => (
                                      <FormControl>
                                        <Checkbox
                                          checked={field.value}
                                          onCheckedChange={field.onChange}
                                          className="h-4 w-4"
                                        />
                                      </FormControl>
                                    )}
                                  />
                                </TableCell>

                                {/* Edit Checkbox */}
                                <TableCell className="text-center py-2">
                                  <FormField
                                    control={form.control}
                                    name={`permissions.${m.id}.edit` as any}
                                    render={({ field }) => (
                                      <FormControl>
                                        <Checkbox
                                          checked={field.value}
                                          onCheckedChange={field.onChange}
                                          className="h-4 w-4"
                                        />
                                      </FormControl>
                                    )}
                                  />
                                </TableCell>

                                {/* Delete Checkbox */}
                                <TableCell className="text-center py-2">
                                  <FormField
                                    control={form.control}
                                    name={`permissions.${m.id}.delete` as any}
                                    render={({ field }) => (
                                      <FormControl>
                                        <Checkbox
                                          checked={field.value}
                                          onCheckedChange={field.onChange}
                                          className="h-4 w-4"
                                        />
                                      </FormControl>
                                    )}
                                  />
                                </TableCell>
                              </TableRow>

                              {m.id === "medicines" && form.watch("permissions.medicines.view") && (
                                <TableRow className="bg-muted/5 hover:bg-muted/5 border-t-0">
                                  <TableCell colSpan={5} className="pl-6 pr-6 pb-4 pt-1">
                                    <div className="space-y-2 border-l-2 border-primary/30 pl-4">
                                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                                        Column Visibility & Form Access Configuration
                                      </span>
                                      <div className="grid grid-cols-2 gap-x-4 gap-y-2 bg-background p-3 rounded-md border shadow-sm">
                                        {medColumns.map((col) => (
                                          <FormField
                                            key={col.id}
                                            control={form.control}
                                            name={`permissions.medicines.fields.${col.id}` as any}
                                            render={({ field }) => (
                                              <FormItem className="flex items-center space-x-2 space-y-0 py-1">
                                                <FormControl>
                                                  <Checkbox
                                                    checked={field.value !== false}
                                                    onCheckedChange={field.onChange}
                                                    className="h-3.5 w-3.5"
                                                  />
                                                </FormControl>
                                                <FormLabel className="text-xs font-medium text-foreground cursor-pointer select-none">
                                                  {col.label}
                                                </FormLabel>
                                              </FormItem>
                                            )}
                                          />
                                        ))}
                                      </div>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              )}
                            </Fragment>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button type="button" variant="outline" onClick={closeDialog}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createMutation.isPending || updateMutation.isPending}
                    className="min-w-[100px]"
                  >
                    {createMutation.isPending || updateMutation.isPending
                      ? "Saving..."
                      : editingUser
                      ? "Save Changes"
                      : "Create Account"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border shadow-md">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-primary" />
                Active Personnel List
              </CardTitle>
              <CardDescription>
                A list of database registered staff accounts and their module designations.
              </CardDescription>
            </div>
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search staff username..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-muted/40 focus-visible:bg-background"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-12">
              <UserCheck className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-1">No personnel accounts found</h3>
              <p className="text-muted-foreground text-sm">
                {searchQuery
                  ? "Try searching for a different username"
                  : "Add your first staff account to provide custom client access"}
              </p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="font-bold text-xs uppercase">Username</TableHead>
                    <TableHead className="font-bold text-xs uppercase">Role</TableHead>
                    <TableHead className="font-bold text-xs uppercase">Decrypted Password</TableHead>
                    <TableHead className="font-bold text-xs uppercase">Module Access Permissions</TableHead>
                    <TableHead className="text-right font-bold text-xs uppercase">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((u) => {
                    const isSuper = u.role === "SuperAdmin";
                    const formattedPerms: string[] = [];
                    if (isSuper) {
                      formattedPerms.push("All Operations Authorized");
                    } else if (u.permissions) {
                      Object.entries(u.permissions).forEach(([mod, perm]: [string, any]) => {
                        const operations: string[] = [];
                        if (perm.view) operations.push("V");
                        if (perm.add) operations.push("A");
                        if (perm.edit) operations.push("E");
                        if (perm.delete) operations.push("D");
                        if (operations.length > 0) {
                          const mName = modulesList.find(item => item.id === mod)?.label.split(" ")[0] || mod;
                          formattedPerms.push(`${mName} (${operations.join("")})`);
                        }
                      });
                    }

                    return (
                      <TableRow key={u.id} className="hover:bg-muted/10">
                        <TableCell className="font-semibold text-sm">{u.username}</TableCell>
                        <TableCell>
                          <Badge variant={isSuper ? "default" : "secondary"} className="text-xs">
                            {u.role}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {/* Display raw plain text password directly in UI as requested */}
                          {u.id === "1" ? "Dynamic (Env Var)" : (u as any).password || "(None)"}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1 max-w-[500px]">
                            {formattedPerms.length === 0 ? (
                              <span className="text-xs text-muted-foreground italic">No modular access configured</span>
                            ) : (
                              formattedPerms.map((p, idx) => (
                                <Badge key={idx} variant="outline" className="text-[10px] bg-card">
                                  {p}
                                </Badge>
                              ))
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {u.id === "1" ? (
                            <span className="text-xs text-muted-foreground italic px-2">Protected Root Admin</span>
                          ) : (
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditDialog(u)}
                                className="h-8 w-8 text-primary hover:bg-primary/10"
                                title="Edit permissions"
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                onClick={() => setDeletingUser(u)}
                                title="Delete account"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          )}
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

      <AlertDialog open={!!deletingUser} onOpenChange={() => setDeletingUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="w-5 h-5" />
              Remove Staff Member
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete the staff user account for "{deletingUser?.username}"? This action will revoke all system permissions for this login credential.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deletingUser && deleteMutation.mutate(deletingUser.id)}
            >
              {deleteMutation.isPending ? "Removing..." : "Confirm Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
