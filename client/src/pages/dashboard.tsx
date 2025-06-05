import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import Sidebar from "@/components/layout/sidebar";
import MetricCard from "@/components/dashboard/metric-card";
import PayrollChart from "@/components/dashboard/payroll-chart";
import OvertimeLeaders from "@/components/dashboard/overtime-leaders";
import RecentTimesheetEntries from "@/components/dashboard/recent-timesheet-entries";
import TimeEntryForm from "@/components/forms/time-entry-form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
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
import { Button } from "@/components/ui/button";
import {
  DollarSign,
  Clock,
  Map,
  Users,
  Loader2,
} from "lucide-react";

type Employee = {
  id: number;
  first_name: string;
  last_name: string;
  rate: number;
  active: boolean;
};

type OvertimeLeader = {
  employee: Employee;
  total_ot_hours: number;
  total_ot_pay: number;
};

type TimesheetEntry = {
  id: number;
  employee: {
    id: number;
    first_name: string;
    last_name: string;
  };
  date: string;
  time_in: string;
  time_out: string;
  lunch_minutes: number;
  miles: number;
  status: string;
  payroll?: {
    reg_hours: number;
    ot_hours: number;
  };
};

type DashboardData = {
  metrics: {
    totalPayroll: number;
    payrollTrend: number;
    overtimeHours: number;
    overtimeTrend: number;
    totalMileage: number;
    mileageTrend: number;
    activeEmployees: number;
  };
  weeklyPayrollData: Array<{
    weekStart: string;
    weekEnd: string;
    regularPay: number;
    overtimePay: number;
    mileagePay: number;
    totalPay: number;
  }>;
  overtimeLeaders: OvertimeLeader[];
  recentEntries: TimesheetEntry[];
};

