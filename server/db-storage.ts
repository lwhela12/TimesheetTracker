import { IStorage } from "./storage";
import { db } from "./db";
import { 
  users, employees, punches, payroll_calcs, audit_logs, settings,
  User, Employee, Punch, PayrollCalc, AuditLog, Setting,
  InsertUser, InsertEmployee, InsertPunch, InsertPayrollCalc, InsertAuditLog
} from "@shared/schema";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";

const PostgresSessionStore = connectPg(session);

export class DatabaseStorage implements IStorage {
  sessionStore: session.SessionStore;

  constructor() {
    this.sessionStore = new PostgresSessionStore({ 
      pool, 
      createTableIfMissing: true 
    });
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
  async getEmployee(id: number): Promise<Employee | undefined> {
    const [employee] = await db.select().from(employees).where(eq(employees.id, id));
    return employee || undefined;
  }

  async getEmployees(filter?: { active?: boolean }): Promise<Employee[]> {
    let query = db.select().from(employees);
    
    if (filter?.active !== undefined) {
      query = query.where(eq(employees.active, filter.active));
    }
    
    return await query;
  }

  async createEmployee(employee: InsertEmployee): Promise<Employee> {
    const [newEmployee] = await db.insert(employees).values(employee).returning();
    return newEmployee;
  }

  async updateEmployee(id: number, employee: Partial<InsertEmployee>): Promise<Employee | undefined> {
    const [updatedEmployee] = await db
      .update(employees)
      .set(employee)
      .where(eq(employees.id, id))
      .returning();
    return updatedEmployee || undefined;
  }

  async deleteEmployee(id: number): Promise<boolean> {
    const result = await db.delete(employees).where(eq(employees.id, id));
    return result.rowCount > 0;
  }

  // Punch operations
  async getPunch(id: number): Promise<Punch | undefined> {
    const [punch] = await db.select().from(punches).where(eq(punches.id, id));
    return punch || undefined;
  }

  async getPunches(filter?: { 
    employee_id?: number, 
    from_date?: Date, 
    to_date?: Date,
    status?: string
  }): Promise<Punch[]> {
    let query = db.select().from(punches);
    
    const conditions = [];
    
    if (filter?.employee_id) {
      conditions.push(eq(punches.employee_id, filter.employee_id));
    }
    
    if (filter?.from_date) {
      conditions.push(gte(punches.date, filter.from_date.toISOString().split('T')[0]));
    }
    
    if (filter?.to_date) {
      conditions.push(lte(punches.date, filter.to_date.toISOString().split('T')[0]));
    }
    
    if (filter?.status) {
      conditions.push(eq(punches.status, filter.status));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    return await query.orderBy(desc(punches.created_at));
  }

  async createPunch(punch: InsertPunch): Promise<Punch> {
    const [newPunch] = await db.insert(punches).values(punch).returning();
    return newPunch;
  }

  async updatePunch(id: number, punch: Partial<InsertPunch>): Promise<Punch | undefined> {
    const [updatedPunch] = await db
      .update(punches)
      .set(punch)
      .where(eq(punches.id, id))
      .returning();
    return updatedPunch || undefined;
  }

  async deletePunch(id: number): Promise<boolean> {
    // First delete any associated payroll calculations
    await db.delete(payroll_calcs).where(eq(payroll_calcs.punch_id, id));
    
    // Then delete the punch
    const result = await db.delete(punches).where(eq(punches.id, id));
    return result.rowCount > 0;
  }

  // Payroll calculation operations
  async calculatePayroll(punch_id: number): Promise<PayrollCalc> {
    // Check if calculation already exists
    const [existingCalc] = await db
      .select()
      .from(payroll_calcs)
      .where(eq(payroll_calcs.punch_id, punch_id));

    if (existingCalc) {
      return existingCalc;
    }

    // Get the punch and employee data
    const [punch] = await db.select().from(punches).where(eq(punches.id, punch_id));
    if (!punch) {
      throw new Error("Punch not found");
    }

    const [employee] = await db.select().from(employees).where(eq(employees.id, punch.employee_id));
    if (!employee) {
      throw new Error("Employee not found");
    }

    // Get settings
    const [mileageRateSetting] = await db.select().from(settings).where(eq(settings.key, "mileage_rate"));
    const [otThresholdSetting] = await db.select().from(settings).where(eq(settings.key, "ot_threshold"));
    
    const mileageRate = parseFloat(mileageRateSetting?.value || "0.30");
    const otThreshold = parseFloat(otThresholdSetting?.value || "8");

    // Calculate hours worked
    let regHours = 0;
    let otHours = 0;

    if (punch.time_in && punch.time_out) {
      const timeIn = new Date(`1970-01-01T${punch.time_in}`);
      const timeOut = new Date(`1970-01-01T${punch.time_out}`);
      const totalMinutes = (timeOut.getTime() - timeIn.getTime()) / (1000 * 60);
      const lunchMinutes = punch.lunch_minutes || 0;
      const workedMinutes = totalMinutes - lunchMinutes;
      const totalHours = workedMinutes / 60;

      regHours = Math.min(totalHours, otThreshold);
      otHours = Math.max(0, totalHours - otThreshold);
    }

    // Calculate pay
    const regPay = regHours * employee.rate;
    const otPay = otHours * employee.rate * 1.5;
    const ptoPay = (punch.pto_hours || 0) * employee.rate;
    const holidayWorkedPay = (punch.holiday_worked_hours || 0) * employee.rate * 1.5;
    const holidayNonWorkedPay = (punch.holiday_non_worked_hours || 0) * employee.rate;
    const miscHoursPay = (punch.misc_hours || 0) * employee.rate;
    const mileagePay = (punch.miles || 0) * mileageRate;
    
    const totalPay = regPay + otPay + ptoPay + holidayWorkedPay + holidayNonWorkedPay + miscHoursPay + mileagePay + (punch.misc_reimbursement || 0);

    const calcData: InsertPayrollCalc = {
      punch_id,
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
      misc_reimbursement: punch.misc_reimbursement || 0,
      total_pay: totalPay
    };

    const [newCalc] = await db.insert(payroll_calcs).values(calcData).returning();
    return newCalc;
  }

  async getPayrollReport(from_date: Date, to_date: Date): Promise<Array<Punch & { employee: Employee, payroll: PayrollCalc }>> {
    const punchList = await this.getPunches({ from_date, to_date });
    
    const report: Array<Punch & { employee: Employee, payroll: PayrollCalc }> = [];
    
    for (const punch of punchList) {
      const employee = await this.getEmployee(punch.employee_id);
      if (!employee) continue;
      
      try {
        const payroll = await this.calculatePayroll(punch.id);
        report.push({
          ...punch,
          employee,
          payroll
        });
      } catch (error) {
        // Skip punches that can't be calculated
        continue;
      }
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
    
    const conditions = [];
    
    if (filter?.table_name) {
      conditions.push(eq(audit_logs.table_name, filter.table_name));
    }
    
    if (filter?.row_id) {
      conditions.push(eq(audit_logs.row_id, filter.row_id));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    return await query.orderBy(desc(audit_logs.changed_at));
  }

  // Settings operations
  async getSetting(key: string): Promise<Setting | undefined> {
    const [setting] = await db.select().from(settings).where(eq(settings.key, key));
    return setting || undefined;
  }

  async updateSetting(key: string, value: string): Promise<Setting> {
    // Try to update first
    const [updated] = await db
      .update(settings)
      .set({ value })
      .where(eq(settings.key, key))
      .returning();

    if (updated) {
      return updated;
    }

    // If no update happened, insert new setting
    const [created] = await db
      .insert(settings)
      .values({ key, value })
      .returning();
    
    return created;
  }
}