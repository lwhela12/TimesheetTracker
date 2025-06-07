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
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
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

  // Fetch detailed punch data for selected employee
  const { data: employeePunches, isLoading: punchesLoading } = useQuery({
    queryKey: ["/api/punches", selectedEmployee?.id, selectedPeriod],
    queryFn: async () => {
      if (!selectedEmployee) return [];
      const endDate = format(addDays(new Date(selectedPeriod), 13), "yyyy-MM-dd");
      const res = await fetch(`/api/punches?employee_id=${selectedEmployee.id}&from_date=${selectedPeriod}&to_date=${endDate}`);
      if (!res.ok) throw new Error("Failed to fetch punch data");
      return res.json();
    },
    enabled: !!selectedEmployee,
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
                              <button
                                onClick={() => setSelectedEmployee(employee.employee)}
                                className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                              >
                                {employee.employee.first_name} {employee.employee.last_name}
                              </button>
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
                              {employee.has_entries && employee.total_hours != null
                                ? employee.total_hours.toFixed(1)
                                : "-"}
                            </TableCell>
                            <TableCell className="text-right">
                              {employee.has_entries && employee.pto_hours != null
                                ? employee.pto_hours.toFixed(1)
                                : "-"}
                            </TableCell>
                            <TableCell className="text-right">
                              {employee.has_entries && employee.holiday_worked_hours != null
                                ? employee.holiday_worked_hours.toFixed(1)
                                : "-"}
                            </TableCell>
                            <TableCell className="text-right">
                              {employee.has_entries && employee.holiday_non_worked_hours != null
                                ? employee.holiday_non_worked_hours.toFixed(1)
                                : "-"}
                            </TableCell>
                            <TableCell className="text-right">
                              {employee.has_entries && employee.overtime_hours != null
                                ? employee.overtime_hours.toFixed(1)
                                : "-"}
                            </TableCell>
                            <TableCell className="text-right">
                              {employee.has_entries && employee.total_miles != null
                                ? employee.total_miles.toFixed(1)
                                : "-"}
                            </TableCell>
                            <TableCell className="text-right">
                              {employee.has_entries && employee.misc_reimbursement != null
                                ? formatCurrency(employee.misc_reimbursement)
                                : "-"}
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

      {/* Employee Detail Modal */}
      {selectedEmployee && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold">
                    {selectedEmployee.first_name} {selectedEmployee.last_name}
                  </h2>
                  <p className="text-gray-600">
                    Two-Week Entry: {formatDate(new Date(selectedPeriod))} - {formatDate(addDays(new Date(selectedPeriod), 13))}
                  </p>
                  <p className="text-sm text-gray-500">Rate: {formatCurrency(selectedEmployee.rate)}/hour</p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setSelectedEmployee(null)}
                  className="flex items-center gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to Summary
                </Button>
              </div>

              {punchesLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                    <p className="mt-2 text-sm text-gray-600">Loading time entries...</p>
                  </div>
                </div>
              ) : (
                <EmployeeDetailView 
                  employee={selectedEmployee}
                  punches={employeePunches || []}
                  periodStart={selectedPeriod}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Employee Detail View Component
function EmployeeDetailView({ 
  employee, 
  punches, 
  periodStart 
}: { 
  employee: Employee;
  punches: any[];
  periodStart: string;
}) {
  const { toast } = useToast();
  const [editingPunches, setEditingPunches] = useState<{[key: string]: any}>({});
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize editing state with existing punch data
  React.useEffect(() => {
    const initialState: {[key: string]: any} = {};
    punches.forEach(punch => {
      initialState[punch.date] = { ...punch };
    });
    setEditingPunches(initialState);
  }, [punches]);

  // Batch upsert punches
  const batchMutation = useMutation({
    mutationFn: async (entries: any[]) => {
      const res = await apiRequest("POST", "/api/punches/batch", { entries });
      return res.json();
    },
  });

  const handleFieldChange = (date: string, field: string, value: any) => {
    setEditingPunches(prev => ({
      ...prev,
      [date]: {
        ...prev[date],
        [field]: value,
        date: date
      }
    }));
    setHasChanges(true);
  };

  const saveChanges = async () => {
    const entries: any[] = [];

    Object.values(editingPunches).forEach(punch => {
      if (
        punch &&
        (
          punch.time_in ||
          punch.time_out ||
          punch.pto_hours ||
          punch.holiday_worked_hours ||
          punch.holiday_non_worked_hours ||
          punch.misc_hours ||
          punch.miles ||
          punch.misc_reimbursement ||
          punch.lunch_minutes
        )
      ) {
        const cleanPunch: any = { ...punch };

        if (cleanPunch.time_in === '') cleanPunch.time_in = null;
        if (cleanPunch.time_out === '') cleanPunch.time_out = null;

        if (cleanPunch.pto_hours === '' || cleanPunch.pto_hours === 0) cleanPunch.pto_hours = null;
        if (cleanPunch.holiday_worked_hours === '' || cleanPunch.holiday_worked_hours === 0) cleanPunch.holiday_worked_hours = null;
        if (cleanPunch.holiday_non_worked_hours === '' || cleanPunch.holiday_non_worked_hours === 0) cleanPunch.holiday_non_worked_hours = null;
        if (cleanPunch.misc_hours === '' || cleanPunch.misc_hours === 0) cleanPunch.misc_hours = null;
        if (cleanPunch.miles === '' || cleanPunch.miles === 0) cleanPunch.miles = null;
        if (cleanPunch.misc_reimbursement === '' || cleanPunch.misc_reimbursement === 0) cleanPunch.misc_reimbursement = null;
        if (cleanPunch.lunch_minutes === '' || cleanPunch.lunch_minutes === 0) cleanPunch.lunch_minutes = null;

        entries.push({ ...cleanPunch, employee_id: employee.id });
      }
    });

    if (entries.length === 0) {
      setHasChanges(false);
      return;
    }

    try {
      await batchMutation.mutateAsync(entries);
      queryClient.invalidateQueries({ predicate: q => q.queryKey.some(key => typeof key === 'string' && key.includes('/api/punches')) });
      toast({ title: 'Success', description: 'Changes saved' });
      setHasChanges(false);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: `Failed to save changes: ${error.message}`,
        variant: 'destructive'
      });
    }
  };
  // Generate 14 days for the two-week period
  const twoWeekDays = Array.from({ length: 14 }, (_, i) => {
    const date = addDays(new Date(periodStart), i);
    return {
      date: format(date, 'yyyy-MM-dd'),
      dayName: format(date, 'EEEE'),
      dateDisplay: format(date, 'MMM d'),
      punch: punches.find(p => p.date === format(date, 'yyyy-MM-dd'))
    };
  });

  const weekOne = twoWeekDays.slice(0, 7);
  const weekTwo = twoWeekDays.slice(7);

  return (
    <div className="space-y-6">
      {/* Save Changes Button */}
      {hasChanges && (
        <div className="flex justify-end">
          <Button
            onClick={saveChanges}
            disabled={batchMutation.isPending}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {batchMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      )}

      {/* Week 1 */}
      <Card>
        <CardHeader>
          <CardTitle>Week 1: {format(new Date(periodStart), 'MMM d')} - {format(addDays(new Date(periodStart), 6), 'MMM d')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Day</TableHead>
                  <TableHead>Time In</TableHead>
                  <TableHead>Time Out</TableHead>
                  <TableHead>Lunch (min)</TableHead>
                  <TableHead>Miles</TableHead>
                  <TableHead>PTO Hours</TableHead>
                  <TableHead>Holiday Worked</TableHead>
                  <TableHead>Holiday Non-Worked</TableHead>
                  <TableHead>Misc Hours</TableHead>
                  <TableHead>Misc Reimb</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {weekOne.map((day) => {
                  const editingPunch = editingPunches[day.date] || {};
                  return (
                    <TableRow key={day.date}>
                      <TableCell className="font-medium">{day.dateDisplay}</TableCell>
                      <TableCell>{day.dayName}</TableCell>
                      <TableCell>
                        <Input
                          type="time"
                          value={editingPunch.time_in || ''}
                          onChange={(e) => handleFieldChange(day.date, 'time_in', e.target.value)}
                          className="w-20 text-xs"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="time"
                          value={editingPunch.time_out || ''}
                          onChange={(e) => handleFieldChange(day.date, 'time_out', e.target.value)}
                          className="w-20 text-xs"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={editingPunch.lunch_minutes || ''}
                          onChange={(e) => handleFieldChange(day.date, 'lunch_minutes', parseInt(e.target.value) || null)}
                          className="w-16 text-xs"
                          min="0"
                          max="480"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.1"
                          value={editingPunch.miles || ''}
                          onChange={(e) => handleFieldChange(day.date, 'miles', parseFloat(e.target.value) || null)}
                          className="w-16 text-xs"
                          min="0"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.1"
                          value={editingPunch.pto_hours || ''}
                          onChange={(e) => handleFieldChange(day.date, 'pto_hours', parseFloat(e.target.value) || null)}
                          className="w-16 text-xs"
                          min="0"
                          max="8"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.1"
                          value={editingPunch.holiday_worked_hours || ''}
                          onChange={(e) => handleFieldChange(day.date, 'holiday_worked_hours', parseFloat(e.target.value) || null)}
                          className="w-16 text-xs"
                          min="0"
                          max="8"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.1"
                          value={editingPunch.holiday_non_worked_hours || ''}
                          onChange={(e) => handleFieldChange(day.date, 'holiday_non_worked_hours', parseFloat(e.target.value) || null)}
                          className="w-16 text-xs"
                          min="0"
                          max="8"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.1"
                          value={editingPunch.misc_hours || ''}
                          onChange={(e) => handleFieldChange(day.date, 'misc_hours', parseFloat(e.target.value) || null)}
                          className="w-16 text-xs"
                          min="0"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          value={editingPunch.misc_reimbursement || ''}
                          onChange={(e) => handleFieldChange(day.date, 'misc_reimbursement', parseFloat(e.target.value) || null)}
                          className="w-20 text-xs"
                          min="0"
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Week 2 */}
      <Card>
        <CardHeader>
          <CardTitle>Week 2: {format(addDays(new Date(periodStart), 7), 'MMM d')} - {format(addDays(new Date(periodStart), 13), 'MMM d')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Day</TableHead>
                  <TableHead>Time In</TableHead>
                  <TableHead>Time Out</TableHead>
                  <TableHead>Lunch (min)</TableHead>
                  <TableHead>Miles</TableHead>
                  <TableHead>PTO Hours</TableHead>
                  <TableHead>Holiday Worked</TableHead>
                  <TableHead>Holiday Non-Worked</TableHead>
                  <TableHead>Misc Hours</TableHead>
                  <TableHead>Misc Reimb</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {weekTwo.map((day) => {
                  const editingPunch = editingPunches[day.date] || {};
                  return (
                    <TableRow key={day.date}>
                      <TableCell className="font-medium">{day.dateDisplay}</TableCell>
                      <TableCell>{day.dayName}</TableCell>
                      <TableCell>
                        <Input
                          type="time"
                          value={editingPunch.time_in || ''}
                          onChange={(e) => handleFieldChange(day.date, 'time_in', e.target.value)}
                          className="w-20 text-xs"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="time"
                          value={editingPunch.time_out || ''}
                          onChange={(e) => handleFieldChange(day.date, 'time_out', e.target.value)}
                          className="w-20 text-xs"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={editingPunch.lunch_minutes || ''}
                          onChange={(e) => handleFieldChange(day.date, 'lunch_minutes', parseInt(e.target.value) || null)}
                          className="w-16 text-xs"
                          min="0"
                          max="480"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.1"
                          value={editingPunch.miles || ''}
                          onChange={(e) => handleFieldChange(day.date, 'miles', parseFloat(e.target.value) || null)}
                          className="w-16 text-xs"
                          min="0"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.1"
                          value={editingPunch.pto_hours || ''}
                          onChange={(e) => handleFieldChange(day.date, 'pto_hours', parseFloat(e.target.value) || null)}
                          className="w-16 text-xs"
                          min="0"
                          max="8"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.1"
                          value={editingPunch.holiday_worked_hours || ''}
                          onChange={(e) => handleFieldChange(day.date, 'holiday_worked_hours', parseFloat(e.target.value) || null)}
                          className="w-16 text-xs"
                          min="0"
                          max="8"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.1"
                          value={editingPunch.holiday_non_worked_hours || ''}
                          onChange={(e) => handleFieldChange(day.date, 'holiday_non_worked_hours', parseFloat(e.target.value) || null)}
                          className="w-16 text-xs"
                          min="0"
                          max="8"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.1"
                          value={editingPunch.misc_hours || ''}
                          onChange={(e) => handleFieldChange(day.date, 'misc_hours', parseFloat(e.target.value) || null)}
                          className="w-16 text-xs"
                          min="0"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          value={editingPunch.misc_reimbursement || ''}
                          onChange={(e) => handleFieldChange(day.date, 'misc_reimbursement', parseFloat(e.target.value) || null)}
                          className="w-20 text-xs"
                          min="0"
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Summary for this employee */}
      <Card>
        <CardHeader>
          <CardTitle>Two-Week Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-sm text-gray-600">Total Hours</p>
              <p className="text-2xl font-bold">
                {Object.values(editingPunches).reduce((sum, p) => {
                  if (!p || !p.time_in || !p.time_out) return sum;
                  const timeIn = new Date(`1970-01-01T${p.time_in}`);
                  const timeOut = new Date(`1970-01-01T${p.time_out}`);
                  const hours = (timeOut.getTime() - timeIn.getTime()) / (1000 * 60 * 60);
                  const lunchHours = (p.lunch_minutes || 0) / 60;
                  return sum + Math.max(0, hours - lunchHours);
                }, 0).toFixed(1)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">PTO Hours</p>
              <p className="text-2xl font-bold">
                {Object.values(editingPunches).reduce((sum, p) => sum + (p?.pto_hours || 0), 0).toFixed(1)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">Total Miles</p>
              <p className="text-2xl font-bold">
                {Object.values(editingPunches).reduce((sum, p) => sum + (p?.miles || 0), 0).toFixed(1)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">Misc Reimb</p>
              <p className="text-2xl font-bold">
                {formatCurrency(Object.values(editingPunches).reduce((sum, p) => sum + (p?.misc_reimbursement || 0), 0))}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}