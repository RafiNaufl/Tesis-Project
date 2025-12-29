"use client";

import * as React from "react";
import { DayPicker } from "react-day-picker";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import { format, isWeekend } from "date-fns";
import { id } from "date-fns/locale";
import { cn } from "@/lib/utils";

export type CalendarProps = React.ComponentProps<typeof DayPicker> & {
  importantDates?: Date[];
  importantInfo?: Record<string, string>;
  fromDate?: Date;
  toDate?: Date;
};

  function Calendar({
    className,
    classNames,
    showOutsideDays = true,
    locale = id,
    ...props
  }: CalendarProps) {
  const [currentMonth, setCurrentMonth] = React.useState<Date>(props.month ?? new Date());
  const [fadingIn, setFadingIn] = React.useState(false);
  const initialSingleSelected = props.mode === "single" ? ((props as any).selected as Date | undefined) : undefined;
  const [internalSelected, setInternalSelected] = React.useState<Date | undefined>(
    props.mode === "single" ? initialSingleSelected ?? new Date() : undefined
  );
  
  const fmt = (d?: Date) => (d instanceof Date)
    ? `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
    : "";
  const importantSet = React.useMemo(() => new Set((props.importantDates ?? []).map(fmt)), [props.importantDates]);
  React.useEffect(() => {
    if (props.month) setCurrentMonth(props.month);
  }, [props.month]);

  const { mode, selected } = props as any;
  React.useEffect(() => {
    if (mode === "single") {
      const selectedProp = selected as Date | undefined;
      if (selectedProp instanceof Date) setInternalSelected(selectedProp);
    }
  }, [mode, selected]);

  React.useEffect(() => {
    setFadingIn(false);
    const t = setTimeout(() => setFadingIn(true), 0);
    return () => clearTimeout(t);
  }, [currentMonth]);

  return (
    <div className={cn("p-4 bg-white rounded-xl shadow transition-colors", className)}>
      <div className="flex items-center justify-between pb-3 border-b">
        <button
          type="button"
          onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
          className="inline-flex items-center gap-2 rounded-md px-3 py-1 text-sm border hover:bg-gray-50 transition-colors"
          aria-label="Bulan Sebelumnya"
        >
          <ChevronLeftIcon className="h-4 w-4" />
          <span className="hidden sm:inline">Bulan Sebelumnya</span>
        </button>
        <div className="text-base font-semibold">
          {format(currentMonth, "MMMM yyyy", { locale: id })}
        </div>
        <button
          type="button"
          onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
          className="inline-flex items-center gap-2 rounded-md px-3 py-1 text-sm border hover:bg-gray-50 transition-colors"
          aria-label="Bulan Berikutnya"
        >
          <span className="hidden sm:inline">Bulan Berikutnya</span>
          <ChevronRightIcon className="h-4 w-4" />
        </button>
      </div>
      <DayPicker
        key={`${currentMonth.getFullYear()}-${currentMonth.getMonth()}`}
        showOutsideDays={showOutsideDays}
        month={currentMonth}
        onMonthChange={setCurrentMonth}
        className={cn("pt-3 opacity-0 transition-opacity duration-300 ease-in-out", fadingIn && "opacity-100")}
        locale={locale}
        mode={props.mode}
        {...(props.mode === "single"
          ? ({
              selected: (initialSingleSelected ?? internalSelected) as Date | undefined,
              onSelect: ((selected: Date | undefined, triggerDate: Date, modifiers: any, e: any) => {
                setInternalSelected(selected);
                (props as any).onSelect?.(selected, triggerDate, modifiers, e);
              }) as any,
            } as any)
          : ({} as any))}
        fromDate={props.fromDate}
        toDate={props.toDate}
        classNames={{
          months: "flex flex-col space-y-4",
          month: "space-y-4",
          caption: "flex justify-between items-center px-1 py-2",
          caption_label: "text-sm font-semibold",
          nav: "flex items-center space-x-1",
          nav_button: cn(
            "inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-7 w-7 bg-transparent p-0"
          ),
          table: "w-full border-collapse",
          head_cell: "text-gray-500 w-10 font-medium text-xs text-center",
          cell: "align-middle text-center p-1",
          day: cn(
            "inline-flex h-10 w-10 items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-indigo-50 hover:text-indigo-700 aria-selected:opacity-100"
          ),
          day_selected: "bg-indigo-600 text-white hover:bg-indigo-600 hover:text-white focus:bg-indigo-600 focus:text-white shadow-sm",
          day_today: "bg-indigo-100 text-indigo-800 ring-2 ring-indigo-500",
          day_outside: "text-muted-foreground opacity-50",
          day_disabled: "text-muted-foreground opacity-50",
          day_range_middle: "aria-selected:bg-indigo-200 aria-selected:text-indigo-900",
          day_range_end: "rounded-r-md ring-1 ring-indigo-400",
          day_range_start: "rounded-l-md ring-1 ring-indigo-400",
          day_hidden: "invisible",
          ...classNames,
        }}
        components={{
          Chevron: ({ orientation, ...props }) => {
            const Icon = orientation === 'left' ? ChevronLeftIcon : ChevronRightIcon;
            return <Icon className="h-4 w-4" {...props} />;
          },
        }}
        formatters={{
          formatWeekdayName: (weekday) => format(weekday, "EEE", { locale: id }),
          formatCaption: (date) => format(date, "MMMM yyyy", { locale: id }),
        }}
        modifiers={{
          weekend: (date) => isWeekend(date),
          important: (date) => importantSet.has(fmt(date)),
        }}
        modifiersClassNames={{
          weekend: "text-red-500",
          important: "bg-yellow-100 text-yellow-800",
        }}
        weekStartsOn={1}
        {...props}
      />
      {props.mode === "single" && (
        <div className="mt-3 text-sm text-gray-700">
          {internalSelected
            ? `${format(internalSelected, "dd MMMM yyyy", { locale: id })}`
            : "Belum memilih tanggal"}
        </div>
      )}
    </div>
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
