import { pgTable, text, serial, integer, boolean, timestamp, doublePrecision, varchar, date, time } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User table for authentication
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("clerk"),
  created_at: timestamp("created_at").defaultNow(),
});

// Employee table 
export const employees = pgTable("employees", {
  id: serial("id").primaryKey(),
  first_name: varchar("first_name", { length: 50 }).notNull(),
  last_name: varchar("last_name", { length: 50 }).notNull(),
  rate: doublePrecision("rate").notNull(), // Hourly rate
  active: boolean("active").notNull().default(true),
  created_at: timestamp("created_at").defaultNow(),
});

// Timesheet punch entry
export const punches = pgTable("punches", {
  id: serial("id").primaryKey(),
  employee_id: integer("employee_id").notNull().references(() => employees.id),
  date: date("date").notNull(),
  time_in: time("time_in").notNull(),
  time_out: time("time_out").notNull(),
  lunch_minutes: integer("lunch_minutes").default(0),
  miles: doublePrecision("miles").default(0),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  created_by: integer("created_by").references(() => users.id),
  created_at: timestamp("created_at").defaultNow(),
});

// Payroll calculation table (for memoizing calculations)
export const payroll_calcs = pgTable("payroll_calcs", {
  id: serial("id").primaryKey(),
  punch_id: integer("punch_id").notNull().references(() => punches.id),
  reg_hours: doublePrecision("reg_hours").notNull(),
  ot_hours: doublePrecision("ot_hours").notNull(),
  pay: doublePrecision("pay").notNull(),
  mileage_pay: doublePrecision("mileage_pay").notNull(),
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
});

// Settings table
export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  updated_at: timestamp("updated_at").defaultNow(),
});

// Zod schemas for insert operations
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  role: true,
});

export const insertEmployeeSchema = createInsertSchema(employees).pick({
  first_name: true,
  last_name: true,
  rate: true,
  active: true,
});

export const insertPunchSchema = createInsertSchema(punches).pick({
  employee_id: true,
  date: true,
  time_in: true,
  time_out: true,
  lunch_minutes: true,
  miles: true,
  status: true,
  created_by: true,
});

export const insertPayrollCalcSchema = createInsertSchema(payroll_calcs).pick({
  punch_id: true,
  reg_hours: true,
  ot_hours: true,
  pay: true,
  mileage_pay: true,
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
  key: true,
  value: true,
});

// Types
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
