"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, differenceInDays, eachDayOfInterval, isWeekend } from "date-fns";
// import { useRouter } from "next/navigation";
import { id } from "date-fns/locale";
import { useCallback, useEffect } from "react";
import { CalendarIcon } from "@heroicons/react/24/outline";

// UI components
import { Button } from "@/components/ui/button";
import { RangeCalendar } from "@heroui/react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@radix-ui/react-label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "react-hot-toast";
import { today, getLocalTimeZone, CalendarDate } from "@internationalized/date";

// Schema for form validation
const leaveFormSchema = z.object({
  startDate: z.date({
    required_error: "Tanggal mulai diperlukan",
  }),
  endDate: z.date({
    required_error: "Tanggal selesai diperlukan",
  }),
  type: z.enum(["SICK", "VACATION", "PERSONAL", "OTHER"], {
    required_error: "Jenis cuti diperlukan",
  }),
  reason: z.string().min(5, {
    message: "Alasan harus minimal 5 karakter",
  }),
}).refine((data) => {
  if (!data.startDate || !data.endDate) return true;
  const s = new Date(data.startDate);
  const e = new Date(data.endDate);
  s.setHours(0,0,0,0);
  e.setHours(0,0,0,0);
  return e >= s;
}, { message: "Tanggal selesai tidak boleh sebelum tanggal mulai", path: ["endDate"] });

type LeaveFormValues = z.infer<typeof leaveFormSchema>;

interface LeaveRequestFormProps {
  onLeaveSubmitted?: () => void; // Callback setelah permohonan berhasil dikirim
}

