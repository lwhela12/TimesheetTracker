import { db } from "./db";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";
import { 
  companies, type Company, type InsertCompany,
  users, type User, type InsertUser, 
  employees, type Employee, type InsertEmployee,
  punches, type Punch, type InsertPunch, 
  payroll_calcs, type PayrollCalc, type InsertPayrollCalc,
  audit_logs, type AuditLog, type InsertAuditLog,
  settings, type Setting, type InsertSetting
} from "@shared/schema";
import type { IStorage } from "./storage";

const PostgresSessionStore = connectPg(session);

export class MultiCompanyStorage implements IStorage {
  sessionStore: session.SessionStore;

  constructor() {
    this.sessionStore = new PostgresSessionStore({ 
      pool, 
      createTableIfMissing: true 
    });
  }

  // Company operations
  async getCompany(id: number): Promise<Company | undefined> {
    const [company] = await db.select().from(companies).where(eq(companies.id, id));
    return company || undefined;
  }

  async createCompany(company: InsertCompany): Promise<Company> {
    const [newCompany] = await db.insert(companies).values(company).returning();
    return newCompany;
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db.insert(users).values(user).returning();
    return newUser;
  }

  // Employee operations
  async getEmployee(id: number, company_id: number): Promise<Employee | undefined> {
    const [employee] = await db.select().from(employees)
      .where(and(eq(employees.id, id), eq(employees.company_id, company_id)));
    return employee || undefined;
  }

  async getEmployees(company_id: number, filter?: { active?: boolean; searchQuery?: string; page?: number; limit?: number }): Promise<Employee[]> {
    let query = db.select().from(employees).where(eq(employees.company_id, company_id));

    if (filter?.active !== undefined) {
      query = query.where(and(eq(employees.company_id, company_id), eq(employees.active, filter.active)));
    }

    if (filter?.searchQuery) {
      const q = `%${filter.searchQuery.toLowerCase()}%`;
      query = query.where(and(eq(employees.company_id, company_id), sql`lower(${employees.first_name} || ' ' || ${employees.last_name}) like ${q}`));
    }

    if (filter?.limit !== undefined) {
      query = query.limit(filter.limit);
    }
    if (filter?.page !== undefined && filter?.limit !== undefined) {
      query = query.offset((filter.page - 1) * filter.limit);
    }

    return await query;
  }

  async createEmployee(employee: InsertEmployee): Promise<Employee> {
    const [newEmployee] = await db.insert(employees).values(employee).returning();
    return newEmployee;
  }

  async updateEmployee(id: number, employee: Partial<InsertEmployee>, company_id: number): Promise<Employee | undefined> {
    const [updated] = await db.update(employees)
      .set(employee)
      .where(and(eq(employees.id, id), eq(employees.company_id, company_id)))
      .returning();
    return updated || undefined;
  }

  async deleteEmployee(id: number, company_id: number): Promise<boolean> {
    const result = await db.delete(employees)
      .where(and(eq(employees.id, id), eq(employees.company_id, company_id)));
    return (result.rowCount ?? 0) > 0;
  }

  // Punch operations - filter by employee's company
  async getPunch(id: number, company_id: number): Promise<Punch | undefined> {
    const [punch] = await db.select()
      .from(punches)
      .innerJoin(employees, eq(punches.employee_id, employees.id))
      .where(and(eq(punches.id, id), eq(employees.company_id, company_id)));
    return punch.punches || undefined;
  }

  async getPunches(company_id: number, filter?: {
    employee_id?: number,
    from_date?: Date,
    to_date?: Date,
    status?: string,
    searchQuery?: string,
    page?: number,
    limit?: number
  }): Promise<Punch[]> {
    let query = db.select({ punches })
      .from(punches)
      .innerJoin(employees, eq(punches.employee_id, employees.id))
      .where(eq(employees.company_id, company_id));

    if (filter?.employee_id) {
      query = query.where(and(
        eq(employees.company_id, company_id), 
        eq(punches.employee_id, filter.employee_id)
      ));
    }

    if (filter?.from_date) {
      query = query.where(and(
        eq(employees.company_id, company_id),
        gte(punches.date, filter.from_date.toISOString().split('T')[0])
      ));
    }

    if (filter?.to_date) {
      query = query.where(and(
        eq(employees.company_id, company_id),
        lte(punches.date, filter.to_date.toISOString().split('T')[0])
      ));
    }

    if (filter?.status) {
      query = query.where(and(
        eq(employees.company_id, company_id),
        eq(punches.status, filter.status)
      ));
    }

    if (filter?.searchQuery) {
      const q = `%${filter.searchQuery.toLowerCase()}%`;
      query = query.where(sql`cast(${punches.date} as text) like ${q}`);
    }

    if (filter?.limit !== undefined) {
      query = query.limit(filter.limit);
    }
    if (filter?.page !== undefined && filter?.limit !== undefined) {
      query = query.offset((filter.page - 1) * filter.limit);
    }

    const results = await query.orderBy(desc(punches.created_at));
    return results.map(r => r.punches);
  }

