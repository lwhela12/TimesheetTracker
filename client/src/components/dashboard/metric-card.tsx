import React, { memo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { 
  ArrowDownIcon, 
  ArrowUpIcon, 
  CheckCircleIcon 
} from "lucide-react";

type MetricCardProps = {
  title: string;
  value: string | number;
  trend?: number;
  trendLabel?: string;
  icon: React.ReactNode;
  iconBgColor: string;
  iconColor: string;
};

function MetricCard({
  title,
  value,
  trend,
  trendLabel,
  icon,
  iconBgColor,
  iconColor,
}: MetricCardProps) {
  // Determine trend styling
  let TrendIcon = null;
  let trendColorClass = "text-neutral-500";
  
  if (trend !== undefined && trend !== 0) {
    if (trend > 0) {
      TrendIcon = ArrowUpIcon;
      trendColorClass = title.includes("Mileage") ? "text-red-600" : "text-green-600";
    } else {
      TrendIcon = ArrowDownIcon;
      trendColorClass = title.includes("Overtime") ? "text-green-600" : "text-red-600";
    }
  } else {
    TrendIcon = CheckCircleIcon;
  }

  return (
    <Card className="border border-neutral-100 shadow-sm">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-neutral-500 mb-1">{title}</p>
            <h3 className="text-2xl font-semibold text-neutral-900">{value}</h3>
            <p className={`text-sm ${trendColorClass} flex items-center mt-1`}>
              {TrendIcon && <TrendIcon className="mr-1 h-4 w-4" />}
              <span>{trendLabel || (trend ? `${trend > 0 ? "+" : ""}${trend.toFixed(1)}% vs last period` : "No change")}</span>
            </p>
          </div>
          <div className={`${iconBgColor} p-3 rounded-full`}>
            <div className={`${iconColor} h-5 w-5`}>{icon}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default memo(MetricCard);
