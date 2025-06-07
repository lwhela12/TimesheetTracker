import { 
  companies, type Company, type InsertCompany,
  users, type User, type InsertUser, 
  employees, type Employee, type InsertEmployee,
  punches, type Punch, type InsertPunch, 
  payroll_calcs, type PayrollCalc, type InsertPayrollCalc,
  audit_logs, type AuditLog, type InsertAuditLog,
  settings, type Setting, type InsertSetting
} from "@shared/schema";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { db, pool } from "./db";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";

const PostgresSessionStore = connectPg(session);



// modify the interface with any CRUD methods
// you might need
export interface IDatabase {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Company operations
  getCompany(id: number): Promise<Company | undefined>;
  createCompany(company: InsertCompany): Promise<Company>;
  
  // Employee operations
  getEmployee(id: number, company_id: number): Promise<Employee | undefined>;
  getEmployees(company_id: number, filter?: { active?: boolean; searchQuery?: string; page?: number; limit?: number }): Promise<Employee[]>;
  createEmployee(employee: InsertEmployee): Promise<Employee>;
  updateEmployee(id: number, employee: Partial<InsertEmployee>, company_id: number): Promise<Employee | undefined>;
  deleteEmployee(id: number, company_id: number): Promise<boolean>;
  
  // Punch operations
  getPunch(id: number, company_id: number): Promise<Punch | undefined>;
  getPunchByEmployeeAndDate(employee_id: number, date: string): Promise<Punch | undefined>;
  getPunches(company_id: number, filter?: {
    employee_id?: number,
    from_date?: Date,
    to_date?: Date,
    status?: string,
    searchQuery?: string,
    page?: number,
    limit?: number
  }): Promise<Punch[]>;
  createPunch(punch: InsertPunch): Promise<Punch>;
  updatePunch(id: number, punch: Partial<InsertPunch>, company_id: number): Promise<Punch | undefined>;
  deletePunch(id: number, company_id: number): Promise<boolean>;
  
  // Payroll calculation operations
  calculatePayroll(punch_id: number): Promise<PayrollCalc>;
  getPayrollForPeriod(company_id: number, from_date: Date, to_date: Date): Promise<any[]>;
  
  // Audit log operations
  addAuditLog(log: InsertAuditLog): Promise<AuditLog>;
  getAuditLogs(filter?: { table_name?: string, row_id?: number }): Promise<AuditLog[]>;
  
  // Settings operations
  getSetting(company_id: number, key: string): Promise<Setting | undefined>;
  updateSetting(company_id: number, key: string, value: string): Promise<Setting>;
  
  // Session store
  sessionStore: session.SessionStore;
}

export class Database implements IDatabase {
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

