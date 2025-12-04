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
import Login from "@/pages/login";
import NotFound from "@/pages/not-found";

interface User {
  id: string;
  username: string;
}

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const [isAuth, setIsAuth] = useState<boolean | null>(null);

  useEffect(() => {
    // Check authentication status
    fetch("/api/auth/me", { credentials: "include" })
      .then((res) => {
        setIsAuth(res.ok);
      })
      .catch(() => setIsAuth(false));
  }, []);

  if (isAuth === null) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!isAuth) {
    // Redirect to login by returning the component but let Router handle navigation
    return <Login />;
  }

  return <Component />;
}

function Router() {
  const [isAuth, setIsAuth] = useState<boolean | null>(null);

  useEffect(() => {
    // Check authentication status on mount
    fetch("/api/auth/me", { credentials: "include" })
      .then((res) => {
        setIsAuth(res.ok);
      })
      .catch(() => setIsAuth(false));
  }, []);

  if (isAuth === null) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  // If not authenticated, show login page
  if (!isAuth) {
    return (
      <Switch>
        <Route path="/login" component={Login} />
        <Route component={Login} />
      </Switch>
    );
  }

  return (
    <Switch>
      <Route path="/login" component={() => <Dashboard />} /> {/* Redirect to dashboard if logged in */}
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
  const [isAuth, setIsAuth] = useState<boolean | null>(null);

  useEffect(() => {
    // Check authentication status on mount
    fetch("/api/auth/me", { credentials: "include" })
      .then((res) => {
        setIsAuth(res.ok);
      })
      .catch(() => setIsAuth(false));
  }, []);

  return (
    <ThemeProvider defaultTheme="light" storageKey="prime-care-theme">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <div className="min-h-screen bg-background">
            {isAuth && <Navbar />}
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
