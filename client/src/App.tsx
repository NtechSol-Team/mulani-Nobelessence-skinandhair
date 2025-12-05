import { useEffect, useState } from "react";
import { Switch, Route } from "wouter";
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
import Reports from "@/pages/reports";
import NotFound from "@/pages/not-found";

interface User {
  id: string;
  username: string;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/registration" component={Registration} />
      <Route path="/patient/:id" component={PatientDetails} />
      <Route path="/billing" component={BillingCreate} />
      <Route path="/bills" component={BillingManage} />
      <Route path="/medicines" component={Medicines} />
      <Route path="/treatments" component={Treatments} />
      <Route path="/expenses" component={Expenses} />
      <Route path="/reports" component={Reports} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="prime-care-theme">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <div className="min-h-screen bg-background pb-12">
            <Navbar />
            <main>
              <Router />
            </main>
          </div>
          <footer className="fixed left-0 bottom-0 w-full h-12 border-t bg-card/95 text-sm flex items-center justify-center text-muted-foreground">
            <div className="max-w-[1600px] mx-auto px-4 text-center">
              Copyright © 2025 Nakrani Techno & Solution LLP. All Rights Reserved.
            </div>
          </footer>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