export default function LeaveRequestForm({ onLeaveSubmitted }: LeaveRequestFormProps) {
  // const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dateRange, setDateRange] = useState<{
    from: Date | null;
    to: Date | null;
  }>({
    from: null,
    to: null,
  });
  const [rangeValue, setRangeValue] = useState<{ start: CalendarDate; end: CalendarDate } | null>({
    start: today(getLocalTimeZone()),
    end: today(getLocalTimeZone()),
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
    reset,
  } = useForm<LeaveFormValues>({
    resolver: zodResolver(leaveFormSchema),
  });

  // Watch the start and end dates
  const startDate = watch("startDate");
  const endDate = watch("endDate");

  // Calculate leave duration
  const leaveDuration = startDate && endDate 
    ? differenceInDays(new Date(endDate), new Date(startDate)) + 1 
    : 0;
  const [validationError, setValidationError] = useState<string | null>(null);

  // Handle date selection
  const onDateSelect = (range: { from: Date; to: Date | null }) => {
    setDateRange(range);
    setValue("startDate", range.from);
    if (range.to) {
      setValue("endDate", range.to);
    } else {
      setValue("endDate", range.from);
    }
    const from = range.from;
    const to = range.to ?? range.from;
    const today = new Date();
    today.setHours(0,0,0,0);
    const maxWorkdays = 14;
    const intervalDays = eachDayOfInterval({ start: from, end: to });
    const holidaysSet = new Set(importantDates.map((d) => fmt(d)));
    const workdays = intervalDays.filter((d) => !isWeekend(d) && !holidaysSet.has(fmt(d))).length;
    if (to < from) {
      setValidationError("Tanggal selesai tidak boleh sebelum tanggal mulai");
    } else if (from < today) {
      setValidationError("Tanggal mulai tidak boleh di masa lalu");
    } else if (workdays <= 0) {
      setValidationError("Rentang yang dipilih tidak memiliki hari kerja");
    } else if (workdays > maxWorkdays) {
      setValidationError(`Maksimal ${maxWorkdays} hari kerja untuk cuti`);
    } else {
      setValidationError(null);
    }
  };

  // Submit handler
  const onSubmit = async (data: LeaveFormValues) => {
    setIsSubmitting(true);
    try {
      // Format dates to YYYY-MM-DD to avoid timezone issues
      const formattedData = {
        ...data,
        startDate: format(data.startDate, "yyyy-MM-dd"),
        endDate: format(data.endDate, "yyyy-MM-dd"),
      };

      const response = await fetch("/api/leave", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formattedData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Gagal mengirim permohonan cuti");
      }

      // Setelah berhasil, reset form
      reset();
      setDateRange({ from: null, to: null });
      
      // Tampilkan toast sukses
      toast.success("Permohonan cuti berhasil diajukan");
      
      // Panggil callback jika ada
      if (onLeaveSubmitted) {
        onLeaveSubmitted();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal mengirim permohonan cuti");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Format date for display
  const formatDate = (date: Date | null) => {
    if (!date) return "";
    return format(date, "d MMMM yyyy", { locale: id });
  };

  // Daftar tanggal penting (contoh libur nasional/aturan perusahaan)
  const [importantDates, setImportantDates] = useState<Date[]>([]);
  const [_importantInfo, setImportantInfo] = useState<Record<string, string>>({});
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const loadHolidays = useCallback(async () => {
    try {
      const res = await fetch("/api/holidays", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      const dates: Date[] = [];
      const info: Record<string, string> = {};
      for (const h of data.holidays ?? []) {
        const [year, month, day] = h.date.split("-").map((n: string) => parseInt(n, 10));
        const d = new Date(year, month - 1, day);
        dates.push(d);
        info[fmt(d)] = h.label;
      }
      setImportantDates(dates);
      setImportantInfo(info);
    } catch {
      // ignore for now
    }
  }, []);

  useEffect(() => {
    loadHolidays();
  }, [loadHolidays]);

  return (
    <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md">
      <h2 className="text-lg sm:text-xl font-semibold mb-4 sm:mb-6">Ajukan Permohonan Cuti</h2>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 sm:space-y-6">
        {/* Date Range Picker */}
        <div className="space-y-2">
          <Label htmlFor="date-range" className="block text-sm font-medium text-gray-700">
            Rentang Tanggal Cuti
          </Label>
          <Popover>
            <PopoverTrigger asChild>
              <button
                id="date-range"
                type="button"
                className="flex items-center justify-between w-full p-3 md:p-4 text-left text-base border border-gray-300 rounded-md bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <span className="flex items-center gap-2 overflow-hidden">
                  <CalendarIcon className="h-5 w-5 text-gray-400 flex-shrink-0" />
                  <span className="truncate">
                    {dateRange.from ? (
                      dateRange.to ? (
                        <span>
                          {formatDate(dateRange.from)} - {formatDate(dateRange.to)}
                        </span>
                      ) : (
                        formatDate(dateRange.from)
                      )
                    ) : (
                      <span className="text-gray-500">Pilih tanggal cuti</span>
                    )}
                  </span>
                </span>
                <span className="text-gray-500 text-sm flex-shrink-0 ml-2">▼</span>
              </button>
            </PopoverTrigger>
            <PopoverContent 
              className="p-0 w-auto border-0 shadow-xl rounded-xl overflow-hidden max-w-[calc(100vw-2rem)] sm:max-w-md" 
              align="start"
              side="bottom"
              sideOffset={8}
            >
              <div className="overflow-x-auto">
                <RangeCalendar
                  visibleMonths={1}
                  className="rc max-w-full bg-white mx-auto"
                  value={rangeValue ?? undefined}
                allowsNonContiguousRanges
                showMonthAndYearPickers
                onChange={(val) => {
                  setRangeValue(val);
                  if (val?.start) {
                    const start = val.start.toDate(getLocalTimeZone());
                    const end = (val.end ?? val.start).toDate(getLocalTimeZone());
                    onDateSelect({ from: start, to: end });
                  }
                }}
                isDateUnavailable={(date) => {
                  const jsDate = date.toDate(getLocalTimeZone());
                  const t = new Date(); t.setHours(0,0,0,0);
                  jsDate.setHours(0,0,0,0);
                  const holidaysSet = new Set(importantDates.map((d) => fmt(d)));
                  const isHoliday = holidaysSet.has(fmt(jsDate));
                  return jsDate < t || isWeekend(jsDate) || isHoliday;
                }}
                minValue={today(getLocalTimeZone())}
                maxValue={today(getLocalTimeZone()).add({ years: 1 })}
              />
              </div>
              <style jsx>{`
                .rc { background: #FFFFFF; }
                .rc [role="grid"] { width: 100%; }
                .rc thead th { color: #757575; font-size: 12px; }
                .rc [role="gridcell"] button {
                  color: #212121;
                  border-radius: 8px;
                  transition: all 200ms ease-in-out;
                }
                .rc [role="gridcell"] button:hover { background: #E1F5FE; }
                .rc [role="gridcell"][data-today="true"] button { outline: 2px solid #0288D1; background: #E1F5FE; }
                .rc [role="gridcell"][aria-selected="true"] button { background: #E1F5FE; box-shadow: 0 1px 6px rgba(0,0,0,0.08); }
                .rc [role="gridcell"][data-selection-start="true"] button { background: #0288D1; color: #FFFFFF; }
                .rc [role="gridcell"][data-selection-end="true"] button { background: #F8BBD0; color: #212121; }
                .rc [role="gridcell"][data-outside-month="true"] button { opacity: 0.5; }
                .rc [role="gridcell"][data-unavailable="true"] button { background: #E1F5FE; color: #212121; opacity: 0.8; }
                .rc .heroui-calendar-header button { color: #0288D1; }
              `}</style>
            </PopoverContent>
          </Popover>
          {(errors.startDate || errors.endDate) && (
            <p className="text-red-500 text-sm mt-1">
              {errors.startDate?.message || errors.endDate?.message}
            </p>
          )}
          {validationError && (
            <p className="text-red-600 text-sm mt-1">{validationError}</p>
          )}
          {leaveDuration > 0 && (
            <p className="text-sm text-gray-500 mt-1">
              Durasi: {leaveDuration} hari kalender
            </p>
          )}
          {startDate && endDate && (
            <p className="text-sm text-gray-700 mt-0.5">
              Hari kerja: {eachDayOfInterval({ start: startDate, end: endDate }).filter((d) => {
                const s = new Set(importantDates.map((x) => fmt(x)));
                return !isWeekend(d) && !s.has(fmt(d));
              }).length}
            </p>
          )}
        </div>

        {/* Leave Type */}
        <div className="space-y-2">
          <Label htmlFor="leave-type" className="block text-sm font-medium text-gray-700">
            Jenis Cuti
          </Label>
          <Select
            onValueChange={(value) => setValue("type", value as any)}
            required
          >
            <SelectTrigger id="leave-type" className="w-full border border-gray-300 p-3 text-base rounded-md flex items-center justify-between">
              <SelectValue placeholder="Pilih jenis cuti" />
            </SelectTrigger>
            <SelectContent position="popper" className="bg-white border border-gray-200 shadow-lg rounded-md overflow-hidden max-h-[40vh]" sideOffset={5}>
              <SelectItem value="SICK" className="cursor-pointer p-3 text-base hover:bg-gray-100">Sakit</SelectItem>
              <SelectItem value="VACATION" className="cursor-pointer p-3 text-base hover:bg-gray-100">Liburan</SelectItem>
              <SelectItem value="PERSONAL" className="cursor-pointer p-3 text-base hover:bg-gray-100">Pribadi</SelectItem>
              <SelectItem value="OTHER" className="cursor-pointer p-3 text-base hover:bg-gray-100">Lainnya</SelectItem>
            </SelectContent>
          </Select>
          {errors.type && (
            <p className="text-red-500 text-sm mt-1">{errors.type.message}</p>
          )}
        </div>

        {/* Reason */}
        <div className="space-y-2">
          <Label htmlFor="reason" className="block text-sm font-medium text-gray-700">
            Alasan
          </Label>
          <Textarea
            id="reason"
            placeholder="Berikan alasan untuk permohonan cuti Anda"
            className="w-full border border-gray-300 rounded-md p-3 text-base"
            rows={4}
            {...register("reason")}
          />
          {errors.reason && (
            <p className="text-red-500 text-sm mt-1">{errors.reason.message}</p>
          )}
        </div>

        {/* Submit Button */}
        <Button 
          type="submit" 
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 md:py-2 px-4 rounded-md text-base font-medium active:bg-blue-800 transition-colors"
          disabled={isSubmitting || !!validationError}
        >
          {isSubmitting ? "Mengirim..." : "Ajukan Permohonan Cuti"}
        </Button>
      </form>
    </div>
  );
}
