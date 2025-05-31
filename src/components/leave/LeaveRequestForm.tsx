"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, addDays, differenceInDays } from "date-fns";
import { useRouter } from "next/navigation";
import { id } from "date-fns/locale";
import { CalendarIcon } from "@heroicons/react/24/outline";

// UI components
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@radix-ui/react-label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "react-hot-toast";

// Schema for form validation
const leaveFormSchema = z.object({
  startDate: z.date({
    required_error: "Tanggal mulai diperlukan",
  }),
  endDate: z.date({
    required_error: "Tanggal selesai diperlukan",
  }).refine(date => date instanceof Date, {
    message: "Tanggal selesai tidak valid",
  }),
  type: z.enum(["SICK", "VACATION", "PERSONAL", "OTHER"], {
    required_error: "Jenis cuti diperlukan",
  }),
  reason: z.string().min(5, {
    message: "Alasan harus minimal 5 karakter",
  }),
});

type LeaveFormValues = z.infer<typeof leaveFormSchema>;

interface LeaveRequestFormProps {
  onLeaveSubmitted?: () => void; // Callback setelah permohonan berhasil dikirim
}

export default function LeaveRequestForm({ onLeaveSubmitted }: LeaveRequestFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dateRange, setDateRange] = useState<{
    from: Date | null;
    to: Date | null;
  }>({
    from: null,
    to: null,
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

  // Handle date selection
  const onDateSelect = (range: { from: Date; to: Date | null }) => {
    setDateRange(range);
    setValue("startDate", range.from);
    if (range.to) {
      setValue("endDate", range.to);
    } else {
      setValue("endDate", range.from);
    }
  };

  // Submit handler
  const onSubmit = async (data: LeaveFormValues) => {
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/leave", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
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

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-xl font-semibold mb-6">Ajukan Permohonan Cuti</h2>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
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
                className="flex items-center justify-between w-full p-2 text-left border border-gray-300 rounded-md bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <span className="flex items-center gap-2">
                  <CalendarIcon className="h-5 w-5 text-gray-400" />
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
                <span className="text-gray-500 text-sm">▼</span>
              </button>
            </PopoverTrigger>
            <PopoverContent 
              className="p-0 border-0" 
              align="start"
              side="bottom"
              sideOffset={8}
            >
              <Calendar
                mode="range"
                defaultMonth={new Date()}
                selected={{
                  from: dateRange.from || undefined,
                  to: dateRange.to || undefined,
                }}
                onSelect={(range) => {
                  if (range?.from) {
                    onDateSelect({
                      from: range.from,
                      to: range.to,
                    });
                  }
                }}
                disabled={(date) => date < new Date()}
                initialFocus
                locale={id}
                weekStartsOn={1}
              />
            </PopoverContent>
          </Popover>
          {(errors.startDate || errors.endDate) && (
            <p className="text-red-500 text-sm mt-1">
              {errors.startDate?.message || errors.endDate?.message}
            </p>
          )}
          {leaveDuration > 0 && (
            <p className="text-sm text-gray-500 mt-1">
              Durasi: {leaveDuration} hari
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
            <SelectTrigger id="leave-type" className="w-full border border-gray-300 p-2 rounded-md flex items-center justify-between">
              <SelectValue placeholder="Pilih jenis cuti" />
            </SelectTrigger>
            <SelectContent position="popper" className="bg-white border border-gray-200 shadow-lg rounded-md overflow-hidden" sideOffset={5}>
              <SelectItem value="SICK" className="cursor-pointer p-2 hover:bg-gray-100">Sakit</SelectItem>
              <SelectItem value="VACATION" className="cursor-pointer p-2 hover:bg-gray-100">Liburan</SelectItem>
              <SelectItem value="PERSONAL" className="cursor-pointer p-2 hover:bg-gray-100">Pribadi</SelectItem>
              <SelectItem value="OTHER" className="cursor-pointer p-2 hover:bg-gray-100">Lainnya</SelectItem>
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
            className="w-full border border-gray-300 rounded-md p-2"
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
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Mengirim..." : "Ajukan Permohonan Cuti"}
        </Button>
      </form>
    </div>
  );
} 