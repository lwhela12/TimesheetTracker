import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { Employee, insertPunchSchema } from "@shared/schema";
import { formatDate } from "@/lib/utils";

// Create a schema for the form
const timeEntryFormSchema = z.object({
  employee_id: z.coerce.number().min(1, "Please select an employee"),
  date: z.string().min(1, "Date is required"),
  time_in: z.string().min(1, "Time in is required"),
  time_out: z.string().min(1, "Time out is required"),
  lunch_minutes: z.coerce.number().min(0, "Must be 0 or more").default(0),
  miles: z.coerce.number().min(0, "Must be 0 or more").default(0),
  notes: z.string().optional(),
  status: z.string().default("pending"),
});

type TimeEntryFormValues = z.infer<typeof timeEntryFormSchema>;

type TimeEntryFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: TimeEntryFormValues) => void;
  employees: {
    id: number;
    first_name: string;
    last_name: string;
    rate: number;
    active: boolean;
    created_at?: Date | string | null;
  }[];
  initialData?: Partial<TimeEntryFormValues>;
  isEditMode?: boolean;
};

export default function TimeEntryForm({
  open,
  onOpenChange,
  onSubmit,
  employees,
  initialData,
  isEditMode = false,
}: TimeEntryFormProps) {
  const form = useForm<TimeEntryFormValues>({
    resolver: zodResolver(timeEntryFormSchema),
    defaultValues: {
      employee_id: initialData?.employee_id || 0,
      date: initialData?.date || formatDate(new Date()),
      time_in: initialData?.time_in || "08:00",
      time_out: initialData?.time_out || "17:00",
      lunch_minutes: initialData?.lunch_minutes || 30,
      miles: initialData?.miles || 0,
      notes: initialData?.notes || "",
      status: initialData?.status || "pending",
    },
  });

  // Update form values when initialData changes
  useEffect(() => {
    if (initialData && open) {
      form.reset({
        employee_id: initialData.employee_id || 0,
        date: initialData.date || formatDate(new Date()),
        time_in: initialData.time_in || "08:00",
        time_out: initialData.time_out || "17:00",
        lunch_minutes: initialData.lunch_minutes || 30,
        miles: initialData.miles || 0,
        notes: initialData.notes || "",
        status: initialData.status || "pending",
      });
    }
  }, [initialData, open, form]);

  const handleSubmit = (values: TimeEntryFormValues) => {
    onSubmit(values);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? "Edit Time Entry" : "Add Time Entry"}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
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
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="time_in"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Time In</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="time_out"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Time Out</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="lunch_minutes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lunch (minutes)</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" step="5" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="miles"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Miles</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" step="0.1" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {isEditMode && (
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select Status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="approved">Approved</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Any special notes about this entry"
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
                {isEditMode ? "Update Entry" : "Save Entry"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
