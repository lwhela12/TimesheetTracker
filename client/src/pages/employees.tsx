import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import Sidebar from "@/components/layout/sidebar";
import EmployeeForm from "@/components/forms/employee-form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
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
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
  Loader2,
  Users,
} from "lucide-react";

type Employee = {
  id: number;
  first_name: string;
  last_name: string;
  rate: number;
  active: boolean;
  created_at: string;
};

export default function Employees() {
  const { toast } = useToast();
  const [employeeFormOpen, setEmployeeFormOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(
    null
  );
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState<number | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);

  // Fetch employees
  const {
    data: employees = [],
    isLoading,
    isError,
  } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
  });

  // Create employee mutation
  const createEmployeeMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/employees", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      toast({
        title: "Success",
        description: "Employee added successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to add employee: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Update employee mutation
  const updateEmployeeMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest("PUT", `/api/employees/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      toast({
        title: "Success",
        description: "Employee updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to update employee: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Delete employee mutation
  const deleteEmployeeMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/employees/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      toast({
        title: "Success",
        description: "Employee deleted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to delete employee: ${error.message}`,
        variant: "destructive",
      });
    },
  });

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

  // Handle adding a new employee
  const handleAddEmployee = () => {
    setIsEditMode(false);
    setSelectedEmployee(null);
    setEmployeeFormOpen(true);
  };

  // Handle editing an employee
  const handleEditEmployee = (employee: Employee) => {
    setSelectedEmployee(employee);
    setIsEditMode(true);
    setEmployeeFormOpen(true);
  };

  // Handle confirming deletion of an employee
  const handleDeleteEmployee = (id: number) => {
    setEmployeeToDelete(id);
    setDeleteConfirmOpen(true);
  };

  // Handle employee form submission
  const handleEmployeeSubmit = (data: any) => {
    if (isEditMode && selectedEmployee) {
      updateEmployeeMutation.mutate({ id: selectedEmployee.id, data });
    } else {
      createEmployeeMutation.mutate(data);
    }
  };

  // Filter employees
  const filteredEmployees = employees.filter((employee) => {
    const fullName = `${employee.first_name} ${employee.last_name}`.toLowerCase();
    const searchMatches = searchQuery
      ? fullName.includes(searchQuery.toLowerCase())
      : true;
    const statusMatches = showInactive ? true : employee.active;

    return searchMatches && statusMatches;
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
              <h2 className="text-2xl font-semibold text-neutral-900">Employees</h2>
              <p className="text-neutral-500">Manage employee information and hourly rates</p>
            </div>
            <Button 
              onClick={handleAddEmployee}
              className="mt-4 md:mt-0"
            >
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Employee
            </Button>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Employee Directory</CardTitle>
              <CardDescription>
                View and manage all employees in the system
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-6 flex flex-col sm:flex-row justify-between gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-neutral-500" />
                  <Input
                    placeholder="Search by name..."
                    className="pl-8"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="show-inactive"
                    checked={showInactive}
                    onCheckedChange={setShowInactive}
                  />
                  <label
                    htmlFor="show-inactive"
                    className="text-sm text-neutral-700 cursor-pointer"
                  >
                    Show inactive employees
                  </label>
                </div>
              </div>

              {isLoading ? (
                <div className="flex justify-center items-center h-64">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : isError ? (
                <div className="text-center py-12 border rounded-md bg-neutral-50">
                  <p className="text-neutral-500">Failed to load employee data. Please try again later.</p>
                </div>
              ) : filteredEmployees.length === 0 ? (
                <div className="text-center py-12 border rounded-md bg-neutral-50">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100">
                    <Users className="h-6 w-6 text-neutral-500" />
                  </div>
                  <h3 className="mt-4 text-lg font-medium text-neutral-900">No employees found</h3>
                  <p className="mt-2 text-sm text-neutral-500">
                    {searchQuery ? "Try adjusting your search" : "Add your first employee to get started"}
                  </p>
                  <Button onClick={handleAddEmployee} className="mt-4">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Add Employee
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Hourly Rate</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredEmployees.map((employee) => {
                        const fullName = `${employee.first_name} ${employee.last_name}`;
                        const avatarColor = getAvatarColor(fullName);
                        return (
                          <TableRow key={employee.id} className="hover:bg-neutral-50">
                            <TableCell>
                              <div className="flex items-center">
                                <Avatar className="h-8 w-8 mr-3">
                                  <AvatarFallback className={avatarColor}>
                                    {getInitials(employee.first_name, employee.last_name)}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <div className="font-medium">{fullName}</div>
                                  <div className="text-sm text-neutral-500">ID: {employee.id}</div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>{formatCurrency(employee.rate)}/hr</TableCell>
                            <TableCell>
                              {employee.active ? (
                                <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Active</Badge>
                              ) : (
                                <Badge variant="outline" className="text-neutral-500">Inactive</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-neutral-500 hover:text-neutral-700"
                                onClick={() => handleEditEmployee(employee)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-neutral-500 hover:text-red-600"
                                onClick={() => handleDeleteEmployee(employee.id)}
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
              )}
            </CardContent>
          </Card>
        </main>
      </div>

      {/* Employee Form */}
      <EmployeeForm
        open={employeeFormOpen}
        onOpenChange={setEmployeeFormOpen}
        onSubmit={handleEmployeeSubmit}
        initialData={selectedEmployee || undefined}
        isEditMode={isEditMode}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will set the employee as inactive. They will no longer appear in active employee lists.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (employeeToDelete !== null) {
                  deleteEmployeeMutation.mutate(employeeToDelete);
                  setEmployeeToDelete(null);
                }
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
