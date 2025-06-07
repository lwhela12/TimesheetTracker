import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Sidebar from "@/components/layout/sidebar";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  Download,
  Loader2,
  FileSpreadsheet,
  DollarSign,
  Clock,
  Route,
  CalendarRange,
} from "lucide-react";

type OvertimeLeader = {
  employee: {
    id: number;
    first_name: string;
    last_name: string;
    rate: number;
  };
  total_ot_hours: number;
  total_ot_pay: number;
};

type PayrollReportEntry = {
  id: number;
  date: string;
  employee: {
    id: number;
    first_name: string;
    last_name: string;
    rate: number;
  };
  payroll: {
    reg_hours: number;
    ot_hours: number;
    pto_hours?: number;
    holiday_worked_hours?: number;
    holiday_non_worked_hours?: number;
    pay: number;
    mileage_pay: number;
    misc_reimbursement?: number;
    total_pay: number;
  };
  miles: number;
  misc_reimbursement?: number;
};

export default function Reports() {
  const { toast } = useToast();
  const [fromDate, setFromDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30); // Default to last 30 days
    return date.toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState(() => {
    const date = new Date();
    return date.toISOString().split('T')[0];
  });
  const [activeTab, setActiveTab] = useState("payroll");
  
  // Format date for display
  const formatDisplayDate = (dateString: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  // Fetch overtime report
  const {
    data: overtimeLeaders = [],
    isLoading: isOvertimeLoading,
  } = useQuery<OvertimeLeader[]>({
    queryKey: [`/api/reports/overtime?from_date=${fromDate}&to_date=${toDate}`],
    enabled: activeTab === "overtime",
  });

  // Fetch payroll report
  const {
    data: payrollReport = [],
    isLoading: isPayrollLoading,
  } = useQuery<PayrollReportEntry[]>({
    queryKey: [`/api/reports/payroll?from_date=${fromDate}&to_date=${toDate}`],
    enabled: activeTab === "payroll",
  });

  // Handle date change
  const handleDateChange = () => {
    if (activeTab === "payroll") {
      // Invalidate payroll report
      useQuery<PayrollReportEntry[]>({
        queryKey: [`/api/reports/payroll?from_date=${fromDate}&to_date=${toDate}`],
      });
    } else if (activeTab === "overtime") {
      // Invalidate overtime report
      useQuery<OvertimeLeader[]>({
        queryKey: [`/api/reports/overtime?from_date=${fromDate}&to_date=${toDate}`],
      });
    }
  };

  // Handle export to CSV
  const handleExportPayroll = () => {
    const downloadUrl = `/api/reports/payroll?from_date=${fromDate}&to_date=${toDate}&format=csv`;
    
    // Create temporary link and trigger download
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.setAttribute('download', `payroll-${fromDate}-to-${toDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({
      title: "Export Started",
      description: "Your payroll report is being downloaded",
    });
  };

  // Prepare summary data for payroll report
  const payrollSummary = (() => {
    if (!payrollReport.length) return null;
    
    const totalRegHours = payrollReport.reduce((sum, entry) => sum + entry.payroll.reg_hours, 0);
    const totalOTHours = payrollReport.reduce((sum, entry) => sum + entry.payroll.ot_hours, 0);
    const totalRegPay = payrollReport.reduce((sum, entry) => sum + (entry.payroll.pay - (entry.payroll.ot_hours * entry.employee.rate * 1.5)), 0);
    const totalOTPay = payrollReport.reduce((sum, entry) => sum + (entry.payroll.ot_hours * entry.employee.rate * 1.5), 0);
    const totalMileage = payrollReport.reduce((sum, entry) => sum + entry.miles, 0);
    const totalMileagePay = payrollReport.reduce((sum, entry) => sum + entry.payroll.mileage_pay, 0);
    const grandTotal = totalRegPay + totalOTPay + totalMileagePay;
    
    // Employee counts
    const uniqueEmployees = new Set(payrollReport.map(entry => entry.employee.id));
    
    // Prepare bar chart data
    const chartData = [
      { name: "Regular Pay", value: totalRegPay },
      { name: "Overtime Pay", value: totalOTPay },
      { name: "Mileage Pay", value: totalMileagePay },
    ];
    
    // Prepare pie chart data
    const pieData = [
      { name: "Regular Hours", value: totalRegHours, color: "#3b82f6" },
      { name: "Overtime Hours", value: totalOTHours, color: "#f59e0b" },
    ];
    
    return {
      totalRegHours,
      totalOTHours,
      totalRegPay,
      totalOTPay,
      totalMileage,
      totalMileagePay,
      grandTotal,
      employeeCount: uniqueEmployees.size,
      chartData,
      pieData,
    };
  })();

  // Prepare summary data for overtime report
  const overtimeSummary = (() => {
    if (!overtimeLeaders.length) return null;
    
    const totalOTHours = overtimeLeaders.reduce((sum, leader) => sum + leader.total_ot_hours, 0);
    const totalOTPay = overtimeLeaders.reduce((sum, leader) => sum + leader.total_ot_pay, 0);
    
    // Prepare chart data
    const chartData = overtimeLeaders.map(leader => ({
      name: `${leader.employee.first_name} ${leader.employee.last_name.charAt(0)}.`,
      hours: leader.total_ot_hours,
      pay: leader.total_ot_pay,
    }));
    
    return {
      totalOTHours,
      totalOTPay,
      employeeCount: overtimeLeaders.length,
      chartData,
    };
  })();

  return (
    <div className="flex h-screen overflow-hidden bg-neutral-50">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-neutral-900">Reports</h2>
            <p className="text-neutral-500">Generate and view payroll and overtime reports</p>
          </div>

          <div className="mb-6 bg-white p-4 rounded-lg border border-neutral-200">
            <div className="flex flex-col md:flex-row items-end gap-4">
              <div className="w-full md:w-auto">
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  From Date
                </label>
                <Input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full"
                />
              </div>
              <div className="w-full md:w-auto">
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  To Date
                </label>
                <Input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full"
                />
              </div>
              <Button onClick={handleDateChange}>
                Update Reports
              </Button>
              {activeTab === "payroll" && (
                <Button variant="outline" onClick={handleExportPayroll}>
                  <Download className="mr-2 h-4 w-4" />
                  Export CSV
                </Button>
              )}
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-6">
              <TabsTrigger value="payroll">Payroll Report</TabsTrigger>
              <TabsTrigger value="overtime">Overtime Report</TabsTrigger>
            </TabsList>
            
            {/* Payroll Report Tab */}
            <TabsContent value="payroll">
              {isPayrollLoading ? (
                <div className="flex justify-center items-center h-64">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : payrollReport.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <FileSpreadsheet className="h-12 w-12 text-neutral-400 mb-4" />
                    <h3 className="text-lg font-medium text-neutral-900">No payroll data available</h3>
                    <p className="text-sm text-neutral-500 mt-1">
                      Try selecting a different date range or adding timesheet entries
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-sm text-neutral-500">Total Pay</p>
                            <h3 className="text-2xl font-semibold mt-1">
                              {formatCurrency(payrollSummary?.grandTotal || 0)}
                            </h3>
                          </div>
                          <div className="bg-primary-100 p-2 rounded-full">
                            <DollarSign className="h-5 w-5 text-primary" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-sm text-neutral-500">Total Hours</p>
                            <h3 className="text-2xl font-semibold mt-1">
                              {((payrollSummary?.totalRegHours || 0) + (payrollSummary?.totalOTHours || 0)).toFixed(1)}
                            </h3>
                          </div>
                          <div className="bg-amber-100 p-2 rounded-full">
                            <Clock className="h-5 w-5 text-amber-600" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-sm text-neutral-500">Total Mileage</p>
                            <h3 className="text-2xl font-semibold mt-1">
                              {(payrollSummary?.totalMileage || 0).toFixed(0)}
                            </h3>
                          </div>
                          <div className="bg-indigo-100 p-2 rounded-full">
                            <Route className="h-5 w-5 text-indigo-600" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-sm text-neutral-500">Date Range</p>
                            <h3 className="text-lg font-medium mt-1">
                              {formatDisplayDate(fromDate)} - {formatDisplayDate(toDate)}
                            </h3>
                          </div>
                          <div className="bg-green-100 p-2 rounded-full">
                            <CalendarRange className="h-5 w-5 text-green-600" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                    <Card className="lg:col-span-2">
                      <CardHeader>
                        <CardTitle>Pay Distribution</CardTitle>
                        <CardDescription>
                          Breakdown of regular pay, overtime pay, and mileage reimbursement
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="h-80">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              data={payrollSummary?.chartData}
                              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="name" />
                              <YAxis 
                                tickFormatter={(value) => new Intl.NumberFormat('en-US', {
                                  style: 'currency',
                                  currency: 'USD',
                                  minimumFractionDigits: 0,
                                  maximumFractionDigits: 0,
                                }).format(value)}
                              />
                              <Tooltip 
                                formatter={(value) => [formatCurrency(value as number), ""]}
                              />
                              <Bar 
                                dataKey="value" 
                                fill="hsl(var(--primary))" 
                                name="Amount" 
                              />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardHeader>
                        <CardTitle>Hours Breakdown</CardTitle>
                        <CardDescription>
                          Regular vs. overtime hours
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="h-72 flex items-center justify-center">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={payrollSummary?.pieData}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                                outerRadius={80}
                                fill="#8884d8"
                                dataKey="value"
                              >
                                {payrollSummary?.pieData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                              </Pie>
                              <Tooltip 
                                formatter={(value) => [`${value} hours`, ""]}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                      <CardFooter className="flex flex-col items-start">
                        <div className="w-full flex justify-between mb-2">
                          <div className="flex items-center">
                            <div className="w-3 h-3 bg-primary mr-2 rounded-sm"></div>
                            <span className="text-sm">Regular: {payrollSummary?.totalRegHours.toFixed(1)} hrs</span>
                          </div>
                          <span className="text-sm font-medium">
                            {formatCurrency(payrollSummary?.totalRegPay || 0)}
                          </span>
                        </div>
                        <div className="w-full flex justify-between">
                          <div className="flex items-center">
                            <div className="w-3 h-3 bg-amber-500 mr-2 rounded-sm"></div>
                            <span className="text-sm">Overtime: {payrollSummary?.totalOTHours.toFixed(1)} hrs</span>
                          </div>
                          <span className="text-sm font-medium">
                            {formatCurrency(payrollSummary?.totalOTPay || 0)}
                          </span>
                        </div>
                      </CardFooter>
                    </Card>
                  </div>
                  
                  <Card>
                    <CardHeader>
                      <CardTitle>Payroll Details</CardTitle>
                      <CardDescription>
                        Detailed breakdown of all pay entries for the selected period
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Date</TableHead>
                              <TableHead>Employee</TableHead>
                              <TableHead>Reg Hours</TableHead>
                              <TableHead>OT Hours</TableHead>
                              <TableHead>PTO Hours</TableHead>
                              <TableHead>Holiday Worked</TableHead>
                              <TableHead>Holiday Non-Worked</TableHead>
                              <TableHead>Misc Reimb</TableHead>
                              <TableHead>Reg Pay</TableHead>
                              <TableHead>OT Pay</TableHead>
                              <TableHead>Miles</TableHead>
                              <TableHead>Mileage Pay</TableHead>
                              <TableHead>Total Pay</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {payrollReport.map((entry) => {
                              const regPay = entry.payroll.pay - (entry.payroll.ot_hours * entry.employee.rate * 1.5);
                              const otPay = entry.payroll.ot_hours * entry.employee.rate * 1.5;
                              const totalPay = entry.payroll.total_pay;
                              
                              return (
                                <TableRow key={entry.id}>
                                  <TableCell>{formatDisplayDate(entry.date)}</TableCell>
                                  <TableCell>
                                    {entry.employee.first_name} {entry.employee.last_name}
                                  </TableCell>
                                  <TableCell>{entry.payroll.reg_hours.toFixed(1)}</TableCell>
                                  <TableCell>{entry.payroll.ot_hours.toFixed(1)}</TableCell>
                                  <TableCell>{(entry.payroll.pto_hours || 0).toFixed(1)}</TableCell>
                                  <TableCell>{(entry.payroll.holiday_worked_hours || 0).toFixed(1)}</TableCell>
                                  <TableCell>{(entry.payroll.holiday_non_worked_hours || 0).toFixed(1)}</TableCell>
                                  <TableCell>{entry.payroll.misc_reimbursement ? formatCurrency(entry.payroll.misc_reimbursement) : "$0.00"}</TableCell>
                                  <TableCell>{formatCurrency(regPay)}</TableCell>
                                  <TableCell>{formatCurrency(otPay)}</TableCell>
                                  <TableCell>{entry.miles.toFixed(1)}</TableCell>
                                  <TableCell>{formatCurrency(entry.payroll.mileage_pay)}</TableCell>
                                  <TableCell className="font-medium">
                                    {formatCurrency(totalPay)}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
            </TabsContent>
            
            {/* Overtime Report Tab */}
            <TabsContent value="overtime">
              {isOvertimeLoading ? (
                <div className="flex justify-center items-center h-64">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : overtimeLeaders.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Clock className="h-12 w-12 text-neutral-400 mb-4" />
                    <h3 className="text-lg font-medium text-neutral-900">No overtime data available</h3>
                    <p className="text-sm text-neutral-500 mt-1">
                      Try selecting a different date range or adding overtime entries
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-sm text-neutral-500">Total OT Hours</p>
                            <h3 className="text-2xl font-semibold mt-1">
                              {overtimeSummary?.totalOTHours.toFixed(1)}
                            </h3>
                          </div>
                          <div className="bg-amber-100 p-2 rounded-full">
                            <Clock className="h-5 w-5 text-amber-600" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-sm text-neutral-500">Total OT Pay</p>
                            <h3 className="text-2xl font-semibold mt-1">
                              {formatCurrency(overtimeSummary?.totalOTPay || 0)}
                            </h3>
                          </div>
                          <div className="bg-primary-100 p-2 rounded-full">
                            <DollarSign className="h-5 w-5 text-primary" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-sm text-neutral-500">Date Range</p>
                            <h3 className="text-lg font-medium mt-1">
                              {formatDisplayDate(fromDate)} - {formatDisplayDate(toDate)}
                            </h3>
                          </div>
                          <div className="bg-green-100 p-2 rounded-full">
                            <CalendarRange className="h-5 w-5 text-green-600" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-6 mb-6">
                    <Card>
                      <CardHeader>
                        <CardTitle>Overtime by Employee</CardTitle>
                        <CardDescription>
                          Hours and cost breakdown by employee
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="h-80">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              data={overtimeSummary?.chartData}
                              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="name" />
                              <YAxis yAxisId="left" orientation="left" label={{ value: 'Hours', angle: -90, position: 'insideLeft' }} />
                              <YAxis 
                                yAxisId="right" 
                                orientation="right" 
                                tickFormatter={(value) => new Intl.NumberFormat('en-US', {
                                  style: 'currency',
                                  currency: 'USD',
                                  minimumFractionDigits: 0,
                                  maximumFractionDigits: 0,
                                }).format(value)}
                              />
                              <Tooltip 
                                formatter={(value, name) => [
                                  name === 'hours' ? `${value} hours` : formatCurrency(value as number),
                                  name === 'hours' ? 'Hours' : 'Pay'
                                ]}
                              />
                              <Legend />
                              <Bar 
                                yAxisId="left"
                                dataKey="hours" 
                                fill="#f59e0b" 
                                name="Hours" 
                              />
                              <Bar 
                                yAxisId="right"
                                dataKey="pay" 
                                fill="#3b82f6" 
                                name="Pay" 
                              />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                  
                  <Card>
                    <CardHeader>
                      <CardTitle>Overtime Leaders</CardTitle>
                      <CardDescription>
                        Detailed breakdown of overtime by employee
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Employee</TableHead>
                              <TableHead>Hourly Rate</TableHead>
                              <TableHead>OT Hours</TableHead>
                              <TableHead>OT Pay</TableHead>
                              <TableHead>Avg. OT Hours</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {overtimeLeaders.map((leader) => {
                              // Assuming a 2-week pay period for avg calc
                              const avgOTPerWeek = leader.total_ot_hours / 4; // 4 weeks in the period
                              
                              return (
                                <TableRow key={leader.employee.id}>
                                  <TableCell className="font-medium">
                                    {leader.employee.first_name} {leader.employee.last_name}
                                  </TableCell>
                                  <TableCell>{formatCurrency(leader.employee.rate)}/hr</TableCell>
                                  <TableCell>{leader.total_ot_hours.toFixed(1)}</TableCell>
                                  <TableCell>{formatCurrency(leader.total_ot_pay)}</TableCell>
                                  <TableCell>{avgOTPerWeek.toFixed(1)}/week</TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
}
