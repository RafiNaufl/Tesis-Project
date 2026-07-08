"use client";

import { useState, useEffect, type KeyboardEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import AddEmployeeModal from "./AddEmployeeModal";
import { getEmployeeButtonClass } from "./buttonStyles";
// import { useSession } from "next-auth/react";

type Employee = {
  id: string;
  employeeId: string;
  name?: string;
  position: string;
  division: string;
  isActive: boolean;
  email?: string;
  basicSalary?: number;
  contactNumber?: string;
  address?: string;
  organization?: string | null;
  employmentStatus?: string | null;
  workScheduleType?: "SHIFT" | "NON_SHIFT" | null;
  hourlyRate?: number | null;
  bpjsKesehatan?: number;
  bpjsKetenagakerjaan?: number;
  user?: {
    name: string;
    email: string;
    profileImageUrl?: string;
  };
};

type EmployeeFormValues = {
  name: string;
  phone: string;
  email?: string;
  password: string;
  organization: string;
  employmentStatus: string;
  role: string;
  division: string;
  workSchedule: "SHIFT" | "NON_SHIFT";
  monthlySalary?: number;
  hourlyRate?: number;
  bpjsKesehatan?: number;
  bpjsKetenagakerjaan?: number;
};

export default function EmployeeManagement() {
  const router = useRouter();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDivision, setFilterDivision] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterSchedule, setFilterSchedule] = useState("");
  const [selectedOrganizations, setSelectedOrganizations] = useState<string[]>([]);
  const [isOrgDropdownOpen, setIsOrgDropdownOpen] = useState(false);
  // const { data: session } = useSession();
  // Fetch employees from API
  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        setIsLoading(true);
        const response = await fetch("/api/employees");
        
        if (!response.ok) {
          throw new Error("Gagal mengambil data karyawan");
        }
        
        const data = await response.json();
        
        // Format the employee data to ensure name and email are accessible directly
        const formattedEmployees = data.map((employee: any) => ({
          ...employee,
          name: employee.user?.name,
          email: employee.user?.email,
          bpjsKesehatan: employee.bpjsKesehatan || 0,
          bpjsKetenagakerjaan: employee.bpjsKetenagakerjaan || 0,
        }));
        
        setEmployees(formattedEmployees);
      } catch (error) {
        console.error("Error fetching employees:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchEmployees();
  }, []);

  const handleAddEmployee = () => {
    setIsAddModalOpen(true);
  };

  const handleAddEmployeeSubmit = async (data: EmployeeFormValues) => {
    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        let msg = "Failed to register employee";
        try {
          const err = await response.json();
          msg = Array.isArray(err.error) ? err.error.join(", ") : (err.error || msg);
        } catch (e) {
          console.error(e);
        }
        alert(msg);
        throw new Error(msg);
      }
      
      // After successful registration, refresh list from /api/employees
      const refreshed = await fetch("/api/employees");
      if (refreshed.ok) {
        const data = await refreshed.json();
        const formattedEmployees = data.map((employee: any) => ({
          ...employee,
          name: employee.user?.name,
          email: employee.user?.email,
          profileImageUrl: employee.user?.profileImageUrl,
          bpjsKesehatan: employee.bpjsKesehatan || 0,
          bpjsKetenagakerjaan: employee.bpjsKetenagakerjaan || 0,
        }));
        setEmployees(formattedEmployees);
      }
    } catch (error) {
      console.error("Error adding employee:", error);
    }
  };

  // Filter employees based on search term, division, and organization
  const filteredEmployees = employees.filter((employee) => {
    const matchesSearchTerm = searchTerm === "" || (
      ((employee.user?.name || employee.name || "").toLowerCase()).includes(searchTerm.toLowerCase()) ||
      (employee.employeeId?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
      (employee.position?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
      ((employee.user?.email || employee.email || "").toLowerCase()).includes(searchTerm.toLowerCase())
    );
      
    const matchesDivision = 
      filterDivision === "" || employee.division === filterDivision;

    const matchesOrganization = 
      selectedOrganizations.length === 0 || 
      (employee.organization && selectedOrganizations.includes(employee.organization));

    const matchesStatus = 
      filterStatus === "" || 
      (filterStatus === "active" ? employee.isActive : !employee.isActive);

    const matchesSchedule = 
      filterSchedule === "" || employee.workScheduleType === filterSchedule;
      
    return matchesSearchTerm && matchesDivision && matchesOrganization && matchesStatus && matchesSchedule;
  });

  // Get unique divisions for filter dropdown
  const divisions = [...new Set(employees.map((emp) => emp.division))];

  // Get unique organizations for filter dropdown
  const uniqueOrganizations = [...new Set(employees.map((emp) => emp.organization).filter(Boolean) as string[])];

  const toggleOrganization = (org: string) => {
    setSelectedOrganizations(prev => 
      prev.includes(org) 
        ? prev.filter(item => item !== org)
        : [...prev, org]
    );
  };

  const navigateToEmployeeDetail = (employeeId: string) => {
    router.push(`/dashboard/employees/${employeeId}`);
  };

  const handleRowKeyDown = (
    event: KeyboardEvent<HTMLElement>,
    employeeId: string
  ) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      navigateToEmployeeDetail(employeeId);
    }
  };

  return (
    <div className="space-y-6">
      <div className="sm:flex sm:items-center sm:justify-between">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold text-gray-900">Daftar Karyawan</h1>
          <p className="mt-2 text-sm text-gray-700">
            Daftar semua karyawan di organisasi Anda termasuk nama, jabatan, divisi, dan status mereka.
          </p>
        </div>
        <div className="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
          <button
            type="button"
            onClick={handleAddEmployee}
            className={getEmployeeButtonClass("primary", "w-full sm:w-auto")}
          >
            <span className="flex items-center justify-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
              Tambah Karyawan
            </span>
          </button>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col space-y-3 sm:flex-row sm:space-y-0 sm:space-x-4">
        <div className="relative flex-grow">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
            </svg>
          </div>
          <input
            type="text"
            className="block w-full rounded-md border border-gray-300 bg-white pl-10 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
            placeholder="Cari karyawan..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="relative w-full sm:w-48">
          <button
            type="button"
            className={getEmployeeButtonClass("secondary", "relative w-full justify-between px-3 pr-10 text-left text-slate-700")}
            onClick={() => setIsOrgDropdownOpen(!isOrgDropdownOpen)}
          >
            <span className="block truncate">
              {selectedOrganizations.length === 0
                ? "Semua Organisasi"
                : `${selectedOrganizations.length} Dipilih`}
            </span>
            <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
              <svg className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M10 3a1 1 0 01.707.293l3 3a1 1 0 01-1.414 1.414L10 5.414 7.707 7.707a1 1 0 01-1.414-1.414l3-3A1 1 0 0110 3zm-3.707 9.293a1 1 0 011.414 0L10 14.586l2.293-2.293a1 1 0 011.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </span>
          </button>

          {isOrgDropdownOpen && (
            <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
              {uniqueOrganizations.length === 0 ? (
                 <div className="py-2 pl-3 pr-9 text-gray-500 italic">Tidak ada organisasi ditemukan</div>
              ) : (
                uniqueOrganizations.map((org) => (
                  <div
                    key={org}
                    className="relative cursor-default select-none py-2 pl-3 pr-9 hover:bg-indigo-50"
                    onClick={() => toggleOrganization(org)}
                  >
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        checked={selectedOrganizations.includes(org)}
                        readOnly
                      />
                      <span className="ml-3 block truncate font-normal">
                        {org}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
        <div className="w-full sm:w-40">
          <select
            className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
            value={filterDivision}
            onChange={(e) => setFilterDivision(e.target.value)}
          >
            <option value="">Semua Divisi</option>
            {divisions.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>
        </div>
        <div className="w-full sm:w-40">
          <select
            className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
            value={filterSchedule}
            onChange={(e) => setFilterSchedule(e.target.value)}
          >
            <option value="">Semua Jadwal</option>
            <option value="SHIFT">Shift</option>
            <option value="NON_SHIFT">Non-Shift</option>
          </select>
        </div>
        <div className="w-full sm:w-40">
          <select
            className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">Semua Status</option>
            <option value="active">Aktif</option>
            <option value="inactive">Tidak Aktif</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-t-2 border-indigo-600"></div>
        </div>
      ) : (
        <div className="mt-8 flow-root">
          {/* Mobile View (Cards) */}
          <div className="block sm:hidden space-y-4">
            {filteredEmployees.length === 0 ? (
              <div className="bg-white py-6 text-center rounded-lg shadow">
                <p className="text-gray-500">Tidak ada karyawan ditemukan</p>
              </div>
            ) : (
              filteredEmployees.map((employee) => (
                <div
                  key={employee.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigateToEmployeeDetail(employee.id)}
                  onKeyDown={(event) => handleRowKeyDown(event, employee.id)}
                  className="cursor-pointer bg-white shadow rounded-lg p-4 space-y-4 transition-colors hover:bg-blue-50/60 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                >
                  <div className="flex items-center space-x-3">
                    <div className="h-12 w-12 overflow-hidden rounded-full bg-gray-100 flex-shrink-0">
                      {employee.user?.profileImageUrl ? (
                        <Image src={employee.user?.profileImageUrl} alt="Avatar" width={50} height={50} className="h-12 w-12 object-cover" />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center text-xs text-gray-400 font-bold bg-gray-200">
                          {(employee.user?.name || employee.name || "-").split(" ").map((s:any)=>s[0]).slice(0,2).join("")}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-gray-900 truncate">{employee.user?.name || employee.name}</h3>
                      <p className="text-sm text-gray-500 truncate">{employee.user?.email || employee.email}</p>
                    </div>
                    <span
                      className={`inline-flex flex-shrink-0 rounded-full px-2 py-1 text-xs font-semibold ${
                        employee.isActive
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {employee.isActive ? "Aktif" : "Nonaktif"}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 text-sm border-t border-b border-gray-100 py-3">
                    <div>
                      <p className="text-xs text-gray-500">ID Karyawan</p>
                      <p className="font-medium">{employee.employeeId}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Jabatan</p>
                      <p className="font-medium">{employee.position}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Divisi</p>
                      <p className="font-medium">{employee.division}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Status Pegawai</p>
                      <p className="font-medium">{employee.employmentStatus || "-"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Tipe Jadwal</p>
                      <p className="font-medium">{employee.workScheduleType === "SHIFT" ? "Shift" : "Non-Shift"}</p>
                    </div>
                  </div>
                  <p className="pt-2 text-xs font-medium text-blue-600">
                    Ketuk kartu untuk melihat detail karyawan
                  </p>
                </div>
              ))
            )}
          </div>

          {/* Desktop View (Table) */}
          <div className="hidden sm:block -mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
            <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
              <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
                {filteredEmployees.length === 0 ? (
                  <div className="bg-white py-6 text-center">
                    <p className="text-gray-500">Tidak ada karyawan ditemukan</p>
                  </div>
                ) : (
                  <table className="min-w-full divide-y divide-gray-300">
                    <thead className="bg-gray-50">
                      <tr>
                        <th
                          scope="col"
                          className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6"
                        >
                          ID Karyawan
                        </th>
                        <th
                          scope="col"
                          className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                        >
                          Avatar
                        </th>
                        <th
                          scope="col"
                          className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                        >
                          Nama
                        </th>
                        <th
                          scope="col"
                          className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                        >
                          Jabatan
                        </th>
                        <th
                          scope="col"
                          className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                        >
                          Divisi
                        </th>
                        <th
                          scope="col"
                          className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                        >
                          Tipe Jadwal
                        </th>
                        <th
                          scope="col"
                          className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                        >
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {filteredEmployees.map((employee) => (
                        <tr
                          key={employee.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => navigateToEmployeeDetail(employee.id)}
                          onKeyDown={(event) => handleRowKeyDown(event, employee.id)}
                          className="cursor-pointer transition-colors hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500"
                        >
                          <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                            {employee.employeeId}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                            <div className="h-12 w-12 overflow-hidden rounded-full bg-gray-100">
                              {employee.user?.profileImageUrl ? (
                                <Image src={employee.user?.profileImageUrl} alt="Avatar" width={50} height={50} className="h-12 w-12 object-cover" />
                              ) : (
                                <div className="flex h-12 w-12 items-center justify-center text-xs text-gray-400">
                                  {(employee.user?.name || employee.name || "-").split(" ").map((s:any)=>s[0]).slice(0,2).join("")}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                            <div className="font-medium text-gray-900">
                              {employee.user?.name || employee.name}
                            </div>
                            <div className="text-gray-500">{employee.user?.email || employee.email}</div>
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                            {employee.position}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                            {employee.division}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                            <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                              employee.workScheduleType === "SHIFT" 
                                ? "bg-purple-100 text-purple-800" 
                                : "bg-blue-100 text-blue-800"
                            }`}>
                              {employee.workScheduleType === "SHIFT" ? "Shift" : "Non-Shift"}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                            <span
                              className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                                employee.isActive
                                  ? "bg-green-100 text-green-800"
                                  : "bg-red-100 text-red-800"
                              }`}
                            >
                              {employee.isActive ? "Aktif" : "Tidak Aktif"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Employee Modal */}
      <AddEmployeeModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={handleAddEmployeeSubmit}
      />
    </div>
  );
} 
