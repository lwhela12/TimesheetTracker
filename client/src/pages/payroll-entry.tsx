import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import Sidebar from "@/components/layout/sidebar";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatDate, formatCurrency } from "@/lib/utils";
import { addDays, format, startOfWeek } from "date-fns";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Download, Calculator } from "lucide-react";

type Employee = {
  id: number;
  first_name: string;
  last_name: string;
  rate: number;
  active: boolean;
  created_at?: Date | string | null;
};

type PayrollSummary = {
  employee_id: number;
  employee: Employee;
  total_hours: number;
  pto_hours: number;
  holiday_worked_hours: number;
  holiday_non_worked_hours: number;
  overtime_hours: number;
  total_miles: number;
  misc_reimbursement: number;
  regular_pay: number;
  overtime_pay: number;
  pto_pay: number;
  holiday_pay: number;
  mileage_pay: number;
  total_pay: number;
  has_entries: boolean;
};

type PayrollPeriod = {
  start_date: string;
  end_date: string;
  employees: PayrollSummary[];
};

export default function PayrollEntry() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedPeriod, setSelectedPeriod] = useState(() => {
    // Get next Wednesday as default pay period start
    const today = new Date();
    const daysUntilWednesday = (3 - today.getDay() + 7) % 7;
    const nextWednesday = addDays(today, daysUntilWednesday === 0 ? 7 : daysUntilWednesday);
    return format(nextWednesday, "yyyy-MM-dd");
  });

  // Fetch payroll data for the selected period
  const { data: payrollData, isLoading } = useQuery<PayrollPeriod>({
    queryKey: ["/api/payroll/period", selectedPeriod],
    queryFn: async () => {
      const endDate = format(addDays(new Date(selectedPeriod), 13), "yyyy-MM-dd");
      const res = await fetch(`/api/payroll/period?start_date=${selectedPeriod}&end_date=${endDate}`);
      if (!res.ok) throw new Error("Failed to fetch payroll data");
      return res.json();
    },
  });

  // Export to Excel mutation
  const exportMutation = useMutation({
    mutationFn: async () => {
      const endDate = format(addDays(new Date(selectedPeriod), 13), "yyyy-MM-dd");
      const res = await apiRequest("GET", `/api/payroll/export?start_date=${selectedPeriod}&end_date=${endDate}`);
      return res.blob();
    },
    onSuccess: (blob) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `payroll_${selectedPeriod}_to_${format(addDays(new Date(selectedPeriod), 13), "yyyy-MM-dd")}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast({
        title: "Success",
        description: "Payroll report exported successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to export payroll: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const handleExport = () => {
    exportMutation.mutate();
  };

  const handlePeriodChange = (newPeriod: string) => {
    setSelectedPeriod(newPeriod);
  };

  const endDate = format(addDays(new Date(selectedPeriod), 13), "yyyy-MM-dd");
  const totalPayroll = payrollData?.employees.reduce((sum, emp) => sum + emp.total_pay, 0) || 0;
  const employeesWithEntries = payrollData?.employees.filter(emp => emp.has_entries).length || 0;
  const totalEmployees = payrollData?.employees.length || 0;

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="bg-white shadow-sm border-b px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLocation("/")}
                className="flex items-center"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
              <div>
                <h1 className="text-2xl font-bold">Weekly Payroll Entry</h1>
                <p className="text-gray-600">
                  Pay Period: {selectedPeriod} to {endDate}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                onClick={handleExport}
                disabled={exportMutation.isPending}
                className="flex items-center"
              >
                <Download className="h-4 w-4 mr-2" />
                Export to Excel
              </Button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Period Selection */}
            <Card>
              <CardHeader>
                <CardTitle>Pay Period Selection</CardTitle>
                <CardDescription>
                  Select the Wednesday that starts the two-week pay period
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-4">
                  <Input
                    type="date"
                    value={selectedPeriod}
                    onChange={(e) => handlePeriodChange(e.target.value)}
                    className="w-auto"
                  />
                  <div className="text-sm text-gray-600">
                    Two-week period: {selectedPeriod} through {endDate}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Payroll</p>
                      <p className="text-2xl font-bold">{formatCurrency(totalPayroll)}</p>
                    </div>
                    <Calculator className="h-8 w-8 text-green-600" />
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Entries Complete</p>
                      <p className="text-2xl font-bold">{employeesWithEntries}/{totalEmployees}</p>
                    </div>
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${
                      employeesWithEntries === totalEmployees ? 'bg-green-600' : 'bg-yellow-600'
                    }`}>
                      {Math.round((employeesWithEntries / totalEmployees) * 100)}%
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total OT Hours</p>
                    <p className="text-2xl font-bold">
                      {payrollData?.employees.reduce((sum, emp) => sum + emp.overtime_hours, 0).toFixed(1) || "0.0"}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Miles</p>
                    <p className="text-2xl font-bold">
                      {payrollData?.employees.reduce((sum, emp) => sum + emp.total_miles, 0).toFixed(1) || "0.0"}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Employee Payroll Table */}
            <Card>
              <CardHeader>
                <CardTitle>Employee Payroll Summary</CardTitle>
                <CardDescription>
                  Review and verify payroll entries for all employees
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                      <p className="mt-2 text-sm text-gray-600">Loading payroll data...</p>
                    </div>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Employee</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Total Hours</TableHead>
                          <TableHead className="text-right">PTO Hours</TableHead>
                          <TableHead className="text-right">Holiday Worked</TableHead>
                          <TableHead className="text-right">Holiday Non-Worked</TableHead>
                          <TableHead className="text-right">OT Hours</TableHead>
                          <TableHead className="text-right">Miles</TableHead>
                          <TableHead className="text-right">Reimbursements</TableHead>
                          <TableHead className="text-right">Total Pay</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {payrollData?.employees.map((employee) => (
                          <TableRow key={employee.employee_id}>
                            <TableCell className="font-medium">
                              {employee.employee.first_name} {employee.employee.last_name}
                            </TableCell>
                            <TableCell>
                              {employee.has_entries ? (
                                <Badge variant="default" className="bg-green-100 text-green-800">
                                  Complete
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="bg-red-100 text-red-800">
                                  Pending
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {employee.has_entries ? employee.total_hours.toFixed(1) : "-"}
                            </TableCell>
                            <TableCell className="text-right">
                              {employee.has_entries ? employee.pto_hours.toFixed(1) : "-"}
                            </TableCell>
                            <TableCell className="text-right">
                              {employee.has_entries ? employee.holiday_worked_hours.toFixed(1) : "-"}
                            </TableCell>
                            <TableCell className="text-right">
                              {employee.has_entries ? employee.holiday_non_worked_hours.toFixed(1) : "-"}
                            </TableCell>
                            <TableCell className="text-right">
                              {employee.has_entries ? employee.overtime_hours.toFixed(1) : "-"}
                            </TableCell>
                            <TableCell className="text-right">
                              {employee.has_entries ? employee.total_miles.toFixed(1) : "-"}
                            </TableCell>
                            <TableCell className="text-right">
                              {employee.has_entries ? formatCurrency(employee.misc_reimbursement) : "-"}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {employee.has_entries ? formatCurrency(employee.total_pay) : "-"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}