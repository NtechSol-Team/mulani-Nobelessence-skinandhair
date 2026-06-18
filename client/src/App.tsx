import { useEffect, useState } from "react";
import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { Navbar } from "@/components/navbar";
import Dashboard from "@/pages/dashboard";
import Registration from "@/pages/registration";
import PatientDetails from "@/pages/patient-details";
import BillingCreate from "@/pages/billing-create";
import BillingManage from "@/pages/bills";
import Medicines from "@/pages/medicines";
import Treatments from "@/pages/treatments";
import Departments from "@/pages/departments";
import Expenses from "@/pages/expenses";
import AppointmentMaster from "@/pages/appointment-master";
import Reports from "@/pages/reports";
import CRMDashboard from "@/pages/crm-dashboard";
import CRMLeads from "@/pages/crm-leads";
import CRMTasks from "@/pages/crm-tasks";
import AuthPage from "@/pages/auth-page";
import NotFound from "@/pages/not-found";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";

import UsersPage from "@/pages/users";

function ProtectedRoute({ 
  component: Component, 
  path, 
  requiredModule, 
  requireSuperAdmin 
}: { 
  component: React.ComponentType<any>; 
  path?: string; 
  requiredModule?: string; 
  requireSuperAdmin?: boolean; 
}) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/auth" />;
  }

  if (requireSuperAdmin && user.role !== "SuperAdmin") {
    return <Redirect to="/" />;
  }

  if (requiredModule && user.role !== "SuperAdmin") {
    const hasPerm = !!user.permissions?.[requiredModule]?.view;
    if (!hasPerm) {
      return <Redirect to="/" />;
    }
  }

  return <Route path={path} component={Component} />;
}

function Router() {
  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
      <ProtectedRoute path="/" component={Dashboard} />
      <ProtectedRoute path="/registration" component={Registration} requiredModule="patients" />
      <ProtectedRoute path="/patient/:id" component={PatientDetails} requiredModule="patients" />
      <ProtectedRoute path="/billing" component={BillingCreate} requiredModule="billing" />
      <ProtectedRoute path="/bills" component={BillingManage} requiredModule="billing" />
      <ProtectedRoute path="/medicines" component={Medicines} requiredModule="medicines" />
      <ProtectedRoute path="/treatments" component={Treatments} requiredModule="treatments" />
      <ProtectedRoute path="/departments" component={Departments} requiredModule="treatments" />
      <ProtectedRoute path="/expenses" component={Expenses} requiredModule="expenses" />
      <ProtectedRoute path="/appointments" component={AppointmentMaster} requiredModule="appointments" />
      <ProtectedRoute path="/reports" component={Reports} requiredModule="reports" />
      <ProtectedRoute path="/crm" component={CRMDashboard} requiredModule="crm" />
      <ProtectedRoute path="/crm/leads" component={CRMLeads} requiredModule="crm" />
      <ProtectedRoute path="/crm/tasks" component={CRMTasks} requiredModule="crm" />
      <ProtectedRoute path="/users" component={UsersPage} requireSuperAdmin />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="clinic-care-theme">
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TooltipProvider>
            <div className="min-h-screen bg-background pb-20">
              <Navbar />
              <main>
                <Router />
              </main>
            </div>
            <footer className="fixed left-0 bottom-0 z-40 w-full h-12 border-t bg-card/95 text-sm flex items-center justify-center text-muted-foreground backdrop-blur">
              <div className="max-w-[1600px] mx-auto px-4 text-center">
                <a
                  href="https://nakranitechno.onrender.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline hover:text-primary transition-colors cursor-pointer"
                >
                  {`Copyright © ${new Date().getFullYear()} Nakrani Techno & Solution LLP. All Rights Reserved.`}
                </a>
              </div>
            </footer>
            <Toaster />
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