export default function Dashboard() {
  const { toast } = useToast();
  const [timeEntryModalOpen, setTimeEntryModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [entriesPerPage] = useState(5);
  const [selectedEntry, setSelectedEntry] = useState<TimesheetEntry | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<number | null>(null);
  const [timeEntryIsEditMode, setTimeEntryIsEditMode] = useState(false);

  // Fetch dashboard data
  const { data: dashboardData, isLoading: isDashboardLoading } = useQuery<DashboardData>({
    queryKey: ["/api/reports/dashboard"],
  });

  // Fetch employees for dropdown in time entry form
  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
  });

  // Create time entry mutation
  const createTimeEntryMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/punches", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reports/dashboard"] });
      toast({
        title: "Success",
        description: "Time entry added successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to add time entry: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Update time entry mutation
  const updateTimeEntryMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest("PUT", `/api/punches/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reports/dashboard"] });
      toast({
        title: "Success",
        description: "Time entry updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to update time entry: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Delete time entry mutation
  const deleteTimeEntryMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/punches/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reports/dashboard"] });
      toast({
        title: "Success",
        description: "Time entry deleted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to delete time entry: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Format currency for display
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  // Handle adding a new time entry
  const handleAddTimeEntry = () => {
    setTimeEntryIsEditMode(false);
    setSelectedEntry(null);
    setTimeEntryModalOpen(true);
  };

  // Handle editing a time entry
  const handleEditTimeEntry = (id: number) => {
    const entry = dashboardData?.recentEntries.find(e => e.id === id);
    if (entry) {
      setSelectedEntry(entry);
      setTimeEntryIsEditMode(true);
      setTimeEntryModalOpen(true);
    }
  };

  // Handle confirming deletion of a time entry
  const handleDeleteTimeEntry = (id: number) => {
    setEntryToDelete(id);
    setDeleteConfirmOpen(true);
  };

  // Handle time entry form submission
  const handleTimeEntrySubmit = (data: any) => {
    if (timeEntryIsEditMode && selectedEntry) {
      updateTimeEntryMutation.mutate({ id: selectedEntry.id, data });
    } else {
      createTimeEntryMutation.mutate(data);
    }
  };

  // Handle export of payroll data
  const handleExportPayroll = () => {
    // Get current date for filename
    const today = new Date();
    const fromDate = new Date(today);
    fromDate.setDate(today.getDate() - 28); // Last 4 weeks
    
    const fromStr = fromDate.toISOString().split('T')[0];
    const toStr = today.toISOString().split('T')[0];
    
    // Create download URL
    const downloadUrl = `/api/reports/payroll?from_date=${fromStr}&to_date=${toStr}&format=csv`;
    
    // Create temporary link and trigger download
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.setAttribute('download', `payroll-${fromStr}-to-${toStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({
      title: "Export Started",
      description: "Your payroll report is being downloaded",
    });
  };

  // Handle view all overtime leaders
  const handleViewAllOvertimeLeaders = () => {
    // In a real implementation, this would navigate to a dedicated overtime report page
    toast({
      title: "Feature Coming Soon",
      description: "View all overtime leaders will be available in the next release",
    });
  };

  return (
    <div className="flex h-screen overflow-hidden bg-neutral-50">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mb-6 flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-semibold text-neutral-900">Dashboard</h2>
              <p className="text-neutral-500">Overview of payroll and timesheet data</p>
            </div>
            <Button
              onClick={() => window.location.href = '/payroll-entry'}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md font-medium transition-colors"
            >
              Weekly Payroll
            </Button>
          </div>

          {isDashboardLoading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : dashboardData ? (
            <>
              {/* Dashboard summary cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <MetricCard
                  title="Total Payroll"
                  value={formatCurrency(dashboardData.metrics.totalPayroll)}
                  trend={dashboardData.metrics.payrollTrend}
                  icon={<DollarSign />}
                  iconBgColor="bg-primary-100"
                  iconColor="text-primary"
                />
                <MetricCard
                  title="Overtime Hours"
                  value={dashboardData.metrics.overtimeHours.toFixed(1)}
                  trend={dashboardData.metrics.overtimeTrend}
                  icon={<Clock />}
                  iconBgColor="bg-amber-100"
                  iconColor="text-amber-600"
                />
                <MetricCard
                  title="Total Mileage"
                  value={dashboardData.metrics.totalMileage.toFixed(0)}
                  trend={dashboardData.metrics.mileageTrend}
                  icon={<Map />}
                  iconBgColor="bg-indigo-100"
                  iconColor="text-indigo-600"
                />
                <MetricCard
                  title="Active Employees"
                  value={dashboardData.metrics.activeEmployees}
                  trendLabel="No change"
                  icon={<Users />}
                  iconBgColor="bg-green-100"
                  iconColor="text-green-600"
                />
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                <div className="lg:col-span-2">
                  <PayrollChart
                    data={dashboardData.weeklyPayrollData}
                    onPeriodChange={(period) => {
                      toast({
                        title: "Feature Coming Soon",
                        description: `${period} view will be available in the next release`,
                      });
                    }}
                    onExport={handleExportPayroll}
                  />
                </div>
                <div>
                  <OvertimeLeaders
                    leaders={dashboardData.overtimeLeaders}
                    onViewAll={handleViewAllOvertimeLeaders}
                  />
                </div>
              </div>

              {/* Recent timesheet entries */}
              <RecentTimesheetEntries
                entries={dashboardData.recentEntries}
                totalEntries={dashboardData.recentEntries.length} // In a real app, this would come from the API
                onAddEntry={handleAddTimeEntry}
                onEditEntry={handleEditTimeEntry}
                onDeleteEntry={handleDeleteTimeEntry}
                onPageChange={setCurrentPage}
                currentPage={currentPage}
                entriesPerPage={entriesPerPage}
              />
            </>
          ) : (
            <div className="text-center py-12">
              <p className="text-neutral-500">Failed to load dashboard data. Please try again.</p>
            </div>
          )}
        </main>
      </div>

      {/* Time Entry Form Modal */}
      <TimeEntryForm
        open={timeEntryModalOpen}
        onOpenChange={setTimeEntryModalOpen}
        onSubmit={handleTimeEntrySubmit}
        employees={employees.filter(e => e.active)}
        initialData={selectedEntry ? {
          employee_id: selectedEntry.employee.id,
          date: selectedEntry.date,
          time_in: selectedEntry.time_in,
          time_out: selectedEntry.time_out,
          lunch_minutes: selectedEntry.lunch_minutes,
          miles: selectedEntry.miles,
          status: selectedEntry.status
        } : undefined}
        isEditMode={timeEntryIsEditMode}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              timesheet entry.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (entryToDelete !== null) {
                  deleteTimeEntryMutation.mutate(entryToDelete);
                  setEntryToDelete(null);
                }
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