  async createPunch(punch: InsertPunch): Promise<Punch> {
    const [newPunch] = await db.insert(punches).values(punch).returning();
    return newPunch;
  }

  async updatePunch(id: number, punch: Partial<InsertPunch>, company_id: number): Promise<Punch | undefined> {
    const [updated] = await db.update(punches)
      .set(punch)
      .from(employees)
      .where(and(
        eq(punches.id, id), 
        eq(punches.employee_id, employees.id),
        eq(employees.company_id, company_id)
      ))
      .returning();
    return updated || undefined;
  }

  async deletePunch(id: number, company_id: number): Promise<boolean> {
    const result = await db.delete(punches)
      .using(employees)
      .where(and(
        eq(punches.id, id),
        eq(punches.employee_id, employees.id),
        eq(employees.company_id, company_id)
      ));
    return (result.rowCount ?? 0) > 0;
  }

  // Payroll calculation operations
  async calculatePayroll(punch_id: number): Promise<PayrollCalc> {
    // Get the punch to calculate payroll for
    const [punch] = await db.select().from(punches).where(eq(punches.id, punch_id));
    if (!punch) throw new Error("Punch not found");

    // Get employee to get hourly rate
    const [employee] = await db.select().from(employees).where(eq(employees.id, punch.employee_id));
    if (!employee) throw new Error("Employee not found");

    // Get company settings
    const [otThresholdSetting] = await db.select().from(settings)
      .where(and(eq(settings.company_id, employee.company_id), eq(settings.key, "ot_threshold")));
    const [mileageRateSetting] = await db.select().from(settings)
      .where(and(eq(settings.company_id, employee.company_id), eq(settings.key, "mileage_rate")));

    const otThreshold = otThresholdSetting ? parseFloat(otThresholdSetting.value) : 8;
    const mileageRate = mileageRateSetting ? parseFloat(mileageRateSetting.value) : 0.67;

    // Calculate hours worked
    const timeIn = new Date(`1970-01-01T${punch.time_in}`);
    const timeOut = new Date(`1970-01-01T${punch.time_out}`);
    const totalMinutes = (timeOut.getTime() - timeIn.getTime()) / (1000 * 60);
    const lunchMinutes = punch.lunch_minutes || 0;
    const workedMinutes = totalMinutes - lunchMinutes;
    const workedHours = workedMinutes / 60;

    // Calculate regular and overtime hours
    const regHours = Math.min(workedHours, otThreshold);
    const otHours = Math.max(0, workedHours - otThreshold);

    // Calculate pay components
    const regPay = regHours * employee.rate;
    const otPay = otHours * employee.rate * 1.5;
    const ptoPay = (punch.pto_hours || 0) * employee.rate;
    const holidayWorkedPay = (punch.holiday_worked_hours || 0) * employee.rate * 1.5;
    const holidayNonWorkedPay = (punch.holiday_non_worked_hours || 0) * employee.rate;
    const miscHoursPay = (punch.misc_hours || 0) * employee.rate;
    const mileagePay = (punch.miles || 0) * mileageRate;
    const miscReimbursement = punch.misc_reimbursement || 0;

    const totalPay = regPay + otPay + ptoPay + holidayWorkedPay + holidayNonWorkedPay + miscHoursPay + mileagePay + miscReimbursement;

    const calcData: InsertPayrollCalc = {
      punch_id,
      reg_hours: regHours,
      ot_hours: otHours,
      reg_pay: regPay,
      ot_pay: otPay,
      pto_pay: ptoPay,
      holiday_worked_pay: holidayWorkedPay,
      holiday_non_worked_pay: holidayNonWorkedPay,
      misc_hours_pay: miscHoursPay,
      pay: regPay + otPay,
      mileage_pay: mileagePay,
      misc_reimbursement: miscReimbursement,
      total_pay: totalPay
    };

    // Check if calculation already exists
    const [existing] = await db.select().from(payroll_calcs).where(eq(payroll_calcs.punch_id, punch_id));
    
    if (existing) {
      const [updated] = await db.update(payroll_calcs)
        .set({ ...calcData, calculated_at: new Date() })
        .where(eq(payroll_calcs.punch_id, punch_id))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(payroll_calcs).values(calcData).returning();
      return created;
    }
  }

