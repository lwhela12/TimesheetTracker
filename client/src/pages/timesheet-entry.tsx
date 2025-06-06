import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import Sidebar from "@/components/layout/sidebar";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatDate } from "@/lib/utils";
import TimeEntryForm from "@/components/forms/time-entry-form";
import WeeklyTimeEntryForm from "@/components/forms/weekly-time-entry-form";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import {
  PlusCircle,
  Search,
  Pencil,
  Trash2,
  Filter,
  Loader2,
  Calendar,
  CalendarRange,
} from "lucide-react";

type Employee = {
  id: number;
  first_name: string;
  last_name: string;
  rate: number;
  active: boolean;
  created_at?: Date | string | null;
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
  pto_hours?: number;
  holiday_worked_hours?: number;
  holiday_non_worked_hours?: number;
  misc_reimbursement?: number;
  misc_hours?: number;
  misc_hours_type?: string;
  notes?: string;
  status: string;
  payroll?: {
    reg_hours: number;
    ot_hours: number;
    pto_hours?: number;
    holiday_worked_hours?: number;
    holiday_non_worked_hours?: number;
    reg_pay: number;
    ot_pay: number;
    pto_pay?: number;
    holiday_worked_pay?: number;
    holiday_non_worked_pay?: number;
    misc_hours_pay?: number;
    pay: number;
    mileage_pay: number;
    misc_reimbursement?: number;
    total_pay: number;
  };
};

