"use client";

import { cn } from "@/lib/utils";

type ButtonVariant =
  | "primary"
  | "secondary"
  | "light"
  | "success"
  | "warning"
  | "danger"
  | "neutral";

const buttonBaseClass =
  "inline-flex min-h-11 min-w-[11rem] items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-center text-sm font-semibold leading-none shadow-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-60";

const buttonVariantClass: Record<ButtonVariant, string> = {
  primary: "border-indigo-600 bg-indigo-600 text-white hover:bg-indigo-500 hover:border-indigo-500",
  secondary: "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-400",
  light: "border-white/20 bg-white text-slate-900 hover:bg-slate-100",
  success: "border-emerald-500 bg-emerald-500 text-white hover:bg-emerald-400 hover:border-emerald-400",
  warning: "border-amber-500 bg-amber-500 text-white hover:bg-amber-400 hover:border-amber-400",
  danger: "border-rose-500 bg-rose-500 text-white hover:bg-rose-400 hover:border-rose-400",
  neutral: "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 hover:border-slate-300",
};

const iconButtonBaseClass =
  "inline-flex h-11 w-11 min-h-11 min-w-11 items-center justify-center rounded-xl border shadow-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-60";

export function getEmployeeButtonClass(
  variant: ButtonVariant = "primary",
  className?: string
) {
  return cn(buttonBaseClass, buttonVariantClass[variant], className);
}

export function getEmployeeIconButtonClass(
  variant: ButtonVariant = "neutral",
  className?: string
) {
  return cn(iconButtonBaseClass, buttonVariantClass[variant], className);
}

export const employeeButtonGroupClass = "flex flex-col gap-3 sm:flex-row sm:flex-wrap";
