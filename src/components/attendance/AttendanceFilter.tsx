"use client"

import * as React from "react"
import { Search, Filter, X, Check, MapPin, CalendarDays, User } from "lucide-react"
import { DateRange } from "react-day-picker"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Dialog, Transition } from "@headlessui/react"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export interface FilterState {
  search: string
  employeeId?: string
  department: string
  position: string
  status: string[]
  dateRange: DateRange | undefined
  isLate: boolean
  hasLocation: boolean
  dayType: "ALL" | "WEEKDAY" | "SATURDAY" | "SUNDAY" | "HOLIDAY"
}

interface AttendanceFilterProps {
  filters: FilterState
  onChange: (filters: FilterState) => void
  onClear: () => void
  className?: string
  employees?: any[]
  selectedDate: number | null
  onDateChange: (date: number | null) => void
  selectedMonth: number
  onMonthChange: (month: number) => void
  selectedYear: number
  onYearChange: (year: number) => void
}

const STATUS_OPTIONS = [
  { value: "PRESENT", label: "Hadir (Tepat Waktu)" },
  { value: "LATE", label: "Terlambat" },
  { value: "ABSENT", label: "Alpa" },
  { value: "SICK", label: "Sakit" },
  { value: "PERMIT", label: "Izin" },
  { value: "LEAVE", label: "Cuti" },
]

// Divisions derived dynamically from employees data

const DAY_TYPE_OPTIONS = [
  { value: "ALL", label: "Semua Hari" },
  { value: "WEEKDAY", label: "Hari Kerja (Senin-Jumat)" },
  { value: "SATURDAY", label: "Sabtu" },
  { value: "SUNDAY", label: "Minggu" },
  { value: "HOLIDAY", label: "Hari Libur" },
]