export default function TimesheetEntry() {
  const { toast } = useToast();
  const [timeEntryModalOpen, setTimeEntryModalOpen] = useState(false);
  const [weeklyTimeEntryModalOpen, setWeeklyTimeEntryModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [employeeFilter, setEmployeeFilter] = useState<number | null>(null);
  const [dateFilter, setDateFilter] = useState<string>(
    formatDate(new Date())
  );
  const [page, setPage] = useState(1);
  const [selectedEntry, setSelectedEntry] = useState<TimesheetEntry | null>(
    null
  );
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<number | null>(null);
  const [timeEntryIsEditMode, setTimeEntryIsEditMode] = useState(false);

  // Fetch timesheet entries
  const {
    data: timesheetEntries = [],
    isLoading,
    refetch,
  } = useQuery<TimesheetEntry[]>({
    queryKey: [
      `/api/punches?page=${page}&limit=10&searchQuery=${encodeURIComponent(searchQuery)}`,
    ],
  });

  // Fetch employees for dropdown
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
      queryClient.invalidateQueries({ queryKey: ["/api/punches"] });
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
  
  // Create batch time entries mutation (for weekly entry)
  const createWeeklyTimeEntriesMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/punches/batch", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/punches"] });
      toast({
        title: "Success",
        description: "Weekly timesheet entries added successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to add weekly timesheet entries: ${error.message}`,
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
      queryClient.invalidateQueries({ queryKey: ["/api/punches"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/punches"] });
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

  // Format time from 24h to 12h format
  const formatTime = (time: string) => {
    if (!time) return "";
    const [hours, minutes] = time.split(":");
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? "PM" : "AM";
    const formattedHour = hour % 12 || 12;
    return `${formattedHour}:${minutes} ${ampm}`;
  };

  // Format date from ISO to MM/DD/YYYY
  const formatDisplayDate = (dateString: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
  };

  // Get initials for avatar
  const getInitials = (firstName: string, lastName: string) => {
    return (firstName.charAt(0) + lastName.charAt(0)).toUpperCase();
  };

  // Get avatar color based on name
  const getAvatarColor = (name: string) => {
    const colors = [
      "bg-primary-100 text-primary-700",
      "bg-amber-100 text-amber-700",
      "bg-green-100 text-green-700",
      "bg-indigo-100 text-indigo-700",
      "bg-red-100 text-red-700",
    ];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  // Get badge color based on status
  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "approved":
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Approved</Badge>;
      case "pending":
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Pending</Badge>;
      case "rejected":
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Handle adding a new time entry
  const handleAddTimeEntry = () => {
    setTimeEntryIsEditMode(false);
    setSelectedEntry(null);
    setTimeEntryModalOpen(true);
  };
  
  // Handle adding a weekly timesheet
  const handleAddWeeklyTimesheet = () => {
    setWeeklyTimeEntryModalOpen(true);
  };
  
  // Handle weekly timesheet submission
  const handleWeeklyTimeEntrySubmit = (entries: Array<{
    employee_id: number;
    date: string;
    time_in: string;
    time_out: string;
    lunch_minutes: number;
    miles: number;
    pto_hours?: number;
    holiday_worked_hours?: number;
    holiday_non_worked_hours?: number;
    misc_reimbursement?: number;
    misc_hours?: number;
    misc_hours_type?: string;
    notes?: string;
    status: string;
  }>) => {
    
    // Submit the batch of entries
    createWeeklyTimeEntriesMutation.mutate({ entries });
  };

  // Handle editing a time entry
  const handleEditTimeEntry = (entry: TimesheetEntry) => {
    setSelectedEntry(entry);
    setTimeEntryIsEditMode(true);
    setTimeEntryModalOpen(true);
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

  // Handle filtering
  const handleDateFilterChange = (date: string) => {
    setDateFilter(date);
    refetch();
  };

  // Filter timesheet entries
  const filteredEntries = timesheetEntries.filter((entry) => {
    const fullName = `${entry.employee.first_name} ${entry.employee.last_name}`.toLowerCase();
    const searchMatches = searchQuery
      ? fullName.includes(searchQuery.toLowerCase())
      : true;
    const statusMatches = statusFilter
      ? entry.status.toLowerCase() === statusFilter.toLowerCase()
      : true;
    const employeeMatches = employeeFilter
      ? entry.employee.id === employeeFilter
      : true;
    const dateMatches = dateFilter
      ? entry.date === dateFilter
      : true;

    return searchMatches && statusMatches && employeeMatches && dateMatches;
  });

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-neutral-50">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto p-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
            <div>
              <h2 className="text-2xl font-semibold text-neutral-900">Timesheet Entry</h2>
              <p className="text-neutral-500">Manage and track employee time punches</p>
            </div>
            <div className="flex gap-2 mt-4 md:mt-0">
              <Button 
                onClick={handleAddWeeklyTimesheet}
              >
                <CalendarRange className="mr-2 h-4 w-4" />
                New Weekly Timesheet
              </Button>
            </div>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Timesheet Entries</CardTitle>
              <CardDescription>
                View, filter, and manage all timesheet entries
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-6 flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-neutral-500" />
                  <Input
                    placeholder="Search by employee name..."
                    className="pl-8"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <div className="w-full sm:w-auto">
                    <Select 
                      onValueChange={(value) => setStatusFilter(value === "all" ? null : value)}
                    >
                      <SelectTrigger className="w-full sm:w-[140px]">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="approved">Approved</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-full sm:w-auto">
                    <Select 
                      onValueChange={(value) => setEmployeeFilter(value === "all" ? null : Number(value))}
                    >
                      <SelectTrigger className="w-full sm:w-[200px]">
                        <SelectValue placeholder="Employee" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Employees</SelectItem>
                        {employees.map((employee) => (
                          <SelectItem key={employee.id} value={employee.id.toString()}>
                            {employee.first_name} {employee.last_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-full sm:w-auto flex items-center space-x-2">
                    <Calendar className="h-4 w-4 text-neutral-500" />
                    <Input
                      type="date"
                      value={dateFilter}
                      onChange={(e) => handleDateFilterChange(e.target.value)}
                      className="w-full sm:w-auto"
                    />
                  </div>
                </div>
              </div>

              {isLoading ? (
                <div className="flex justify-center items-center h-64">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : filteredEntries.length === 0 ? (
                <div className="text-center py-12 border rounded-md bg-neutral-50">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100">
                    <Calendar className="h-6 w-6 text-neutral-500" />
                  </div>
                  <h3 className="mt-4 text-lg font-medium text-neutral-900">No timesheet entries found</h3>
                  <p className="mt-2 text-sm text-neutral-500">
                    Try adjusting your filters or add a new entry
                  </p>
                  <Button onClick={handleAddTimeEntry} className="mt-4">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Add New Entry
                  </Button>
                </div>
              ) : (
                  <div>
                    <div className="overflow-x-auto rounded-md border">
                      <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Time In</TableHead>
                        <TableHead>Time Out</TableHead>
                        <TableHead>Reg Hours</TableHead>
                        <TableHead>OT Hours</TableHead>
                        <TableHead>PTO</TableHead>
                        <TableHead>Holiday</TableHead>
                        <TableHead>Misc Hours</TableHead>
                        <TableHead>Miles</TableHead>
                        <TableHead>Pay</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredEntries.map((entry) => {
                        const fullName = `${entry.employee.first_name} ${entry.employee.last_name}`;
                        const avatarColor = getAvatarColor(fullName);
                        return (
                          <TableRow key={entry.id} className="hover:bg-neutral-50">
                            <TableCell>
                              <div className="flex items-center">
                                <Avatar className="h-8 w-8 mr-3">
                                  <AvatarFallback className={avatarColor}>
                                    {getInitials(entry.employee.first_name, entry.employee.last_name)}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-sm font-medium">{fullName}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm">
                              {formatDisplayDate(entry.date)}
                            </TableCell>
                            <TableCell className="text-sm">
                              {formatTime(entry.time_in)}
                            </TableCell>
                            <TableCell className="text-sm">
                              {formatTime(entry.time_out)}
                            </TableCell>
                            <TableCell className="text-sm">
                              {entry.payroll ? entry.payroll.reg_hours.toFixed(1) : "N/A"}
                            </TableCell>
                            <TableCell className="text-sm">
                              {entry.payroll ? entry.payroll.ot_hours.toFixed(1) : "N/A"}
                            </TableCell>
                            <TableCell className="text-sm">
                              {entry.pto_hours ? entry.pto_hours.toFixed(1) : "0.0"}
                            </TableCell>
                            <TableCell className="text-sm">
                              {(entry.holiday_worked_hours || entry.holiday_non_worked_hours) 
                                ? ((entry.holiday_worked_hours || 0) + (entry.holiday_non_worked_hours || 0)).toFixed(1) 
                                : "0.0"}
                            </TableCell>
                            <TableCell className="text-sm">
                              {entry.misc_hours ? entry.misc_hours.toFixed(1) : "0.0"}
                            </TableCell>
                            <TableCell className="text-sm">{entry.miles}</TableCell>
                            <TableCell className="text-sm">
                              {entry.payroll 
                                ? formatCurrency(entry.payroll.total_pay) 
                                : "N/A"}
                            </TableCell>
                            <TableCell>{getStatusBadge(entry.status)}</TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-neutral-500 hover:text-neutral-700"
                                onClick={() => handleEditTimeEntry(entry)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-neutral-500 hover:text-red-600"
                                onClick={() => handleDeleteTimeEntry(entry.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                      </Table>
                    </div>
                    <div className="flex justify-between items-center mt-4">
                      <Button variant="outline" onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}>Previous</Button>
                      <span className="text-sm text-neutral-600">Page {page}</span>
                      <Button variant="outline" onClick={() => setPage(page + 1)} disabled={timesheetEntries.length < 10}>Next</Button>
                    </div>
                  </div>
                )}
            </CardContent>
          </Card>
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
          pto_hours: selectedEntry.pto_hours || 0,
          holiday_worked_hours: selectedEntry.holiday_worked_hours || 0,
          holiday_non_worked_hours: selectedEntry.holiday_non_worked_hours || 0,
          misc_reimbursement: selectedEntry.misc_reimbursement || 0,
          misc_hours: selectedEntry.misc_hours || 0,
          misc_hours_type: selectedEntry.misc_hours_type || "",
          notes: selectedEntry.notes || "",
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

      {/* Weekly time entry form */}
      <WeeklyTimeEntryForm
        open={weeklyTimeEntryModalOpen}
        onOpenChange={setWeeklyTimeEntryModalOpen}
        onSubmit={handleWeeklyTimeEntrySubmit}
        employees={employees}
      />
    </div>
  );
}
