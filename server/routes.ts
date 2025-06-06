import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { z } from "zod";
import { insertEmployeeSchema, insertPunchSchema, punches, employees, settings } from "@shared/schema";
import { db } from "./db";
import { and, gte, lte, eq } from "drizzle-orm";

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication routes
  setupAuth(app);

  // Employee routes
  app.get("/api/employees", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const filter: { active?: boolean; searchQuery?: string; page?: number; limit?: number } = {};
      if (req.query.active !== undefined) filter.active = req.query.active === 'true';
      if (req.query.searchQuery) filter.searchQuery = String(req.query.searchQuery);
      if (req.query.page) filter.page = parseInt(req.query.page as string, 10);
      if (req.query.limit) filter.limit = parseInt(req.query.limit as string, 10);
      const employees = await storage.getEmployees(req.user.company_id, filter);
      res.json(employees);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch employees" });
    }
  });

  app.get("/api/employees/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const employee = await storage.getEmployee(Number(req.params.id), req.user.company_id);
      if (!employee) {
        return res.status(404).json({ message: "Employee not found" });
      }
      res.json(employee);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch employee" });
    }
  });

  app.post("/api/employees", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const validatedData = insertEmployeeSchema.parse({
        ...req.body,
        company_id: req.user.company_id
      });
      const newEmployee = await storage.createEmployee(validatedData);
      
      // Log audit
      if (req.user) {
        await storage.addAuditLog({
          table_name: "employees",
          row_id: newEmployee.id,
          changed_by: req.user.id,
          field: "all",
          old_val: null,
          new_val: JSON.stringify(newEmployee)
        });
      }
      
      res.status(201).json(newEmployee);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid employee data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create employee" });
    }
  });

  app.put("/api/employees/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const id = Number(req.params.id);
      const existingEmployee = await storage.getEmployee(id, req.user.company_id);
      
      if (!existingEmployee) {
        return res.status(404).json({ message: "Employee not found" });
      }
      
      const validatedData = insertEmployeeSchema.partial().parse(req.body);
      const updatedEmployee = await storage.updateEmployee(id, validatedData, req.user.company_id);
      
      // Log audit for each changed field
      if (req.user && updatedEmployee) {
        for (const [key, value] of Object.entries(validatedData)) {
          if (existingEmployee[key as keyof typeof existingEmployee] !== value) {
            await storage.addAuditLog({
              table_name: "employees",
              row_id: id,
              changed_by: req.user.id,
              field: key,
              old_val: String(existingEmployee[key as keyof typeof existingEmployee]),
              new_val: String(value)
            });
          }
        }
      }
      
      res.json(updatedEmployee);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid employee data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update employee" });
    }
  });

  app.delete("/api/employees/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const id = Number(req.params.id);
      const existingEmployee = await storage.getEmployee(id, req.user.company_id);
      
      if (!existingEmployee) {
        return res.status(404).json({ message: "Employee not found" });
      }
      
      await storage.deleteEmployee(id, req.user.company_id);
      
      // Log audit
      if (req.user) {
        await storage.addAuditLog({
          table_name: "employees",
          row_id: id,
          changed_by: req.user.id,
          field: "active",
          old_val: String(existingEmployee.active),
          new_val: "false"
        });
      }
      
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete employee" });
    }
  });

  // Punch (timesheet) routes
  app.get("/api/punches", async (req, res) => {
    try {
      const filter: {
        employee_id?: number;
        from_date?: Date;
        to_date?: Date;
        status?: string;
        searchQuery?: string;
        page?: number;
        limit?: number;
      } = {};
      
      if (req.query.employee_id) {
        filter.employee_id = Number(req.query.employee_id);
      }
      
      if (req.query.from_date) {
        filter.from_date = new Date(req.query.from_date as string);
      }
      
      if (req.query.to_date) {
        filter.to_date = new Date(req.query.to_date as string);
      }
      
      if (req.query.status) {
        filter.status = req.query.status as string;
      }

      if (req.query.searchQuery) filter.searchQuery = String(req.query.searchQuery);
      if (req.query.page) filter.page = parseInt(req.query.page as string, 10);
      if (req.query.limit) filter.limit = parseInt(req.query.limit as string, 10);

      const punches = await storage.getPunches(req.user.company_id, filter);
      
      // Enrich punch data with employee info
      const enrichedPunches = await Promise.all(
        punches.map(async (punch) => {
          const employee = await storage.getEmployee(punch.employee_id, req.user.company_id);
          return {
            ...punch,
            employee: employee || { id: punch.employee_id, first_name: "Unknown", last_name: "Employee" }
          };
        })
      );
      
      res.json(enrichedPunches);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch timesheet entries" });
    }
  });

  app.get("/api/punches/:id", async (req, res) => {
    try {
      const punch = await storage.getPunch(Number(req.params.id), req.user!.company_id);
      if (!punch) {
        return res.status(404).json({ message: "Timesheet entry not found" });
      }
      
      const employee = await storage.getEmployee(punch.employee_id, req.user!.company_id);
      
      // Find payroll calculation for this punch
      let payroll = null;
      try {
        payroll = await storage.calculatePayroll(punch.id);
      } catch (error) {
        // If calculation fails, proceed without it
      }
      
      res.json({
        ...punch,
        employee: employee || { id: punch.employee_id, first_name: "Unknown", last_name: "Employee" },
        payroll
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch timesheet entry" });
    }
  });

  app.post("/api/punches", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const validatedData = insertPunchSchema.parse({
        ...req.body,
        created_by: req.user.id
      });
      
      const newPunch = await storage.createPunch(validatedData);
      
      // Calculate payroll
      const payroll = await storage.calculatePayroll(newPunch.id);
      
      // Log audit
      await storage.addAuditLog({
        table_name: "punches",
        row_id: newPunch.id,
        changed_by: req.user.id,
        field: "all",
        old_val: null,
        new_val: JSON.stringify(newPunch)
      });
      
      res.status(201).json({ ...newPunch, payroll });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid timesheet data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create timesheet entry" });
    }
  });
  
  // Batch create punches (for weekly entry)
  app.post("/api/punches/batch", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      // Validate that entries is an array
      if (!Array.isArray(req.body.entries)) {
        return res.status(400).json({ message: "Entries must be an array" });
      }
      
      const results = [];
      const errors = [];
      
      // Process each entry
      for (const entry of req.body.entries) {
        try {
          // Ensure miles is not null
          const entryWithDefaults = {
            ...entry,
            miles: entry.miles ?? 0,
            created_by: req.user.id
          };
          
          const validatedData = insertPunchSchema.parse(entryWithDefaults);
          
          const newPunch = await storage.createPunch(validatedData);
          
          // Calculate payroll
          const payroll = await storage.calculatePayroll(newPunch.id);
          
          // Log audit
          await storage.addAuditLog({
            table_name: "punches",
            row_id: newPunch.id,
            changed_by: req.user.id,
            field: "all",
            old_val: null,
            new_val: JSON.stringify(newPunch)
          });
          
          results.push({ ...newPunch, payroll });
        } catch (error) {
          if (error instanceof z.ZodError) {
            errors.push({ entry, errors: error.errors });
          } else {
            errors.push({ entry, message: "Failed to process entry" });
          }
        }
      }
      
      res.status(201).json({ 
        success: results.length > 0,
        message: `Created ${results.length} timesheet entries${errors.length > 0 ? ` with ${errors.length} errors` : ''}`,
        results,
        errors: errors.length > 0 ? errors : undefined
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to process batch timesheet entries" });
    }
  });

  app.put("/api/punches/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const id = Number(req.params.id);
      const existingPunch = await storage.getPunch(id, req.user!.company_id);
      
      if (!existingPunch) {
        return res.status(404).json({ message: "Timesheet entry not found" });
      }
      
      const validatedData = insertPunchSchema.partial().parse(req.body);
      const updatedPunch = await storage.updatePunch(id, validatedData, req.user!.company_id);
      
      // Recalculate payroll
      const payroll = await storage.calculatePayroll(id);
      
      // Log audit for each changed field
      for (const [key, value] of Object.entries(validatedData)) {
        if (existingPunch[key as keyof typeof existingPunch] !== value) {
          await storage.addAuditLog({
            table_name: "punches",
            row_id: id,
            changed_by: req.user.id,
            field: key,
            old_val: String(existingPunch[key as keyof typeof existingPunch]),
            new_val: String(value)
          });
        }
      }
      
      res.json({ ...updatedPunch, payroll });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid timesheet data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update timesheet entry" });
    }
  });

  app.delete("/api/punches/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const id = Number(req.params.id);
      const existingPunch = await storage.getPunch(id, req.user!.company_id);
      
      if (!existingPunch) {
        return res.status(404).json({ message: "Timesheet entry not found" });
      }
      
      await storage.deletePunch(id, req.user!.company_id);
      
      // Log audit
      await storage.addAuditLog({
        table_name: "punches",
        row_id: id,
        changed_by: req.user.id,
        field: "all",
        old_val: JSON.stringify(existingPunch),
        new_val: null
      });
      
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete timesheet entry" });
    }
  });

  // Reports
  app.get("/api/reports/payroll", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      if (!req.query.from_date || !req.query.to_date) {
        return res.status(400).json({ message: "from_date and to_date parameters are required" });
      }
      
      const fromDate = new Date(req.query.from_date as string);
      const toDate = new Date(req.query.to_date as string);
      
      const report = await storage.getPayrollReport(req.user!.company_id, fromDate, toDate);
      
      // Format for CSV if requested
      if (req.query.format === 'csv') {
        let csv = 'Date,Employee,Regular Hours,Overtime Hours,Regular Pay,Overtime Pay,Mileage Pay,Total Pay\n';
        
        for (const entry of report) {
          const regPay = entry.payroll.pay - (entry.payroll.ot_hours * entry.employee.rate * 1.5);
          const otPay = entry.payroll.ot_hours * entry.employee.rate * 1.5;
          
          csv += [
            entry.date,
            `${entry.employee.first_name} ${entry.employee.last_name}`,
            entry.payroll.reg_hours,
            entry.payroll.ot_hours,
            regPay.toFixed(2),
            otPay.toFixed(2),
            entry.payroll.mileage_pay.toFixed(2),
            (entry.payroll.pay + entry.payroll.mileage_pay).toFixed(2)
          ].join(',') + '\n';
        }
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="payroll-${fromDate.toISOString().split('T')[0]}-to-${toDate.toISOString().split('T')[0]}.csv"`);
        return res.send(csv);
      }
      
      res.json(report);
    } catch (error) {
      res.status(500).json({ message: "Failed to generate payroll report" });
    }
  });

  app.get("/api/reports/overtime", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      if (!req.query.from_date || !req.query.to_date) {
        return res.status(400).json({ message: "from_date and to_date parameters are required" });
      }
      
      const fromDate = new Date(req.query.from_date as string);
      const toDate = new Date(req.query.to_date as string);
      
      const report = await storage.getPayrollReport(req.user!.company_id, fromDate, toDate);
      
      // Group by employee and sum up overtime
      const overtimeByEmployee: Record<number, {
        employee: typeof report[0]['employee'],
        total_ot_hours: number,
        total_ot_pay: number
      }> = {};
      
      for (const entry of report) {
        if (!overtimeByEmployee[entry.employee.id]) {
          overtimeByEmployee[entry.employee.id] = {
            employee: entry.employee,
            total_ot_hours: 0,
            total_ot_pay: 0
          };
        }
        
        overtimeByEmployee[entry.employee.id].total_ot_hours += entry.payroll.ot_hours;
        overtimeByEmployee[entry.employee.id].total_ot_pay += entry.payroll.ot_hours * entry.employee.rate * 1.5;
      }
      
      // Convert to array and sort by overtime hours
      const overtimeLeaders = Object.values(overtimeByEmployee)
        .sort((a, b) => b.total_ot_hours - a.total_ot_hours);
      
      res.json(overtimeLeaders);
    } catch (error) {
      res.status(500).json({ message: "Failed to generate overtime report" });
    }
  });

  app.get("/api/reports/dashboard", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      // Default to current week if not specified
      const today = new Date();
      const dayOfWeek = today.getDay();
      const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      
      const mondayThisWeek = new Date(today);
      mondayThisWeek.setDate(today.getDate() - diffToMonday);
      mondayThisWeek.setHours(0, 0, 0, 0);
      
      const sundayThisWeek = new Date(mondayThisWeek);
      sundayThisWeek.setDate(mondayThisWeek.getDate() + 6);
      sundayThisWeek.setHours(23, 59, 59, 999);
      
      // Get last 4 weeks for trend
      const fourWeeksAgo = new Date(mondayThisWeek);
      fourWeeksAgo.setDate(mondayThisWeek.getDate() - 28);

      const mondayLastWeek = new Date(mondayThisWeek);
      mondayLastWeek.setDate(mondayThisWeek.getDate() - 7);
      const sundayLastWeek = new Date(mondayLastWeek);
      sundayLastWeek.setDate(mondayLastWeek.getDate() + 6);
      sundayLastWeek.setHours(23, 59, 59, 999);
      
      const rows = await db.select({ punch: punches, employee: employees })
        .from(punches)
        .innerJoin(employees, eq(punches.employee_id, employees.id))
        .where(and(
          eq(employees.company_id, req.user.company_id),
          gte(punches.date, fourWeeksAgo.toISOString().split('T')[0]),
          lte(punches.date, sundayThisWeek.toISOString().split('T')[0])
        ));

      const thisWeekReport: Array<any> = [];
      const lastWeekReport: Array<any> = [];
      const weeklyDataMap: Record<string, { regularPay: number; overtimePay: number; mileagePay: number; }> = {};

      const [mileageRateSetting] = await db.select().from(settings)
        .where(and(eq(settings.company_id, req.user.company_id), eq(settings.key, 'mileage_rate')));
      const [otThresholdSetting] = await db.select().from(settings)
        .where(and(eq(settings.company_id, req.user.company_id), eq(settings.key, 'ot_threshold')));
      const mileageRate = parseFloat(mileageRateSetting?.value || '0.30');
      const otThreshold = parseFloat(otThresholdSetting?.value || '8');

      for (const row of rows) {
        const punch = row.punch;
        const employee = row.employee;
        const dateObj = new Date(punch.date);
        const weekStart = new Date(dateObj);
        weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() || 7) - 1));

        const timeIn = new Date(`1970-01-01T${punch.time_in}`);
        const timeOut = new Date(`1970-01-01T${punch.time_out}`);
        const workedMinutes = (timeOut.getTime() - timeIn.getTime()) / 60000 - (punch.lunch_minutes || 0);
        const workedHours = workedMinutes / 60;
        const regHours = Math.min(workedHours, otThreshold);
        const otHours = Math.max(0, workedHours - otThreshold);

        const regPay = regHours * employee.rate;
        const otPay = otHours * employee.rate * 1.5;
        const mileagePay = (punch.miles || 0) * mileageRate;

        const entryData = {
          employee,
          payroll: { ot_hours: otHours, pay: regPay + otPay, mileage_pay: mileagePay },
          miles: punch.miles || 0
        };

        if (dateObj >= mondayThisWeek && dateObj <= sundayThisWeek) {
          thisWeekReport.push(entryData);
        } else if (dateObj >= mondayLastWeek && dateObj <= sundayLastWeek) {
          lastWeekReport.push(entryData);
        }

        const key = weekStart.toISOString().split('T')[0];
        if (!weeklyDataMap[key]) {
          weeklyDataMap[key] = { regularPay: 0, overtimePay: 0, mileagePay: 0 };
        }
        weeklyDataMap[key].regularPay += regPay;
        weeklyDataMap[key].overtimePay += otPay;
        weeklyDataMap[key].mileagePay += mileagePay;
      }

      const weeklyData = Object.entries(weeklyDataMap).map(([weekStart, vals]) => {
        const start = new Date(weekStart);
        const weekEnd = new Date(start);
        weekEnd.setDate(start.getDate() + 6);
        return {
          weekStart,
          weekEnd: weekEnd.toISOString().split('T')[0],
          ...vals,
          totalPay: vals.regularPay + vals.overtimePay + vals.mileagePay
        };
      }).sort((a, b) => new Date(b.weekStart).getTime() - new Date(a.weekStart).getTime()).slice(0,4);
      
      // Get active employees count
      const activeEmployees = await storage.getEmployees(req.user.company_id, { active: true });
      
      // Calculate metrics
      const totalPayThisWeek = thisWeekReport.reduce((sum, entry) => 
        sum + entry.payroll.pay + entry.payroll.mileage_pay, 0);
      
      const totalPayLastWeek = lastWeekReport.reduce((sum, entry) => 
        sum + entry.payroll.pay + entry.payroll.mileage_pay, 0);
      
      const totalOTHoursThisWeek = thisWeekReport.reduce((sum, entry) => 
        sum + entry.payroll.ot_hours, 0);
      
      const totalOTHoursLastWeek = lastWeekReport.reduce((sum, entry) => 
        sum + entry.payroll.ot_hours, 0);
      
      const totalMilesThisWeek = thisWeekReport.reduce((sum, entry) => 
        sum + (entry.miles || 0), 0);
      
      const totalMilesLastWeek = lastWeekReport.reduce((sum, entry) => 
        sum + (entry.miles || 0), 0);
      
      // Calculate trends (as percentages)
      const payTrend = totalPayLastWeek === 0 ? 0 : 
        ((totalPayThisWeek - totalPayLastWeek) / totalPayLastWeek) * 100;
      
      const otHoursTrend = totalOTHoursLastWeek === 0 ? 0 : 
        ((totalOTHoursThisWeek - totalOTHoursLastWeek) / totalOTHoursLastWeek) * 100;
      
      const milesTrend = totalMilesLastWeek === 0 ? 0 : 
        ((totalMilesThisWeek - totalMilesLastWeek) / totalMilesLastWeek) * 100;
      
      // Get overtime leaders
      const overtimeByEmployee: Record<number, {
        employee: typeof thisWeekReport[0]['employee'],
        total_ot_hours: number,
        total_ot_pay: number
      }> = {};
      
      for (const entry of thisWeekReport) {
        if (entry.payroll.ot_hours === 0) continue;
        
        if (!overtimeByEmployee[entry.employee.id]) {
          overtimeByEmployee[entry.employee.id] = {
            employee: entry.employee,
            total_ot_hours: 0,
            total_ot_pay: 0
          };
        }
        
        overtimeByEmployee[entry.employee.id].total_ot_hours += entry.payroll.ot_hours;
        overtimeByEmployee[entry.employee.id].total_ot_pay += entry.payroll.ot_hours * entry.employee.rate * 1.5;
      }
      
      // Convert to array and sort by overtime hours
      const overtimeLeaders = Object.values(overtimeByEmployee)
        .sort((a, b) => b.total_ot_hours - a.total_ot_hours)
        .slice(0, 5); // Top 5
      
      // Get recent timesheet entries
      const recentEntries = await storage.getPunches(req.user.company_id, { limit: 5, page: 1 });
      recentEntries.sort((a, b) => {
        return new Date(b.created_at || new Date()).getTime() - new Date(a.created_at || new Date()).getTime();
      });

      const enrichedRecentEntries = await Promise.all(
        recentEntries.map(async (punch) => {
          const employee = await storage.getEmployee(punch.employee_id, req.user.company_id);
          let payroll;
          try {
            payroll = await storage.calculatePayroll(punch.id);
          } catch (e) {
            payroll = null;
          }
          return {
            ...punch,
            employee: employee || { id: punch.employee_id, first_name: "Unknown", last_name: "Employee" },
            payroll
          };
        })
      );
      
      res.json({
        metrics: {
          totalPayroll: totalPayThisWeek,
          payrollTrend: payTrend,
          overtimeHours: totalOTHoursThisWeek,
          overtimeTrend: otHoursTrend,
          totalMileage: totalMilesThisWeek,
          mileageTrend: milesTrend,
          activeEmployees: activeEmployees.length
        },
        weeklyPayrollData: weeklyData,
        overtimeLeaders,
        recentEntries: enrichedRecentEntries
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to generate dashboard data" });
    }
  });

  // Payroll period endpoint
  app.get("/api/payroll/period", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      if (!req.query.start_date || !req.query.end_date) {
        return res.status(400).json({ message: "start_date and end_date parameters are required" });
      }

      const startDate = new Date(req.query.start_date as string);
      const endDate = new Date(req.query.end_date as string);

      // Get all active employees
      const employees = await storage.getEmployees(req.user.company_id, { active: true });

      // Get all punches for the period
      const punches = await storage.getPunches(req.user.company_id, {
        from_date: startDate,
        to_date: endDate
      });

      // Calculate payroll summary for each employee
      const payrollSummaries = await Promise.all(
        employees.map(async (employee) => {
          const employeePunches = punches.filter(p => p.employee_id === employee.id);
          
          let totalHours = 0;
          let ptoHours = 0;
          let holidayWorkedHours = 0;
          let holidayNonWorkedHours = 0;
          let overtimeHours = 0;
          let totalMiles = 0;
          let miscReimbursement = 0;
          let regularPay = 0;
          let overtimePay = 0;
          let ptoPay = 0;
          let holidayPay = 0;
          let mileagePay = 0;
          let totalPay = 0;

          if (employeePunches.length > 0) {
            for (const punch of employeePunches) {
              try {
                const payroll = await storage.calculatePayroll(punch.id);
                
                totalHours += payroll.reg_hours + payroll.ot_hours;
                ptoHours += payroll.pto_hours || 0;
                holidayWorkedHours += payroll.holiday_worked_hours || 0;
                holidayNonWorkedHours += payroll.holiday_non_worked_hours || 0;
                overtimeHours += payroll.ot_hours;
                totalMiles += punch.miles;
                miscReimbursement += payroll.misc_reimbursement || 0;
                regularPay += payroll.reg_pay;
                overtimePay += payroll.ot_pay;
                ptoPay += payroll.pto_pay || 0;
                holidayPay += payroll.holiday_worked_pay || 0;
                mileagePay += payroll.mileage_pay;
                totalPay += payroll.total_pay;
              } catch (error) {
                // Skip if payroll calculation fails
              }
            }
          }

          return {
            employee_id: employee.id,
            employee,
            total_hours: totalHours,
            pto_hours: ptoHours,
            holiday_worked_hours: holidayWorkedHours,
            holiday_non_worked_hours: holidayNonWorkedHours,
            overtime_hours: overtimeHours,
            total_miles: totalMiles,
            misc_reimbursement: miscReimbursement,
            regular_pay: regularPay,
            overtime_pay: overtimePay,
            pto_pay: ptoPay,
            holiday_pay: holidayPay,
            mileage_pay: mileagePay,
            total_pay: totalPay,
            has_entries: employeePunches.length > 0
          };
        })
      );

      res.json({
        start_date: req.query.start_date,
        end_date: req.query.end_date,
        employees: payrollSummaries
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch payroll period data" });
    }
  });

  // Payroll export endpoint
  app.get("/api/payroll/export", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      if (!req.query.start_date || !req.query.end_date) {
        return res.status(400).json({ message: "start_date and end_date parameters are required" });
      }

      const startDate = new Date(req.query.start_date as string);
      const endDate = new Date(req.query.end_date as string);

      // Get all active employees
      const employees = await storage.getEmployees(req.user.company_id, { active: true });

      // Get all punches for the period
      const punches = await storage.getPunches(req.user.company_id, {
        from_date: startDate,
        to_date: endDate
      });

      // Create Excel-like CSV data
      let csvContent = 'Employee Name,Total Hours,PTO Hours,Holiday Worked,Holiday Non-Worked,Overtime Hours,Miles,Reimbursements,Regular Pay,Overtime Pay,PTO Pay,Holiday Pay,Mileage Pay,Total Pay\n';

      for (const employee of employees) {
        const employeePunches = punches.filter(p => p.employee_id === employee.id);
        
        let totalHours = 0;
        let ptoHours = 0;
        let holidayWorkedHours = 0;
        let holidayNonWorkedHours = 0;
        let overtimeHours = 0;
        let totalMiles = 0;
        let miscReimbursement = 0;
        let regularPay = 0;
        let overtimePay = 0;
        let ptoPay = 0;
        let holidayPay = 0;
        let mileagePay = 0;
        let totalPay = 0;

        if (employeePunches.length > 0) {
          for (const punch of employeePunches) {
            try {
              const payroll = await storage.calculatePayroll(punch.id);
              
              totalHours += payroll.reg_hours + payroll.ot_hours;
              ptoHours += payroll.pto_hours || 0;
              holidayWorkedHours += payroll.holiday_worked_hours || 0;
              holidayNonWorkedHours += payroll.holiday_non_worked_hours || 0;
              overtimeHours += payroll.ot_hours;
              totalMiles += punch.miles;
              miscReimbursement += payroll.misc_reimbursement || 0;
              regularPay += payroll.reg_pay;
              overtimePay += payroll.ot_pay;
              ptoPay += payroll.pto_pay || 0;
              holidayPay += payroll.holiday_worked_pay || 0;
              mileagePay += payroll.mileage_pay;
              totalPay += payroll.total_pay;
            } catch (error) {
              // Skip if payroll calculation fails
            }
          }
        }

        csvContent += [
          `"${employee.first_name} ${employee.last_name}"`,
          totalHours.toFixed(2),
          ptoHours.toFixed(2),
          holidayWorkedHours.toFixed(2),
          holidayNonWorkedHours.toFixed(2),
          overtimeHours.toFixed(2),
          totalMiles.toFixed(2),
          miscReimbursement.toFixed(2),
          regularPay.toFixed(2),
          overtimePay.toFixed(2),
          ptoPay.toFixed(2),
          holidayPay.toFixed(2),
          mileagePay.toFixed(2),
          totalPay.toFixed(2)
        ].join(',') + '\n';
      }

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="payroll-${startDate.toISOString().split('T')[0]}-to-${endDate.toISOString().split('T')[0]}.csv"`);
      res.send(csvContent);
    } catch (error) {
      res.status(500).json({ message: "Failed to export payroll data" });
    }
  });

  // Settings
  app.get("/api/settings", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      // Only admin can view all settings
      if (req.user.role !== 'admin') {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      const mileageRate = await storage.getSetting(req.user.company_id, 'mileage_rate');
      const otThreshold = await storage.getSetting(req.user.company_id, 'ot_threshold');
      
      res.json({
        mileage_rate: mileageRate?.value || '0.30',
        ot_threshold: otThreshold?.value || '40'
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch settings" });
    }
  });

  app.put("/api/settings", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      // Only admin can update settings
      if (req.user.role !== 'admin') {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      const { mileage_rate, ot_threshold } = req.body;
      
      const updatedSettings: Record<string, any> = {};
      
      if (mileage_rate !== undefined) {
        const parsedRate = parseFloat(mileage_rate);
        if (isNaN(parsedRate) || parsedRate < 0) {
          return res.status(400).json({ message: "Invalid mileage rate" });
        }
        
        const updated = await storage.updateSetting(req.user.company_id, 'mileage_rate', String(parsedRate));
        updatedSettings.mileage_rate = updated;
      }
      
      if (ot_threshold !== undefined) {
        const parsedThreshold = parseFloat(ot_threshold);
        if (isNaN(parsedThreshold) || parsedThreshold < 0) {
          return res.status(400).json({ message: "Invalid overtime threshold" });
        }
        
        const updated = await storage.updateSetting(req.user.company_id, 'ot_threshold', String(parsedThreshold));
        updatedSettings.ot_threshold = updated;
      }
      
      res.json(updatedSettings);
    } catch (error) {
      res.status(500).json({ message: "Failed to update settings" });
    }
  });

  // Audit logs
  app.get("/api/audit-logs", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      // Only admin can view audit logs
      if (req.user.role !== 'admin') {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      const filter: { table_name?: string; row_id?: number } = {};
      
      if (req.query.table) {
        filter.table_name = req.query.table as string;
      }
      
      if (req.query.row_id) {
        filter.row_id = Number(req.query.row_id);
      }
      
      const logs = await storage.getAuditLogs(filter);
      
      // Enrich with user information
      const enrichedLogs = await Promise.all(
        logs.map(async (log) => {
          let user = null;
          if (log.changed_by) {
            user = await storage.getUser(log.changed_by);
          }
          return {
            ...log,
            changed_by_user: user ? { id: user.id, username: user.username } : null
          };
        })
      );
      
      res.json(enrichedLogs);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch audit logs" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
