import React, { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { addDays, format, startOfWeek, getDay } from "date-fns";
import { calculateHoursWorked } from "@/lib/utils";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Employee } from "@shared/schema";
import { formatDate } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Define days of the week
const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const SHORT_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Create a schema for the weekly time entry form
const weeklyTimeEntryFormSchema = z.object({
  employee_id: z.coerce.number().min(1, "Please select an employee"),
  week_start_date: z.string().min(1, "Week start date is required"),
  total_miles: z.coerce.number().min(0, "Must be 0 or more").default(0),
  notes: z.string().optional(),
  total_pto_hours: z.coerce.number().min(0, "Must be 0 or more").default(0),
  total_holiday_worked_hours: z.coerce.number().min(0, "Must be 0 or more").default(0),
  total_holiday_non_worked_hours: z.coerce.number().min(0, "Must be 0 or more").default(0),
  total_misc_reimbursement: z.coerce.number().min(0, "Must be 0 or more").default(0),
  total_misc_hours: z.coerce.number().min(0, "Must be 0 or more").default(0),
  misc_hours_type: z.string().optional(),
  
  // Day-specific fields (schema will be repeated for each day)
  monday: z.object({
    worked: z.boolean().default(true),
    time_in: z.string().optional(),
    time_out: z.string().optional(),
    lunch_minutes: z.coerce.number().min(0, "Must be 0 or more").default(30),
  }),
  tuesday: z.object({
    worked: z.boolean().default(true),
    time_in: z.string().optional(),
    time_out: z.string().optional(),
    lunch_minutes: z.coerce.number().min(0, "Must be 0 or more").default(30),
  }),
  wednesday: z.object({
    worked: z.boolean().default(true),
    time_in: z.string().optional(),
    time_out: z.string().optional(),
    lunch_minutes: z.coerce.number().min(0, "Must be 0 or more").default(30),
  }),
  thursday: z.object({
    worked: z.boolean().default(true),
    time_in: z.string().optional(),
    time_out: z.string().optional(),
    lunch_minutes: z.coerce.number().min(0, "Must be 0 or more").default(30),
  }),
  friday: z.object({
    worked: z.boolean().default(true),
    time_in: z.string().optional(),
    time_out: z.string().optional(),
    lunch_minutes: z.coerce.number().min(0, "Must be 0 or more").default(30),
  }),
  saturday: z.object({
    worked: z.boolean().default(false),
    time_in: z.string().optional(),
    time_out: z.string().optional(),
    lunch_minutes: z.coerce.number().min(0, "Must be 0 or more").default(30),
  }),
  sunday: z.object({
    worked: z.boolean().default(false),
    time_in: z.string().optional(),
    time_out: z.string().optional(),
    lunch_minutes: z.coerce.number().min(0, "Must be 0 or more").default(30),
  }),
}).refine(
  (data) => {
    // For each day where worked is true, validate that time_in and time_out are provided
    const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
    for (const day of days) {
      const dayData = data[day as keyof typeof data] as { worked: boolean; time_in?: string; time_out?: string };
      if (dayData.worked && (!dayData.time_in || !dayData.time_out)) {
        return false;
      }
    }
    return true;
  },
  {
    message: "Time in and time out are required for days marked as worked",
    path: ["root"],
  }
);

type WeeklyTimeEntryFormValues = z.infer<typeof weeklyTimeEntryFormSchema>;

type TimeEntryOutput = {
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
};

type WeeklyTimeEntryFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (entries: TimeEntryOutput[]) => void;
  employees: {
    id: number;
    first_name: string;
    last_name: string;
    rate: number;
    active: boolean;
    created_at?: Date | string | null;
  }[];
};

