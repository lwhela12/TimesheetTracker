import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Suspense, lazy } from "react";
import NotFound from "@/pages/not-found";

const Dashboard = lazy(() => import("@/pages/dashboard"));
const PayrollEntry = lazy(() => import("@/pages/payroll-entry"));
const Employees = lazy(() => import("@/pages/employees"));
const Reports = lazy(() => import("@/pages/reports"));
const Settings = lazy(() => import("@/pages/settings"));
const AuthPage = lazy(() => import("@/pages/auth-page"));
import { ProtectedPage } from "./lib/protected-page";
import { AuthProvider } from "@/hooks/use-auth";

function Router() {
  return (
    <Switch>
      <Route path="/">
        <ProtectedPage>
          <Dashboard />
        </ProtectedPage>
      </Route>

      <Route path="/timesheet-entry">
        <ProtectedPage>
          <PayrollEntry />
        </ProtectedPage>
      </Route>
      <Route path="/payroll-entry">
        <ProtectedPage>
          <PayrollEntry />
        </ProtectedPage>
      </Route>
      <Route path="/employees">
        <ProtectedPage>
          <Employees />
        </ProtectedPage>
      </Route>
      <Route path="/reports">
        <ProtectedPage>
          <Reports />
        </ProtectedPage>
      </Route>
      <Route path="/settings">
        <ProtectedPage>
          <Settings />
        </ProtectedPage>
      </Route>
      <Route path="/auth" component={AuthPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Suspense fallback={<div className="flex h-screen items-center justify-center">Loading...</div>}>
            <Router />
          </Suspense>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
