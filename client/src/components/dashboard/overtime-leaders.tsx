import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

type OvertimeLeader = {
  employee: {
    id: number;
    first_name: string;
    last_name: string;
    rate: number;
  };
  total_ot_hours: number;
  total_ot_pay: number;
};

type OvertimeLeadersProps = {
  leaders: OvertimeLeader[];
  onViewAll: () => void;
};

export default function OvertimeLeaders({ leaders, onViewAll }: OvertimeLeadersProps) {
  // Function to get initials from name
  const getInitials = (firstName: string, lastName: string) => {
    return (firstName.charAt(0) + lastName.charAt(0)).toUpperCase();
  };

  // Function to get random background color based on name
  const getAvatarColor = (name: string) => {
    const colors = [
      "bg-primary-100 text-primary-700",
      "bg-amber-100 text-amber-700",
      "bg-green-100 text-green-700",
      "bg-indigo-100 text-indigo-700",
      "bg-red-100 text-red-700",
    ];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <Card className="border border-neutral-100 shadow-sm">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-neutral-800">Overtime Leaders</h3>
          <Button 
            variant="link" 
            className="text-primary text-sm p-0 h-auto"
            onClick={onViewAll}
          >
            View All
          </Button>
        </div>
        <div className="space-y-4">
          {leaders.length === 0 ? (
            <p className="text-neutral-500 text-sm text-center py-8">
              No overtime recorded in this period
            </p>
          ) : (
            leaders.map((leader) => {
              const fullName = `${leader.employee.first_name} ${leader.employee.last_name}`;
              const avatarColor = getAvatarColor(fullName);
              return (
                <div 
                  key={leader.employee.id}
                  className="flex items-center p-2 hover:bg-neutral-50 rounded-md"
                >
                  <div className="flex-shrink-0 mr-3">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className={avatarColor}>
                        {getInitials(leader.employee.first_name, leader.employee.last_name)}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-neutral-900 truncate">
                      {fullName}
                    </p>
                    <p className="text-xs text-neutral-500 truncate">
                      ${leader.employee.rate.toFixed(2)}/hr
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-neutral-900">
                      {leader.total_ot_hours.toFixed(1)}h
                    </p>
                    <p className="text-xs text-neutral-500">
                      {formatCurrency(leader.total_ot_pay)}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}