export function AttendanceFilter({
  filters,
  onChange,
  onClear,
  className,
  employees = [],
  selectedDate,
  onDateChange,
  selectedMonth,
  onMonthChange,
  selectedYear,
  onYearChange
}: AttendanceFilterProps) {
  const [showSuggestions, setShowSuggestions] = React.useState(false)
  const wrapperRef = React.useRef<HTMLDivElement>(null)
  const [isAdvancedOpen, setIsAdvancedOpen] = React.useState(false)

  // Extract unique positions from employees
  const positions = React.useMemo(() => {
    if (!employees.length) return []
    const pos = new Set(employees.map(e => e.position).filter(Boolean))
    return Array.from(pos).sort()
  }, [employees])

  // Extract unique divisions from employees
  const divisions = React.useMemo(() => {
    if (!employees.length) return []
    const div = new Set(employees.map(e => e.division).filter(Boolean))
    return Array.from(div).sort()
  }, [employees])

  // Generate years options (current year - 2 to current year + 1)
  const years = React.useMemo(() => {
    const currentYear = new Date().getFullYear()
    return Array.from({ length: 4 }, (_, i) => currentYear - 2 + i)
  }, [])

  // Generate months options
  const months = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ]

  // Generate dates based on selected month and year
  const dates = React.useMemo(() => {
    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate()
    return Array.from({ length: daysInMonth }, (_, i) => i + 1)
  }, [selectedMonth, selectedYear])

  // Filter suggestions based on search
  const suggestions = React.useMemo(() => {
    if (!filters.search || filters.search.length < 2) return []
    const searchLower = filters.search.toLowerCase()
    return employees
      .filter(e => 
        e.user?.name?.toLowerCase().includes(searchLower) || 
        e.employeeId?.toLowerCase().includes(searchLower)
      )
      .slice(0, 5)
  }, [filters.search, employees])

  React.useEffect(() => {
    if (!filters.employeeId && filters.search && employees.length > 0) {
      const exact = employees.find(e => (e.employeeId || "").toLowerCase() === filters.search.toLowerCase())
      if (exact) {
        onChange({ ...filters, employeeId: exact.id })
      }
    }
  }, [filters, onChange, employees])

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...filters, search: e.target.value, employeeId: undefined })
    setShowSuggestions(true)
  }

  const handleDepartmentChange = (value: string) => {
    onChange({ ...filters, department: value === "all" ? "" : value })
  }

  const handlePositionChange = (value: string) => {
    onChange({ ...filters, position: value === "all" ? "" : value })
  }

  const handleDayTypeChange = (value: string) => {
    onChange({ ...filters, dayType: value as any })
  }

  const toggleStatus = (status: string) => {
    const current = filters.status
    const next = current.includes(status)
      ? current.filter((s) => s !== status)
      : [...current, status]
    onChange({ ...filters, status: next })
  }

  const toggleLate = () => {
    onChange({ ...filters, isLate: !filters.isLate })
  }

  const toggleLocation = () => {
    onChange({ ...filters, hasLocation: !filters.hasLocation })
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        {/* Search Bar with Autocomplete */}
        <div className="relative flex-1 max-w-sm" ref={wrapperRef}>
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
          <input
            type="text"
            placeholder="Cari nama atau ID karyawan..."
            className="flex h-10 w-full rounded-md border border-gray-200 bg-white px-3 py-2 pl-9 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            value={filters.search}
            onChange={handleSearchChange}
            onFocus={() => setShowSuggestions(true)}
          />
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-10 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg">
              <ul className="py-1">
                {suggestions.map((employee) => (
                  <li
                    key={employee.id}
                    className="cursor-pointer px-4 py-2 hover:bg-gray-100"
                    onClick={() => {
                      onChange({ ...filters, search: employee.user?.name || employee.employeeId, employeeId: employee.id })
                      setShowSuggestions(false)
                    }}
                  >
                    <div className="font-medium text-sm">{employee.user?.name}</div>
                    <div className="text-xs text-gray-500">{employee.employeeId} • {employee.position}</div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="h-10 border-dashed md:hidden"
            onClick={() => setIsAdvancedOpen(true)}
          >
            <Filter className="mr-2 h-4 w-4" />
            Filter Lanjutan
            {(selectedDate || filters.department || filters.position || filters.status.length > 0 || filters.isLate || filters.hasLocation || filters.dayType !== "ALL") && (
               <span className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-600">
                 !
               </span>
            )}
          </Button>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="h-10 border-dashed hidden md:flex">
                <Filter className="mr-2 h-4 w-4" />
                Filter Lanjutan
                {(selectedDate || filters.department || filters.position || filters.status.length > 0 || filters.isLate || filters.hasLocation || filters.dayType !== "ALL") && (
                   <span className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-600">
                     !
                   </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[640px] max-w-[90vw] p-4" align="end">
              <div className="space-y-4 h-[400px] overflow-y-auto pr-2">
                <div className="space-y-2">
                  <h4 className="font-medium leading-none flex items-center gap-2">
                    <CalendarDays className="h-4 w-4" /> Tanggal
                  </h4>
                  <div className="flex items-center gap-2">
                    <Select
                      value={selectedDate?.toString() || "all"}
                      onValueChange={(val) => onDateChange(val === "all" ? null : parseInt(val))}
                    >
                      <SelectTrigger className="h-8 w-[70px]">
                        <SelectValue placeholder="Tgl" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Semua</SelectItem>
                        {dates.map((d) => (
                          <SelectItem key={d} value={d.toString()}>{d}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="h-4 w-[1px] bg-gray-200" />
                    <Select
                      value={selectedMonth.toString()}
                      onValueChange={(val) => onMonthChange(parseInt(val))}
                    >
                      <SelectTrigger className="h-8 w-[100px]">
                        <SelectValue placeholder="Bulan" />
                      </SelectTrigger>
                      <SelectContent>
                        {months.map((m, i) => (
                          <SelectItem key={i + 1} value={(i + 1).toString()}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="h-4 w-[1px] bg-gray-200" />
                    <Select
                      value={selectedYear.toString()}
                      onValueChange={(val) => onYearChange(parseInt(val))}
                    >
                      <SelectTrigger className="h-8 w-[80px]">
                        <SelectValue placeholder="Tahun" />
                      </SelectTrigger>
                      <SelectContent>
                        {years.map((y) => (
                          <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium leading-none flex items-center gap-2">
                    <User className="h-4 w-4" /> Divisi & Posisi
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    <Select
                      value={filters.department || "all"}
                      onValueChange={handleDepartmentChange}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Semua Divisi" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Semua Divisi</SelectItem>
                        {divisions.map((div) => (
                          <SelectItem key={div} value={div}>
                            {div}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={filters.position || "all"}
                      onValueChange={handlePositionChange}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Semua Posisi" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Semua Posisi</SelectItem>
                        {positions.map((pos: string) => (
                          <SelectItem key={pos} value={pos}>
                            {pos}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium leading-none flex items-center gap-2">
                    <CalendarDays className="h-4 w-4" /> Tipe Hari
                  </h4>
                  <Select
                    value={filters.dayType}
                    onValueChange={handleDayTypeChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih Tipe Hari" />
                    </SelectTrigger>
                    <SelectContent>
                      {DAY_TYPE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium leading-none">Status Absensi</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {STATUS_OPTIONS.map((option) => {
                      const isSelected = filters.status.includes(option.value)
                      return (
                        <div
                          key={option.value}
                          className={cn(
                            "flex cursor-pointer items-center justify-between rounded-md border px-2 py-1 text-sm hover:bg-gray-50",
                            isSelected && "border-blue-500 bg-blue-50 text-blue-700"
                          )}
                          onClick={() => toggleStatus(option.value)}
                        >
                          <span>{option.label}</span>
                          {isSelected && <Check className="h-3 w-3" />}
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div className="space-y-2 border-t pt-2">
                  <h4 className="font-medium leading-none">Filter Tambahan</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <div
                       className={cn(
                          "flex cursor-pointer items-center justify-center rounded-md border px-3 py-2 text-sm font-medium transition-colors hover:bg-gray-50",
                          filters.isLate && "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                       )}
                       onClick={toggleLate}
                    >
                       <span className="mr-2">Hanya Terlambat</span>
                       {filters.isLate && <Check className="h-3 w-3" />}
                    </div>
                    <div
                       className={cn(
                          "flex cursor-pointer items-center justify-center rounded-md border px-3 py-2 text-sm font-medium transition-colors hover:bg-gray-50",
                          filters.hasLocation && "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                       )}
                       onClick={toggleLocation}
                    >
                       <MapPin className="mr-2 h-3 w-3" />
                       <span className="mr-2">Ada Lokasi</span>
                       {filters.hasLocation && <Check className="h-3 w-3" />}
                    </div>
                  </div>
                </div>
                
                <Button 
                    variant="ghost" 
                    size="sm" 
                    className="w-full text-red-500 hover:text-red-700 hover:bg-red-50 mt-2"
                    onClick={() => {
                        onChange({
                            ...filters,
                            department: "",
                            position: "",
                            status: [],
                            isLate: false,
                            hasLocation: false,
                            dayType: "ALL"
                        });
                        onDateChange(null);
                    }}
                >
                    Reset Filter
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          {(filters.search || selectedDate || filters.department || filters.position || filters.status.length > 0 || filters.isLate || filters.hasLocation || filters.dayType !== "ALL") && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onClear}
              className="h-10 w-10 text-gray-500 hover:text-gray-900"
              title="Hapus Semua Filter"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      
      <Transition show={isAdvancedOpen} as={React.Fragment}>
        <Dialog open={isAdvancedOpen} onClose={() => setIsAdvancedOpen(false)}>
        <Transition.Child
          as={React.Fragment}
          enter="duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="duration-250 ease-[cubic-bezier(0.22,1,0.36,1)]"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/40" aria-hidden="true" />
        </Transition.Child>
        <div className="fixed inset-x-0 bottom-0 z-50">
          <Transition.Child
            as={React.Fragment}
            enter="duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
            enterFrom="translate-y-full opacity-0"
            enterTo="translate-y-0 opacity-100"
            leave="duration-250 ease-[cubic-bezier(0.22,1,0.36,1)]"
            leaveFrom="translate-y-0 opacity-100"
            leaveTo="translate-y-full opacity-0"
          >
            <Dialog.Panel className="mx-auto w-full max-w-md rounded-t-2xl bg-white shadow-lg">
            <div className="px-4 pt-3">
              <div className="mx-auto h-1.5 w-12 rounded-full bg-gray-300" />
              <div className="mt-3 flex items-center justify-between">
                <div className="text-base font-semibold">Filter Lanjutan</div>
                <Button variant="ghost" size="icon" onClick={() => setIsAdvancedOpen(false)} className="h-9 w-9 text-gray-500">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="px-4 pb-24 pt-2 space-y-5 max-h-[80vh] overflow-y-auto">
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Tanggal</h4>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    className="h-10 rounded-full px-4"
                    onClick={() => {
                      const now = new Date();
                      onYearChange(now.getFullYear());
                      onMonthChange(now.getMonth() + 1);
                      onDateChange(now.getDate());
                    }}
                  >
                    Hari Ini
                  </Button>
                  <Button
                    variant="outline"
                    className="h-10 rounded-full px-4"
                    onClick={() => {
                      const now = new Date();
                      onYearChange(now.getFullYear());
                      onMonthChange(now.getMonth() + 1);
                      onDateChange(null);
                    }}
                  >
                    Bulan Ini
                  </Button>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <Select value={selectedDate?.toString() || "all"} onValueChange={(val) => onDateChange(val === "all" ? null : parseInt(val))}>
                    <SelectTrigger className="h-12 w-full rounded-lg"><SelectValue placeholder="Tgl" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua</SelectItem>
                      {dates.map((d) => (<SelectItem key={d} value={d.toString()}>{d}</SelectItem>))}
                    </SelectContent>
                  </Select>
                  <Select value={selectedMonth.toString()} onValueChange={(val) => onMonthChange(parseInt(val))}>
                    <SelectTrigger className="h-12 w-full rounded-lg"><SelectValue placeholder="Bulan" /></SelectTrigger>
                    <SelectContent>
                      {months.map((m, i) => (<SelectItem key={i + 1} value={(i + 1).toString()}>{m}</SelectItem>))}
                    </SelectContent>
                  </Select>
                  <Select value={selectedYear.toString()} onValueChange={(val) => onYearChange(parseInt(val))}>
                    <SelectTrigger className="h-12 w-full rounded-lg"><SelectValue placeholder="Tahun" /></SelectTrigger>
                    <SelectContent>
                      {years.map((y) => (<SelectItem key={y} value={y.toString()}>{y}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-medium">Divisi & Posisi</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Select value={filters.department || "all"} onValueChange={handleDepartmentChange}>
                    <SelectTrigger className="h-12 rounded-lg"><SelectValue placeholder="Semua Divisi" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Divisi</SelectItem>
                      {divisions.map((div) => (<SelectItem key={div} value={div}>{div}</SelectItem>))}
                    </SelectContent>
                  </Select>
                  <Select value={filters.position || "all"} onValueChange={handlePositionChange}>
                    <SelectTrigger className="h-12 rounded-lg"><SelectValue placeholder="Semua Posisi" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Posisi</SelectItem>
                      {positions.map((pos: string) => (<SelectItem key={pos} value={pos}>{pos}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-medium">Tipe Hari</h4>
                <Select value={filters.dayType} onValueChange={handleDayTypeChange}>
                  <SelectTrigger className="h-12 rounded-lg"><SelectValue placeholder="Pilih Tipe Hari" /></SelectTrigger>
                  <SelectContent>
                    {DAY_TYPE_OPTIONS.map((option) => (<SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-medium">Status Absensi</h4>
                <div className="grid grid-cols-2 gap-2">
                  {STATUS_OPTIONS.map((option) => {
                    const isSelected = filters.status.includes(option.value)
                    return (
                      <div
                        key={option.value}
                        className={cn("flex cursor-pointer items-center justify-between rounded-lg border px-3 py-3 text-sm", isSelected ? "border-blue-500 bg-blue-50 text-blue-700" : "hover:bg-gray-50")}
                        onClick={() => toggleStatus(option.value)}
                      >
                        <span>{option.label}</span>
                        {isSelected && <Check className="h-3 w-3" />}
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-medium">Filter Tambahan</h4>
                <div className="grid grid-cols-2 gap-2">
                  <div
                    className={cn("flex cursor-pointer items-center justify-center rounded-lg border px-3 py-3 text-sm font-medium", filters.isLate ? "border-red-200 bg-red-50 text-red-700" : "hover:bg-gray-50")}
                    onClick={toggleLate}
                  >
                    <span className="mr-2">Hanya Terlambat</span>
                    {filters.isLate && <Check className="h-3 w-3" />}
                  </div>
                  <div
                    className={cn("flex cursor-pointer items-center justify-center rounded-lg border px-3 py-3 text-sm font-medium", filters.hasLocation ? "border-green-200 bg-green-50 text-green-700" : "hover:bg-gray-50")}
                    onClick={toggleLocation}
                  >
                    <MapPin className="mr-2 h-3 w-3" />
                    <span className="mr-2">Ada Lokasi</span>
                    {filters.hasLocation && <Check className="h-3 w-3" />}
                  </div>
                </div>
              </div>
            </div>
            <div className="fixed inset-x-0 bottom-0 z-50 bg-white px-4 py-3 border-t pb-[env(safe-area-inset-bottom)]">
              <div className="flex items-center justify-between gap-2">
                <Button
                  variant="outline"
                  className="h-12 rounded-lg px-5"
                  onClick={() => {
                    onChange({
                      ...filters,
                      department: "",
                      position: "",
                      status: [],
                      isLate: false,
                      hasLocation: false,
                      dayType: "ALL"
                    });
                    onDateChange(null);
                  }}
                >
                  Reset
                </Button>
                <Button className="h-12 rounded-lg px-5" onClick={() => setIsAdvancedOpen(false)}>Terapkan</Button>
              </div>
            </div>
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>
      </Transition>
      {/* Active Filters Summary Chips */}
      <div className="flex flex-wrap gap-2">
        {filters.department && (
            <div className="inline-flex items-center rounded-full border border-gray-200 bg-white px-2.5 py-0.5 text-xs font-semibold text-gray-900 transition-colors">
                Divisi: {filters.department}
                <X className="ml-1 h-3 w-3 cursor-pointer text-gray-500 hover:text-gray-900" onClick={() => handleDepartmentChange("all")} />
            </div>
        )}
        {filters.employeeId && (
            <div className="inline-flex items-center rounded-full border border-gray-200 bg-white px-2.5 py-0.5 text-xs font-semibold text-gray-900 transition-colors">
                Karyawan dipilih
                <X className="ml-1 h-3 w-3 cursor-pointer text-gray-500 hover:text-gray-900" onClick={() => onChange({ ...filters, employeeId: undefined })} />
            </div>
        )}
        {filters.position && (
            <div className="inline-flex items-center rounded-full border border-gray-200 bg-white px-2.5 py-0.5 text-xs font-semibold text-gray-900 transition-colors">
                Pos: {filters.position}
                <X className="ml-1 h-3 w-3 cursor-pointer text-gray-500 hover:text-gray-900" onClick={() => handlePositionChange("all")} />
            </div>
        )}
        {filters.dayType !== "ALL" && (
            <div className="inline-flex items-center rounded-full border border-purple-200 bg-purple-50 px-2.5 py-0.5 text-xs font-semibold text-purple-700 transition-colors">
                {DAY_TYPE_OPTIONS.find(o => o.value === filters.dayType)?.label}
                <X className="ml-1 h-3 w-3 cursor-pointer text-purple-500 hover:text-purple-900" onClick={() => handleDayTypeChange("ALL")} />
            </div>
        )}
        {filters.status.map(s => (
            <div key={s} className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 transition-colors">
                {STATUS_OPTIONS.find(opt => opt.value === s)?.label || s}
                <X className="ml-1 h-3 w-3 cursor-pointer text-blue-500 hover:text-blue-900" onClick={() => toggleStatus(s)} />
            </div>
        ))}
        {filters.isLate && (
            <div className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700 transition-colors">
                Terlambat
                <X className="ml-1 h-3 w-3 cursor-pointer text-red-500 hover:text-red-900" onClick={toggleLate} />
            </div>
        )}
        {filters.hasLocation && (
            <div className="inline-flex items-center rounded-full border border-green-200 bg-green-50 px-2.5 py-0.5 text-xs font-semibold text-green-700 transition-colors">
                Ada Lokasi
                <X className="ml-1 h-3 w-3 cursor-pointer text-green-500 hover:text-green-900" onClick={toggleLocation} />
            </div>
        )}
      </div>
    </div>
  )
}
