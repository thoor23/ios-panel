import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format number as Indian Rupees (e.g. ₹1,00,000) */
export function formatINR(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '₹0';
  return '₹' + value.toLocaleString('en-IN');
}
