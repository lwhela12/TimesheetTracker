import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatTime(time: string): string {
  if (!time) return "";
  const [hours, minutes] = time.split(":");
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const formattedHour = hour % 12 || 12;
  return `${formattedHour}:${minutes} ${ampm}`;
}

export function getInitials(firstName: string, lastName: string): string {
  return (firstName.charAt(0) + lastName.charAt(0)).toUpperCase();
}

export function calculateHoursWorked(
  timeIn: string,
  timeOut: string,
  lunchMinutes: number = 0
): number {
  if (!timeIn || !timeOut) return 0;
  
  const inTime = new Date(`1970-01-01T${timeIn}`);
  const outTime = new Date(`1970-01-01T${timeOut}`);
  
  let diffMinutes = (outTime.getTime() - inTime.getTime()) / 60000 - lunchMinutes;
  if (diffMinutes < 0) diffMinutes += 24 * 60; // Handle overnight shifts
  
  return diffMinutes / 60;
}
