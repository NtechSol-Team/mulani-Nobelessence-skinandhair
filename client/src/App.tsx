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
import Billing from "@/pages/billing";
import Medicines from "@/pages/medicines";
import Treatments from "@/pages/treatments";
import Expenses from "@/pages/expenses";
import Reports from "@/pages/reports";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/registration" component={Registration} />
      <Route path="/patient/:id" component={PatientDetails} />
      <Route path="/billing" component={Billing} />
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
          <div className="min-h-screen bg-background">
            <Navbar />
            <main>
              <Router />
            </main>
          </div>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
