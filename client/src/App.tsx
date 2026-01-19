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
import Expenses from "@/pages/expenses";
import AppointmentMaster from "@/pages/appointment-master";
import Reports from "@/pages/reports";
import AuthPage from "@/pages/auth-page";
import NotFound from "@/pages/not-found";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";

function ProtectedRoute(props: { component: React.ComponentType<any>, path?: string }) {
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

  return <Route path={props.path} component={props.component} />;
}

function Router() {
  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
      <ProtectedRoute path="/" component={Dashboard} />
      <ProtectedRoute path="/registration" component={Registration} />
      <ProtectedRoute path="/patient/:id" component={PatientDetails} />
      <ProtectedRoute path="/billing" component={BillingCreate} />
      <ProtectedRoute path="/bills" component={BillingManage} />
      <ProtectedRoute path="/medicines" component={Medicines} />
      <ProtectedRoute path="/treatments" component={Treatments} />
      <ProtectedRoute path="/expenses" component={Expenses} />
      <ProtectedRoute path="/appointments" component={AppointmentMaster} />
      <ProtectedRoute path="/reports" component={Reports} />
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
                Copyright © {new Date().getFullYear()} Nakrani Techno & Solution LLP. All Rights Reserved.
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