export default function WeeklyTimeEntryForm({
  open,
  onOpenChange,
  onSubmit,
  employees,
}: WeeklyTimeEntryFormProps) {
  // Get the Monday of the current week as the default start date
  const getDefaultWeekStartDate = () => {
    const today = new Date();
    const dayOfWeek = getDay(today);
    const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Adjust for Monday start
    const monday = startOfWeek(today, { weekStartsOn: 1 });
    return formatDate(monday);
  };

  // Create form with default values
  const form = useForm<WeeklyTimeEntryFormValues>({
    resolver: zodResolver(weeklyTimeEntryFormSchema),
    defaultValues: {
      employee_id: 0,
      week_start_date: getDefaultWeekStartDate(),
      total_miles: 0,
      notes: "",
      total_pto_hours: 0,
      total_holiday_worked_hours: 0,
      total_holiday_non_worked_hours: 0,
      total_misc_reimbursement: 0,
      total_misc_hours: 0,
      misc_hours_type: "",
      monday: {
        worked: true,
        time_in: "08:00", 
        time_out: "17:00",
        lunch_minutes: 30,
      },
      tuesday: {
        worked: true,
        time_in: "08:00", 
        time_out: "17:00",
        lunch_minutes: 30,
      },
      wednesday: {
        worked: true,
        time_in: "08:00", 
        time_out: "17:00",
        lunch_minutes: 30,
      },
      thursday: {
        worked: true,
        time_in: "08:00", 
        time_out: "17:00",
        lunch_minutes: 30,
      },
      friday: {
        worked: true,
        time_in: "08:00", 
        time_out: "17:00",
        lunch_minutes: 30,
      },
      saturday: {
        worked: false,
        time_in: "08:00", 
        time_out: "17:00",
        lunch_minutes: 30,
      },
      sunday: {
        worked: false,
        time_in: "08:00", 
        time_out: "17:00",
        lunch_minutes: 30,
      },
    },
  });

  const handleSubmit = (values: WeeklyTimeEntryFormValues) => {
    // Create entries from the form data
    const entries: TimeEntryOutput[] = createTimeEntries(values);
    
    // Call the onSubmit prop with all the entries
    onSubmit(entries);
    onOpenChange(false);
  };
  
  // Helper function to create time entries from form values
  const createTimeEntries = (values: WeeklyTimeEntryFormValues): TimeEntryOutput[] => {
    const weekStartDate = new Date(values.week_start_date);
    const entries: TimeEntryOutput[] = [];
    
    // Loop through each day of the week
    for (let i = 0; i < 7; i++) {
      const dayKey = DAYS_OF_WEEK[i].toLowerCase() as keyof WeeklyTimeEntryFormValues;
      const dayInfo = values[dayKey] as any;
      
      // Only create entries for days marked as worked
      if (dayInfo.worked) {
        // Calculate the date for this day (weekStartDate + i days)
        const entryDate = addDays(weekStartDate, i);
        
        // Create the entry object
        const isMonday = i === 0;
        const entry = {
          employee_id: values.employee_id,
          date: formatDate(entryDate),
          time_in: dayInfo.time_in,
          time_out: dayInfo.time_out,
          lunch_minutes: dayInfo.lunch_minutes,
          miles: isMonday ? values.total_miles : 0, // Assign all miles to Monday
          
          // Only add special hours and reimbursements to Monday for simplicity
          // These can be distributed differently if needed in the future
          pto_hours: isMonday ? values.total_pto_hours : 0,
          holiday_worked_hours: isMonday ? values.total_holiday_worked_hours : 0,
          holiday_non_worked_hours: isMonday ? values.total_holiday_non_worked_hours : 0,
          misc_reimbursement: isMonday ? values.total_misc_reimbursement : 0,
          misc_hours: isMonday ? values.total_misc_hours : 0,
          misc_hours_type: isMonday ? values.misc_hours_type : "",
          
          notes: values.notes,
          status: "pending"
        };
        
        entries.push(entry);
      }
    }
    
    return entries;
  };

  // Get the real date for a specific day of the week
  const getDateForDay = (weekStartDate: string, dayIndex: number) => {
    try {
      const startDate = new Date(weekStartDate);
      const dayDate = addDays(startDate, dayIndex);
      return format(dayDate, "yyyy-MM-dd");
    } catch (error) {
      return "";
    }
  };

  // Get formatted date for display
  const getFormattedDateForDay = (weekStartDate: string, dayIndex: number) => {
    try {
      const startDate = new Date(weekStartDate);
      const dayDate = addDays(startDate, dayIndex);
      return format(dayDate, "MM/dd/yyyy");
    } catch (error) {
      return "";
    }
  };

  // Calculate daily hours
  const getDailyHours = (timeIn: string, timeOut: string, lunchMinutes: number) => {
    if (!timeIn || !timeOut || !form) return { regularHours: 0, overtimeHours: 0 };
    
    try {
      const hoursInfo = calculateHoursWorked(timeIn, timeOut, lunchMinutes);
      // Assuming 8-hour standard day for overtime calculation
      const regularHours = Math.min(8, hoursInfo);
      const overtimeHours = Math.max(0, hoursInfo - 8);
      
      return { regularHours, overtimeHours };
    } catch (error) {
      return { regularHours: 0, overtimeHours: 0 };
    }
  };

  // Function to handle the worked checkbox
  const handleWorkedChange = (day: string, worked: boolean) => {
    const dayKey = day.toLowerCase() as keyof WeeklyTimeEntryFormValues;
    form.setValue(`${dayKey}.worked` as any, worked);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Weekly Timesheet Entry</DialogTitle>
          <DialogDescription>
            Enter timesheet data for the entire week at once
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="employee_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Employee</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(parseInt(value))}
                      defaultValue={field.value ? field.value.toString() : ""}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select Employee" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {employees.map((employee) => (
                          <SelectItem key={employee.id} value={employee.id.toString()}>
                            {employee.first_name} {employee.last_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="week_start_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Week Starting (Monday)</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="border rounded-md p-0">
              <Table>
                <TableCaption>Timesheet for week of {form.watch("week_start_date")}</TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">Day</TableHead>
                    <TableHead className="w-[100px]">Date</TableHead>
                    <TableHead className="w-[70px] text-center">Worked</TableHead>
                    <TableHead className="w-[100px]">Time In</TableHead>
                    <TableHead className="w-[100px]">Time Out</TableHead>
                    <TableHead className="w-[80px]">Lunch</TableHead>
                    <TableHead className="w-[80px]">Miles</TableHead>
                    <TableHead className="w-[80px]">Hours</TableHead>
                    <TableHead className="w-[80px]">OT</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {DAYS_OF_WEEK.map((day, index) => {
                    const dayKey = day.toLowerCase() as keyof WeeklyTimeEntryFormValues;
                    const dateForDay = getFormattedDateForDay(form.watch("week_start_date"), index);
                    
                    return (
                      <TableRow key={day}>
                        <TableCell className="font-medium">{day}</TableCell>
                        <TableCell>{dateForDay}</TableCell>
                        <TableCell className="text-center">
                          <Checkbox
                            id={`${day.toLowerCase()}-worked`}
                            checked={form.watch(`${dayKey}.worked` as any)}
                            onCheckedChange={(checked) => 
                              handleWorkedChange(day, checked as boolean)
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <FormField
                            control={form.control}
                            name={`${dayKey}.time_in` as any}
                            render={({ field }) => (
                              <FormControl>
                                <Input 
                                  type="time" 
                                  {...field} 
                                  disabled={!form.watch(`${dayKey}.worked` as any)}
                                />
                              </FormControl>
                            )}
                          />
                        </TableCell>
                        <TableCell>
                          <FormField
                            control={form.control}
                            name={`${dayKey}.time_out` as any}
                            render={({ field }) => (
                              <FormControl>
                                <Input 
                                  type="time" 
                                  {...field} 
                                  disabled={!form.watch(`${dayKey}.worked` as any)}
                                />
                              </FormControl>
                            )}
                          />
                        </TableCell>
                        <TableCell>
                          <FormField
                            control={form.control}
                            name={`${dayKey}.lunch_minutes` as any}
                            render={({ field }) => (
                              <FormControl>
                                <Input 
                                  type="number" 
                                  min="0" 
                                  step="5" 
                                  className="w-full"
                                  {...field} 
                                  disabled={!form.watch(`${dayKey}.worked` as any)}
                                />
                              </FormControl>
                            )}
                          />
                        </TableCell>
                        <TableCell>
                          <FormField
                            control={form.control}
                            name={`${dayKey}.miles` as any}
                            render={({ field }) => (
                              <FormControl>
                                <Input 
                                  type="number" 
                                  min="0" 
                                  step="1" 
                                  className="w-full"
                                  {...field} 
                                  disabled={!form.watch(`${dayKey}.worked` as any)}
                                />
                              </FormControl>
                            )}
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          {form.watch(`${dayKey}.worked` as any) && 
                            form.watch(`${dayKey}.time_in` as any) && 
                            form.watch(`${dayKey}.time_out` as any) && (
                              <span className="font-medium">
                                {Math.min(8, calculateHoursWorked(
                                  form.watch(`${dayKey}.time_in` as any),
                                  form.watch(`${dayKey}.time_out` as any),
                                  form.watch(`${dayKey}.lunch_minutes` as any) || 0
                                )).toFixed(1)}
                              </span>
                            )}
                          {(!form.watch(`${dayKey}.worked` as any) || 
                            !form.watch(`${dayKey}.time_in` as any) || 
                            !form.watch(`${dayKey}.time_out` as any)) && (
                              <span className="text-muted-foreground">0.0</span>
                            )}
                        </TableCell>
                        <TableCell className="text-center">
                          {form.watch(`${dayKey}.worked` as any) && 
                            form.watch(`${dayKey}.time_in` as any) && 
                            form.watch(`${dayKey}.time_out` as any) && (
                              <span className="font-medium text-amber-600">
                                {Math.max(0, calculateHoursWorked(
                                  form.watch(`${dayKey}.time_in` as any),
                                  form.watch(`${dayKey}.time_out` as any),
                                  form.watch(`${dayKey}.lunch_minutes` as any) || 0
                                ) - 8).toFixed(1)}
                              </span>
                            )}
                          {(!form.watch(`${dayKey}.worked` as any) || 
                            !form.watch(`${dayKey}.time_in` as any) || 
                            !form.watch(`${dayKey}.time_out` as any)) && (
                              <span className="text-muted-foreground">0.0</span>
                            )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <FormField
              control={form.control}
              name="total_miles"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Total Weekly Mileage</FormLabel>
                  <FormControl>
                    <Input type="number" min="0" step="0.1" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="border-t pt-4 mt-2">
              <h3 className="text-lg font-medium mb-2">Special Hours & Reimbursements</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="total_pto_hours"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>PTO Hours</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" step="0.5" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="total_misc_reimbursement"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Misc. Reimbursement ($)</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" step="0.01" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4 mt-2">
                <FormField
                  control={form.control}
                  name="total_holiday_worked_hours"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Holiday Worked Hours</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" step="0.5" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="total_holiday_non_worked_hours"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Holiday Non-Worked Hours</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" step="0.5" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4 mt-2">
                <FormField
                  control={form.control}
                  name="total_misc_hours"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Misc. Hours</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" step="0.5" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="misc_hours_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Misc. Hours Type</FormLabel>
                      <FormControl>
                        <Input 
                          type="text" 
                          placeholder="e.g., prior period adjustment"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Any special notes about this week"
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="pt-4">
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit">
                Save Weekly Timesheet
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}