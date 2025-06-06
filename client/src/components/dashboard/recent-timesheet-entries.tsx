import React, { memo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pencil,
  Trash2,
  PlusCircle,
} from "lucide-react";
import { 
  Pagination, 
  PaginationContent, 
  PaginationItem, 
  PaginationLink, 
  PaginationNext, 
  PaginationPrevious 
} from "@/components/ui/pagination";
import { Badge } from "@/components/ui/badge";

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

type RecentTimesheetEntriesProps = {
  entries: TimesheetEntry[];
  totalEntries: number;
  onAddEntry: () => void;
  onEditEntry: (id: number) => void;
  onDeleteEntry: (id: number) => void;
  onPageChange: (page: number) => void;
  currentPage: number;
  entriesPerPage: number;
};

function RecentTimesheetEntries({
  entries,
  totalEntries,
  onAddEntry,
  onEditEntry,
  onDeleteEntry,
  onPageChange,
  currentPage,
  entriesPerPage,
}: RecentTimesheetEntriesProps) {
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
  const formatDate = (dateString: string) => {
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

  const totalPages = Math.ceil(totalEntries / entriesPerPage);

  return (
    <Card className="border border-neutral-100 shadow-sm">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-semibold text-neutral-800">Recent Timesheet Entries</h3>
          <Button 
            onClick={onAddEntry}
            className="text-sm"
            size="sm"
          >
            <PlusCircle className="mr-1 h-4 w-4" />
            Add New Entry
          </Button>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Time In</TableHead>
                <TableHead>Time Out</TableHead>
                <TableHead>Reg. Hours</TableHead>
                <TableHead>OT Hours</TableHead>
                <TableHead>Miles</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-6 text-muted-foreground">
                    No timesheet entries found
                  </TableCell>
                </TableRow>
              ) : (
                entries.map((entry) => {
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
                      <TableCell className="text-sm">{formatDate(entry.date)}</TableCell>
                      <TableCell className="text-sm">{formatTime(entry.time_in)}</TableCell>
                      <TableCell className="text-sm">{formatTime(entry.time_out)}</TableCell>
                      <TableCell className="text-sm">
                        {entry.payroll && entry.payroll.reg_hours !== null && entry.payroll.reg_hours !== undefined
                          ? entry.payroll.reg_hours.toFixed(1)
                          : "N/A"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {entry.payroll && entry.payroll.ot_hours !== null && entry.payroll.ot_hours !== undefined
                          ? entry.payroll.ot_hours.toFixed(1)
                          : "N/A"}
                      </TableCell>
                      <TableCell className="text-sm">{entry.miles}</TableCell>
                      <TableCell>{getStatusBadge(entry.status)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-neutral-500 hover:text-neutral-700"
                          onClick={() => onEditEntry(entry.id)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-neutral-500 hover:text-red-600"
                          onClick={() => onDeleteEntry(entry.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {totalEntries > 0 && (
          <div className="flex items-center justify-between mt-6">
            <div className="text-sm text-neutral-500">
              Showing {Math.min(entries.length, entriesPerPage)} of {totalEntries} entries
            </div>
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious 
                    onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                    className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
                  />
                </PaginationItem>
                
                {Array.from({ length: Math.min(totalPages, 3) }, (_, i) => {
                  const page = currentPage <= 2 ? i + 1 : currentPage - 1 + i;
                  if (page > totalPages) return null;
                  return (
                    <PaginationItem key={page}>
                      <PaginationLink
                        onClick={() => onPageChange(page)}
                        isActive={page === currentPage}
                      >
                        {page}
                      </PaginationLink>
                    </PaginationItem>
                  );
                })}
                
                <PaginationItem>
                  <PaginationNext 
                    onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                    className={currentPage === totalPages ? "pointer-events-none opacity-50" : ""}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default memo(RecentTimesheetEntries);
