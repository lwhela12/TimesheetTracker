import { pgTable, text, serial, integer, boolean, timestamp, doublePrecision, varchar, date, time, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Company/Organization table
export const companies = pgTable("companies", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  address: text("address"),
  phone: varchar("phone", { length: 20 }),
  email: varchar("email", { length: 100 }),
  created_at: timestamp("created_at").defaultNow(),
});

// User table for authentication
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("clerk"),
  company_id: integer("company_id").notNull().references(() => companies.id),
  created_at: timestamp("created_at").defaultNow(),
});

// Employee table 
export const employees = pgTable("employees", {
  id: serial("id").primaryKey(),
  company_id: integer("company_id").notNull().references(() => companies.id),
  first_name: varchar("first_name", { length: 50 }).notNull(),
  last_name: varchar("last_name", { length: 50 }).notNull(),
  rate: doublePrecision("rate").notNull(), // Hourly rate
  hire_date: date("hire_date"),
  active: boolean("active").notNull().default(true),
  created_at: timestamp("created_at").defaultNow(),
}, (table) => {
  return {
    companyActiveIdx: index("employee_company_active_idx").on(table.company_id, table.active),
  };
});

// Timesheet punch entry
export const punches = pgTable("punches", {
  id: serial("id").primaryKey(),
  employee_id: integer("employee_id").notNull().references(() => employees.id),
  date: date("date").notNull(),
  time_in: time("time_in"),
  time_out: time("time_out"),
  lunch_minutes: integer("lunch_minutes").default(0),
  miles: doublePrecision("miles").default(0),
  pto_hours: doublePrecision("pto_hours").default(0),
  holiday_worked_hours: doublePrecision("holiday_worked_hours").default(0),
  holiday_non_worked_hours: doublePrecision("holiday_non_worked_hours").default(0),
  misc_reimbursement: doublePrecision("misc_reimbursement").default(0),
  misc_hours: doublePrecision("misc_hours").default(0),
  misc_hours_type: varchar("misc_hours_type", { length: 20 }),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  created_by: integer("created_by").references(() => users.id),
  created_at: timestamp("created_at").defaultNow(),
}, (table) => {
  return {
    employeeDateIdx: index("punch_employee_date_idx").on(table.employee_id, table.date),
  };
});

// Payroll calculation table (for memoizing calculations)
export const payroll_calcs = pgTable("payroll_calcs", {
  id: serial("id").primaryKey(),
  punch_id: integer("punch_id").notNull().references(() => punches.id),
  reg_hours: doublePrecision("reg_hours").notNull(),
  ot_hours: doublePrecision("ot_hours").notNull(),
  pto_hours: doublePrecision("pto_hours").default(0),
  holiday_worked_hours: doublePrecision("holiday_worked_hours").default(0),
  holiday_non_worked_hours: doublePrecision("holiday_non_worked_hours").default(0),
  misc_hours: doublePrecision("misc_hours").default(0),
  reg_pay: doublePrecision("reg_pay").notNull(),
  ot_pay: doublePrecision("ot_pay").notNull(),
  pto_pay: doublePrecision("pto_pay").default(0),
  holiday_worked_pay: doublePrecision("holiday_worked_pay").default(0),
  holiday_non_worked_pay: doublePrecision("holiday_non_worked_pay").default(0),
  misc_hours_pay: doublePrecision("misc_hours_pay").default(0),
  pay: doublePrecision("pay").notNull(), // Total of all hourly pay
  mileage_pay: doublePrecision("mileage_pay").notNull(),
  misc_reimbursement: doublePrecision("misc_reimbursement").default(0),
  total_pay: doublePrecision("total_pay").notNull(), // Grand total including all pay and reimbursements
  calculated_at: timestamp("calculated_at").defaultNow(),
});

// Audit log table
export const audit_logs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  table_name: text("table_name").notNull(),
  row_id: integer("row_id").notNull(),
  changed_by: integer("changed_by").references(() => users.id),
  field: text("field").notNull(),
  old_val: text("old_val"),
  new_val: text("new_val"),
  changed_at: timestamp("changed_at").defaultNow(),
}, (table) => {
  return {
    tableRowIdx: index("audit_table_row_idx").on(table.table_name, table.row_id),
  };
});

// Settings table
export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  company_id: integer("company_id").notNull().references(() => companies.id),
  key: text("key").notNull(),
  value: text("value").notNull(),
  updated_at: timestamp("updated_at").defaultNow(),
});

// Zod schemas for insert operations
export const insertCompanySchema = createInsertSchema(companies).pick({
  name: true,
  address: true,
  phone: true,
  email: true,
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  role: true,
  company_id: true,
});

export const insertEmployeeSchema = createInsertSchema(employees).pick({
  company_id: true,
  first_name: true,
  last_name: true,
  rate: true,
  hire_date: true,
  active: true,
});

export const insertPunchSchema = createInsertSchema(punches).pick({
  employee_id: true,
  date: true,
  time_in: true,
  time_out: true,
  lunch_minutes: true,
  miles: true,
  pto_hours: true,
  holiday_worked_hours: true,
  holiday_non_worked_hours: true,
  misc_reimbursement: true,
  misc_hours: true,
  misc_hours_type: true,
  status: true,
  created_by: true,
});

export const insertPayrollCalcSchema = createInsertSchema(payroll_calcs).pick({
  punch_id: true,
  reg_hours: true,
  ot_hours: true,
  pto_hours: true,
  holiday_worked_hours: true,
  holiday_non_worked_hours: true,
  misc_hours: true,
  reg_pay: true,
  ot_pay: true,
  pto_pay: true,
  holiday_worked_pay: true,
  holiday_non_worked_pay: true,
  misc_hours_pay: true,
  pay: true,
  mileage_pay: true,
  misc_reimbursement: true,
  total_pay: true,
});

export const insertAuditLogSchema = createInsertSchema(audit_logs).pick({
  table_name: true,
  row_id: true,
  changed_by: true,
  field: true,
  old_val: true,
  new_val: true,
});

export const insertSettingSchema = createInsertSchema(settings).pick({
  company_id: true,
  key: true,
  value: true,
});

// Types
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type Company = typeof companies.$inferSelect;

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;
export type Employee = typeof employees.$inferSelect;

export type InsertPunch = z.infer<typeof insertPunchSchema>;
export type Punch = typeof punches.$inferSelect;

export type InsertPayrollCalc = z.infer<typeof insertPayrollCalcSchema>;
export type PayrollCalc = typeof payroll_calcs.$inferSelect;

export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof audit_logs.$inferSelect;

export type InsertSetting = z.infer<typeof insertSettingSchema>;
export type Setting = typeof settings.$inferSelect;

// Extended types for UI needs
export type PunchWithEmployee = Punch & {
  employee: Employee;
};

export type PunchWithPayroll = Punch & {
  employee: Employee;
  payroll: PayrollCalc;
};