  async getPunchByEmployeeAndDate(employee_id: number, date: string): Promise<Punch | undefined> {
    const [punch] = await db
      .select()
      .from(punches)
      .where(and(eq(punches.employee_id, employee_id), eq(punches.date, date)));
    return punch || undefined;
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


  async getPayrollForPeriod(company_id: number, from_date: Date, to_date: Date): Promise<any[]> {
    // 1. Fetch all necessary data
    const weekStartSetting = await this.getSetting(company_id, 'work_week_start');
    const otSetting = await this.getSetting(company_id, 'ot_threshold');
    const mileageRateSetting = await this.getSetting(company_id, 'mileage_rate');

    const weekStartDay = parseInt(weekStartSetting?.value || '3', 10); // 0=Sun, 1=Mon... 3=Wed
    const otThreshold = parseFloat(otSetting?.value || '40');
    const mileageRate = parseFloat(mileageRateSetting?.value || '0.30');

    const companyPunches = await db.select({ punch: punches, employee: employees })
      .from(punches)
      .innerJoin(employees, eq(punches.employee_id, employees.id))
      .where(and(
        eq(employees.company_id, company_id),
        gte(punches.date, from_date.toISOString().split('T')[0]),
        lte(punches.date, to_date.toISOString().split('T')[0])
      ));

    // 2. Group punches by employee and then by work week
    const employeeWeeklyBuckets = new Map<number, Map<string, any[]>>();

    for (const { punch, employee } of companyPunches) {
      if (!employeeWeeklyBuckets.has(employee.id)) {
        employeeWeeklyBuckets.set(employee.id, new Map());
      }

      const dateObj = new Date(punch.date + 'T00:00:00');
      const dayOfWeek = dateObj.getDay();
      const diff = (dayOfWeek - weekStartDay + 7) % 7;
      const weekStartDate = new Date(dateObj);
      weekStartDate.setDate(dateObj.getDate() - diff);
      const weekStartKey = weekStartDate.toISOString().split('T')[0];

      const weekPunches = employeeWeeklyBuckets.get(employee.id)!.get(weekStartKey) || [];
      weekPunches.push(punch);
      employeeWeeklyBuckets.get(employee.id)!.set(weekStartKey, weekPunches);
    }

    // 3. Calculate payroll for each employee
    const finalReport = [];

    for (const [employeeId, weeklyBuckets] of employeeWeeklyBuckets.entries()) {
      const employee = (await this.getEmployee(employeeId, company_id))!;
      let periodTotals = {
          employee, reg_hours: 0, ot_hours: 0, pto_hours: 0, holiday_worked_hours: 0, 
          holiday_non_worked_hours: 0, misc_hours: 0, reg_pay: 0, ot_pay: 0, pto_pay: 0, 
          holiday_worked_pay: 0, holiday_non_worked_pay: 0, misc_hours_pay: 0, mileage_pay: 0,
          misc_reimbursement: 0, total_pay: 0
      };

      for (const punchesInWeek of weeklyBuckets.values()) {
        let weeklyWorkedHours = 0;
        let weeklyPtoHours = 0;
        let weeklyHolidayWorkedHours = 0;
        let weeklyHolidayNonWorkedHours = 0;
        let weeklyMiscHours = 0;
        let weeklyMiles = 0;
        let weeklyMiscReimbursement = 0;

        for (const punch of punchesInWeek) {
          if (punch.time_in && punch.time_out) {
            const timeIn = new Date(`1970-01-01T${punch.time_in}`);
            const timeOut = new Date(`1970-01-01T${punch.time_out}`);
            const workedMinutes = (timeOut.getTime() - timeIn.getTime()) / 60000 - (punch.lunch_minutes || 0);
            weeklyWorkedHours += (workedMinutes > 0 ? workedMinutes / 60 : 0);
          }
          weeklyPtoHours += punch.pto_hours || 0;
          weeklyHolidayWorkedHours += punch.holiday_worked_hours || 0;
          weeklyHolidayNonWorkedHours += punch.holiday_non_worked_hours || 0;
          weeklyMiscHours += punch.misc_hours || 0;
          weeklyMiles += punch.miles || 0;
          weeklyMiscReimbursement += punch.misc_reimbursement || 0;
        }

        const regHours = Math.min(weeklyWorkedHours, otThreshold);
        const otHours = Math.max(0, weeklyWorkedHours - otThreshold);
        
        periodTotals.reg_hours += regHours;
        periodTotals.ot_hours += otHours;
        periodTotals.pto_hours += weeklyPtoHours;
        periodTotals.holiday_worked_hours += weeklyHolidayWorkedHours;
        periodTotals.holiday_non_worked_hours += weeklyHolidayNonWorkedHours;
        periodTotals.misc_hours += weeklyMiscHours;
        periodTotals.misc_reimbursement += weeklyMiscReimbursement;

        const regPay = regHours * employee.rate;
        const otPay = otHours * employee.rate * 1.5;
        const ptoPay = weeklyPtoHours * employee.rate;
        const holidayWorkedPay = weeklyHolidayWorkedHours * employee.rate * 1.5;
        const holidayNonWorkedPay = weeklyHolidayNonWorkedHours * employee.rate;
        const miscPay = weeklyMiscHours * employee.rate;
        const mileagePay = weeklyMiles * mileageRate;

        periodTotals.reg_pay += regPay;
        periodTotals.ot_pay += otPay;
        periodTotals.pto_pay += ptoPay;
        periodTotals.holiday_worked_pay += holidayWorkedPay;
        periodTotals.holiday_non_worked_pay += holidayNonWorkedPay;
        periodTotals.misc_hours_pay += miscPay;
        periodTotals.mileage_pay += mileagePay;
        periodTotals.total_pay += regPay + otPay + ptoPay + holidayWorkedPay + holidayNonWorkedPay + miscPay + mileagePay + weeklyMiscReimbursement;
      }
      finalReport.push(periodTotals);
    }
    
    return finalReport;
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
export const storage = new Database();
