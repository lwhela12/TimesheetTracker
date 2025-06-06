import React, { memo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

type WeeklyPayrollData = {
  weekStart: string;
  weekEnd: string;
  regularPay: number;
  overtimePay: number;
  mileagePay: number;
  totalPay: number;
};

type PayrollChartProps = {
  data: WeeklyPayrollData[];
  onPeriodChange: (period: string) => void;
  onExport: () => void;
};

function PayrollChart({
  data,
  onPeriodChange,
  onExport,
}: PayrollChartProps) {
  // Format data labels to be more readable
  const formattedData = data.map(week => {
    const startDate = new Date(week.weekStart);
    return {
      ...week,
      week: `Week ${startDate.getMonth() + 1}/${startDate.getDate()}`,
    };
  }).reverse(); // Most recent week last

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <Card className="border border-neutral-100 shadow-sm">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-neutral-800">Weekly Payroll</h3>
          <div className="flex space-x-2">
            <Select defaultValue="4weeks" onValueChange={onPeriodChange}>
              <SelectTrigger className="w-[150px] h-8 text-sm">
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="4weeks">Last 4 Weeks</SelectItem>
                <SelectItem value="quarter">Last Quarter</SelectItem>
                <SelectItem value="year">Last Year</SelectItem>
              </SelectContent>
            </Select>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 text-neutral-500 hover:text-neutral-700"
              onClick={onExport}
            >
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={formattedData}
              margin={{
                top: 5,
                right: 10,
                left: 10,
                bottom: 5,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="week" />
              <YAxis 
                tickFormatter={formatCurrency}
              />
              <Tooltip 
                formatter={(value) => [formatCurrency(value as number), ""]}
                labelFormatter={(label) => `Week of ${label}`}
              />
              <Legend />
              <Bar 
                name="Regular Pay"
                dataKey="regularPay" 
                fill="hsl(var(--primary))" 
                barSize={20}
              />
              <Bar 
                name="Overtime Pay"
                dataKey="overtimePay" 
                fill="#f59e0b" 
                barSize={20}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

export default memo(PayrollChart);