  async getPayrollReport(company_id: number, from_date: Date, to_date: Date): Promise<Array<Punch & { employee: Employee, payroll: PayrollCalc }>> {
    const [mileageRateSetting] = await db.select().from(settings)
      .where(and(eq(settings.company_id, company_id), eq(settings.key, 'mileage_rate')));
    const [otThresholdSetting] = await db.select().from(settings)
      .where(and(eq(settings.company_id, company_id), eq(settings.key, 'ot_threshold')));

    const mileageRate = parseFloat(mileageRateSetting?.value || '0.30');
    const otThreshold = parseFloat(otThresholdSetting?.value || '8');

    const rows = await db.select({ punch: punches, employee: employees })
      .from(punches)
      .innerJoin(employees, eq(punches.employee_id, employees.id))
      .where(and(
        eq(employees.company_id, company_id),
        gte(punches.date, from_date.toISOString().split('T')[0]),
        lte(punches.date, to_date.toISOString().split('T')[0])
      ));

    const report: Array<Punch & { employee: Employee, payroll: PayrollCalc }> = [];

    for (const row of rows) {
      const punch = row.punch;
      const employee = row.employee;

      const timeIn = new Date(`1970-01-01T${punch.time_in}`);
      const timeOut = new Date(`1970-01-01T${punch.time_out}`);
      const workedMinutes = (timeOut.getTime() - timeIn.getTime()) / 60000 - (punch.lunch_minutes || 0);
      const workedHours = workedMinutes / 60;
      const regHours = Math.min(workedHours, otThreshold);
      const otHours = Math.max(0, workedHours - otThreshold);

      const regPay = regHours * employee.rate;
      const otPay = otHours * employee.rate * 1.5;
      const ptoPay = (punch.pto_hours || 0) * employee.rate;
      const holidayWorkedPay = (punch.holiday_worked_hours || 0) * employee.rate * 1.5;
      const holidayNonWorkedPay = (punch.holiday_non_worked_hours || 0) * employee.rate;
      const miscHoursPay = (punch.misc_hours || 0) * employee.rate;
      const mileagePay = (punch.miles || 0) * mileageRate;
      const miscReimb = punch.misc_reimbursement || 0;
      const totalPay = regPay + otPay + ptoPay + holidayWorkedPay + holidayNonWorkedPay + miscHoursPay + mileagePay + miscReimb;

      report.push({
        ...punch,
        employee,
        payroll: {
          id: 0,
          punch_id: punch.id,
          reg_hours: regHours,
          ot_hours: otHours,
          pto_hours: punch.pto_hours || 0,
          holiday_worked_hours: punch.holiday_worked_hours || 0,
          holiday_non_worked_hours: punch.holiday_non_worked_hours || 0,
          misc_hours: punch.misc_hours || 0,
          reg_pay: regPay,
          ot_pay: otPay,
          pto_pay: ptoPay,
          holiday_worked_pay: holidayWorkedPay,
          holiday_non_worked_pay: holidayNonWorkedPay,
          misc_hours_pay: miscHoursPay,
          pay: regPay + otPay + ptoPay + holidayWorkedPay + holidayNonWorkedPay + miscHoursPay,
          mileage_pay: mileagePay,
          misc_reimbursement: miscReimb,
          total_pay: totalPay,
          calculated_at: new Date()
        }
      });
    }

    return report;
  }

  // Audit log operations
  async addAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    const [newLog] = await db.insert(audit_logs).values(log).returning();
    return newLog;
  }

  async getAuditLogs(filter?: { table_name?: string, row_id?: number }): Promise<AuditLog[]> {
    let query = db.select().from(audit_logs);

    if (filter?.table_name) {
      query = query.where(eq(audit_logs.table_name, filter.table_name));
    }

    if (filter?.row_id) {
      query = query.where(eq(audit_logs.row_id, filter.row_id));
    }

    return await query;
  }

  // Settings operations
  async getSetting(company_id: number, key: string): Promise<Setting | undefined> {
    const [setting] = await db.select().from(settings)
      .where(and(eq(settings.company_id, company_id), eq(settings.key, key)));
    return setting || undefined;
  }

  async updateSetting(company_id: number, key: string, value: string): Promise<Setting> {
    const [existing] = await db.select().from(settings)
      .where(and(eq(settings.company_id, company_id), eq(settings.key, key)));

    if (existing) {
      const [updated] = await db.update(settings)
        .set({ value, updated_at: new Date() })
        .where(and(eq(settings.company_id, company_id), eq(settings.key, key)))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(settings)
        .values({ company_id, key, value })
        .returning();
      return created;
    }
  }
}