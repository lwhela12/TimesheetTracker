import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import TimesheetEntry from "@/pages/timesheet-entry";
import PayrollEntry from "@/pages/payroll-entry";
import Employees from "@/pages/employees";
import Reports from "@/pages/reports";
import Settings from "@/pages/settings";
import AuthPage from "@/pages/auth-page";
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
          <TimesheetEntry />
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
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
