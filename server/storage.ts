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
import createMemoryStore from "memorystore";

const MemoryStore = createMemoryStore(session);

// modify the interface with any CRUD methods
// you might need
export interface IStorage {
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
  getPayrollReport(company_id: number, from_date: Date, to_date: Date): Promise<Array<Punch & { employee: Employee, payroll: PayrollCalc }>>;
  
  // Audit log operations
  addAuditLog(log: InsertAuditLog): Promise<AuditLog>;
  getAuditLogs(filter?: { table_name?: string, row_id?: number }): Promise<AuditLog[]>;
  
  // Settings operations
  getSetting(company_id: number, key: string): Promise<Setting | undefined>;
  updateSetting(company_id: number, key: string, value: string): Promise<Setting>;
  
  // Session store
  sessionStore: session.SessionStore;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private employees: Map<number, Employee>;
  private punches: Map<number, Punch>;
  private payroll_calcs: Map<number, PayrollCalc>;
  private audit_logs: Map<number, AuditLog>;
  private settings: Map<string, Setting>;
  private userId: number;
  private employeeId: number;
  private punchId: number;
  private payrollCalcId: number;
  private auditLogId: number;
  private settingId: number;
  sessionStore: session.SessionStore;

  constructor() {
    this.users = new Map();
    this.employees = new Map();
    this.punches = new Map();
    this.payroll_calcs = new Map();
    this.audit_logs = new Map();
    this.settings = new Map();
    this.userId = 1;
    this.employeeId = 1;
    this.punchId = 1;
    this.payrollCalcId = 1;
    this.auditLogId = 1;
    this.settingId = 1;

    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000,
    });

    // Add default settings
    this.settings.set('mileage_rate', {
      id: this.settingId++,
      key: 'mileage_rate',
      value: '0.30',
      updated_at: new Date()
    });
    this.settings.set('ot_threshold', {
      id: this.settingId++,
      key: 'ot_threshold',
      value: '40', // 40 hours per week for overtime
      updated_at: new Date()
    });
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userId++;
    const user: User = { 
      ...insertUser, 
      id,
      created_at: new Date() 
    };
    this.users.set(id, user);
    return user;
  }

  // Employee methods
  async getEmployee(id: number, company_id?: number): Promise<Employee | undefined> {
    return this.employees.get(id);
  }


  async getEmployees(filter?: { active?: boolean; searchQuery?: string; page?: number; limit?: number }): Promise<Employee[]> {
    let result = Array.from(this.employees.values());


    if (filter?.active !== undefined) {
      result = result.filter(emp => emp.active === filter.active);
    }

    if (filter?.searchQuery) {
      const q = filter.searchQuery.toLowerCase();
      result = result.filter(e => `${e.first_name} ${e.last_name}`.toLowerCase().includes(q));
    }

    if (filter?.page !== undefined && filter?.limit !== undefined) {
      const start = (filter.page - 1) * filter.limit;
      result = result.slice(start, start + filter.limit);
    }

    return result;
  }

  async createEmployee(insertEmployee: InsertEmployee): Promise<Employee> {
    const id = this.employeeId++;
    const employee: Employee = {
      ...insertEmployee,
      id,
      created_at: new Date()
    };
    this.employees.set(id, employee);
    return employee;
  }

  async updateEmployee(id: number, update: Partial<InsertEmployee>, company_id?: number): Promise<Employee | undefined> {
    const employee = this.employees.get(id);
    if (!employee) return undefined;
    
    const updatedEmployee = {
      ...employee,
      ...update
    };
    
    this.employees.set(id, updatedEmployee);
    return updatedEmployee;
  }

  async deleteEmployee(id: number, company_id?: number): Promise<boolean> {
    const exists = this.employees.has(id);
    if (exists) {
      // Instead of deleting, set active to false
      const employee = this.employees.get(id)!;
      this.employees.set(id, { ...employee, active: false });
    }
    return exists;
  }

  // Punch methods
  async getPunch(id: number, company_id?: number): Promise<Punch | undefined> {
    return this.punches.get(id);
  }


  async getPunches(filter?: {
    employee_id?: number,
    from_date?: Date,
    to_date?: Date,
    status?: string,
    searchQuery?: string,
    page?: number,
    limit?: number
  }): Promise<Punch[]> {
    let punches = Array.from(this.punches.values());
    
    if (filter?.employee_id !== undefined) {
      punches = punches.filter(punch => punch.employee_id === filter.employee_id);
    }
    
    if (filter?.from_date) {
      punches = punches.filter(punch => {
        const punchDate = new Date(punch.date);
        return punchDate >= filter.from_date!;
      });
    }
    
    if (filter?.to_date) {
      punches = punches.filter(punch => {
        const punchDate = new Date(punch.date);
        return punchDate <= filter.to_date!;
      });
    }
    
    if (filter?.status) {
      punches = punches.filter(punch => punch.status === filter.status);
    }

    if (filter?.searchQuery) {
      const q = filter.searchQuery.toLowerCase();
      punches = punches.filter(p => String(p.date).includes(q));
    }

    if (filter?.page !== undefined && filter?.limit !== undefined) {
      const start = (filter.page - 1) * filter.limit;
      punches = punches.slice(start, start + filter.limit);
    }

    return punches;
  }

  async createPunch(insertPunch: InsertPunch): Promise<Punch> {
    const id = this.punchId++;
    const punch: Punch = {
      ...insertPunch,
      id,
      created_at: new Date()
    };
    this.punches.set(id, punch);
    
    // Automatically calculate payroll for this punch
    await this.calculatePayroll(id);
    
    return punch;
  }

  async updatePunch(id: number, update: Partial<InsertPunch>): Promise<Punch | undefined> {
    const punch = this.punches.get(id);
    if (!punch) return undefined;
    
    const updatedPunch = {
      ...punch,
      ...update
    };
    
    this.punches.set(id, updatedPunch);
    
    // Recalculate payroll when a punch is updated
    await this.calculatePayroll(id);
    
    return updatedPunch;
  }

  async deletePunch(id: number): Promise<boolean> {
    const exists = this.punches.has(id);
    if (exists) {
      this.punches.delete(id);
      
      // Remove associated payroll calculation
      for (const [calcId, calc] of this.payroll_calcs.entries()) {
        if (calc.punch_id === id) {
          this.payroll_calcs.delete(calcId);
          break;
        }
      }
    }
    return exists;
  }

  // Payroll calculation methods
  async calculatePayroll(punch_id: number): Promise<PayrollCalc> {
    const punch = this.punches.get(punch_id);
    if (!punch) {
      throw new Error(`Punch with id ${punch_id} not found`);
    }
    
    const employee = this.employees.get(punch.employee_id);
    if (!employee) {
      throw new Error(`Employee with id ${punch.employee_id} not found`);
    }
    
    // Get mileage rate from settings
    const mileageRateSetting = await this.getSetting('mileage_rate');
    const mileageRate = parseFloat(mileageRateSetting?.value || '0.30');
    
    // Get overtime threshold from settings
    const otThresholdSetting = await this.getSetting('ot_threshold');
    const otThreshold = parseFloat(otThresholdSetting?.value || '40');
    
    // Get holiday rate multiplier from settings (default to 1.5x if not set)
    const holidayRateMultiplierSetting = await this.getSetting('holiday_rate_multiplier');
    const holidayRateMultiplier = parseFloat(holidayRateMultiplierSetting?.value || '1.5');
    
    // Calculate hours worked from time in/out (if present)
    let regHours = 0;
    let otHours = 0;
    
    if (punch.time_in && punch.time_out) {
      const timeIn = new Date(`1970-01-01T${punch.time_in}`);
      const timeOut = new Date(`1970-01-01T${punch.time_out}`);
      
      let totalMinutes = (timeOut.getTime() - timeIn.getTime()) / 60000 - (punch.lunch_minutes || 0);
      if (totalMinutes < 0) totalMinutes += 24 * 60; // Handle time crossing midnight
      
      const totalHours = totalMinutes / 60;
      
      // For MVP, apply anything over 8 hours as overtime
      // In a real implementation, this would track weekly hours per employee
      regHours = Math.min(8, totalHours);
      otHours = Math.max(0, totalHours - 8);
    }
    
    // Get all hours types
    const ptoHours = punch.pto_hours || 0;
    const holidayWorkedHours = punch.holiday_worked_hours || 0;
    const holidayNonWorkedHours = punch.holiday_non_worked_hours || 0;
    const miscHours = punch.misc_hours || 0;
    
    // Calculate pay for each type of hours
    const regPay = regHours * employee.rate;
    const otPay = otHours * employee.rate * 1.5;
    const ptoPay = ptoHours * employee.rate;
    const holidayWorkedPay = holidayWorkedHours * employee.rate * holidayRateMultiplier;
    const holidayNonWorkedPay = holidayNonWorkedHours * employee.rate;
    const miscHoursPay = miscHours * employee.rate; // Assume regular rate for misc hours
    
    // Calculate reimbursements
    const mileagePay = (punch.miles || 0) * mileageRate;
    const miscReimbursement = punch.misc_reimbursement || 0;
    
    // Calculate total pay
    const hourlyPay = regPay + otPay + ptoPay + holidayWorkedPay + holidayNonWorkedPay + miscHoursPay;
    const totalPay = hourlyPay + mileagePay + miscReimbursement;
    
    // Check for existing payroll calculation
    let existing: PayrollCalc | undefined;
    for (const calc of this.payroll_calcs.values()) {
      if (calc.punch_id === punch_id) {
        existing = calc;
        break;
      }
    }
    
    if (existing) {
      // Update existing
      const updated: PayrollCalc = {
        ...existing,
        reg_hours: regHours,
        ot_hours: otHours,
        pto_hours: ptoHours,
        holiday_worked_hours: holidayWorkedHours,
        holiday_non_worked_hours: holidayNonWorkedHours,
        misc_hours: miscHours,
        reg_pay: regPay,
        ot_pay: otPay,
        pto_pay: ptoPay,
        holiday_worked_pay: holidayWorkedPay,
        holiday_non_worked_pay: holidayNonWorkedPay,
        misc_hours_pay: miscHoursPay,
        pay: hourlyPay,
        mileage_pay: mileagePay,
        misc_reimbursement: miscReimbursement,
        total_pay: totalPay,
        calculated_at: new Date()
      };
      this.payroll_calcs.set(existing.id, updated);
      return updated;
    } else {
      // Create new
      const id = this.payrollCalcId++;
      const calc: PayrollCalc = {
        id,
        punch_id,
        reg_hours: regHours,
        ot_hours: otHours,
        pto_hours: ptoHours,
        holiday_worked_hours: holidayWorkedHours,
        holiday_non_worked_hours: holidayNonWorkedHours,
        misc_hours: miscHours,
        reg_pay: regPay,
        ot_pay: otPay,
        pto_pay: ptoPay,
        holiday_worked_pay: holidayWorkedPay,
        holiday_non_worked_pay: holidayNonWorkedPay,
        misc_hours_pay: miscHoursPay,
        pay: hourlyPay,
        mileage_pay: mileagePay,
        misc_reimbursement: miscReimbursement,
        total_pay: totalPay,
        calculated_at: new Date()
      };
      this.payroll_calcs.set(id, calc);
      return calc;
    }
  }

  async getPayrollReport(from_date: Date, to_date: Date): Promise<Array<Punch & { employee: Employee, payroll: PayrollCalc }>> {
    // Get punches for the date range
    const punches = await this.getPunches({ from_date, to_date });
    
    // Collect payroll data
    const report: Array<Punch & { employee: Employee, payroll: PayrollCalc }> = [];
    
    for (const punch of punches) {
      const employee = this.employees.get(punch.employee_id);
      if (!employee) continue;
      
      // Find payroll calculation for this punch
      let payroll: PayrollCalc | undefined;
      for (const calc of this.payroll_calcs.values()) {
        if (calc.punch_id === punch.id) {
          payroll = calc;
          break;
        }
      }
      
      if (!payroll) {
        // Calculate on-the-fly if not found
        payroll = await this.calculatePayroll(punch.id);
      }
      
      report.push({
        ...punch,
        employee,
        payroll
      });
    }
    
    return report;
  }

  // Audit log methods
  async addAuditLog(insertLog: InsertAuditLog): Promise<AuditLog> {
    const id = this.auditLogId++;
    const log: AuditLog = {
      ...insertLog,
      id,
      changed_at: new Date()
    };
    this.audit_logs.set(id, log);
    return log;
  }

  async getAuditLogs(filter?: { table_name?: string, row_id?: number }): Promise<AuditLog[]> {
    let logs = Array.from(this.audit_logs.values());
    
    if (filter?.table_name) {
      logs = logs.filter(log => log.table_name === filter.table_name);
    }
    
    if (filter?.row_id !== undefined) {
      logs = logs.filter(log => log.row_id === filter.row_id);
    }
    
    return logs;
  }

  // Settings methods
  async getSetting(key: string): Promise<Setting | undefined> {
    return this.settings.get(key);
  }

  async updateSetting(key: string, value: string): Promise<Setting> {
    const existing = this.settings.get(key);
    
    if (existing) {
      const updated: Setting = {
        ...existing,
        value,
        updated_at: new Date()
      };
      this.settings.set(key, updated);
      return updated;
    } else {
      const id = this.settingId++;
      const setting: Setting = {
        id,
        key,
        value,
        updated_at: new Date()
      };
      this.settings.set(key, setting);
      return setting;
    }
  }
}

import { MultiCompanyStorage } from "./multi-company-storage";
import { DatabaseStorage } from "./db-storage";

export const storage = new MultiCompanyStorage();
