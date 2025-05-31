"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import AddEmployeeModal from "./AddEmployeeModal";
import EditEmployeeModal from "./EditEmployeeModal";
import { useSession } from "next-auth/react";

type Employee = {
  id: string;
  employeeId: string;
  name?: string;
  position: string;
  department: string;
  isActive: boolean;
  email?: string;
  basicSalary?: number;
  contactNumber?: string;
  address?: string;
  user?: {
    name: string;
    email: string;
  };
};

type EmployeeFormValues = {
  name: string;
  email: string;
  password: string;
  position: string;
  department: string;
  basicSalary: number;
  contactNumber?: string;
  address?: string;
};

type EmployeeEditFormValues = {
  name: string;
  email: string;
  position: string;
  department: string;
  basicSalary: number;
  contactNumber?: string;
  address?: string;
  isActive: boolean;
};

export default function EmployeeManagement() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDepartment, setFilterDepartment] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const { data: session } = useSession();
  const router = useRouter();

  // Fetch employees from API
  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        setIsLoading(true);
        const response = await fetch("/api/employees");
        
        if (!response.ok) {
          throw new Error("Failed to fetch employees");
        }
        
        const data = await response.json();
        
        // Format the employee data to ensure name and email are accessible directly
        const formattedEmployees = data.map((employee: any) => ({
          ...employee,
          name: employee.user?.name,
          email: employee.user?.email
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

  const handleEditEmployee = (employee: Employee) => {
    setSelectedEmployee(employee);
    setIsEditModalOpen(true);
  };

  const handleDeleteEmployee = async (employeeId: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus karyawan ini? Semua data terkait (kehadiran, penggajian) juga akan dihapus.")) {
      return;
    }
    
    try {
      const response = await fetch(`/api/employees/${employeeId}`, {
        method: "DELETE",
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData.error || "Gagal menghapus karyawan";
        console.error("Error response:", errorData);
        alert(errorMessage);
        throw new Error(errorMessage);
      }
      
      // Jika berhasil, perbarui daftar karyawan
      setEmployees(employees.filter((emp) => emp.id !== employeeId));
      
      // Tampilkan informasi tentang data yang dihapus
      const responseData = await response.json();
      alert(responseData.message || "Karyawan berhasil dihapus");
      
      // Log informasi tentang data terkait yang dihapus
      if (responseData.deletedRelatedData) {
        console.log("Data terkait yang dihapus:", responseData.deletedRelatedData);
      }
    } catch (error: any) {
      console.error("Error deleting employee:", error);
      
      // Coba identifikasi kemungkinan penyebab kesalahan
      let errorMessage = "Gagal menghapus karyawan: ";
      
      if (error.message.includes("foreign key constraint")) {
        errorMessage += "Karyawan ini memiliki data terkait yang tidak dapat dihapus secara otomatis. Hubungi administrator sistem.";
      } else if (error.message.includes("not found")) {
        errorMessage += "Karyawan tidak ditemukan.";
      } else {
        errorMessage += error.message || "Terjadi kesalahan pada server.";
      }
      
      alert(errorMessage);
    }
  };

  const handleToggleStatus = async (employeeId: string, currentStatus: boolean) => {
    try {
      const employee = employees.find(emp => emp.id === employeeId);
      if (!employee) return;
      
      const response = await fetch(`/api/employees/${employeeId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          ...employee,
          isActive: !currentStatus 
        }),
      });
      
      if (!response.ok) {
        throw new Error("Failed to update employee status");
      }
      
      setEmployees(
        employees.map((emp) =>
          emp.id === employeeId ? { ...emp, isActive: !currentStatus } : emp
        )
      );
    } catch (error) {
      console.error("Error updating employee status:", error);
    }
  };

  const handleAddEmployeeSubmit = async (data: EmployeeFormValues) => {
    try {
      const response = await fetch("/api/employees", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error("Failed to add employee");
      }
      
      const newEmployee = await response.json();
      
      // Ensure the employee object has the correct structure
      const formattedEmployee = {
        ...newEmployee,
        name: newEmployee.user?.name,
        email: newEmployee.user?.email
      };
      
      setEmployees([...employees, formattedEmployee]);
    } catch (error) {
      console.error("Error adding employee:", error);
    }
  };

  const handleEditEmployeeSubmit = async (id: string, data: EmployeeEditFormValues) => {
    try {
      const response = await fetch(`/api/employees/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error("Failed to update employee");
      }
      
      const updatedEmployee = await response.json();
      
      // Update employees array with the updated employee data
      setEmployees(
        employees.map((emp) => 
          emp.id === id 
            ? {
                ...updatedEmployee,
                name: data.name,
                email: data.email
              }
            : emp
        )
      );
    } catch (error) {
      console.error("Error updating employee:", error);
    }
  };

  // Filter employees based on search term and department
  const filteredEmployees = employees.filter((employee) => {
    const matchesSearchTerm = searchTerm === "" || (
      ((employee.user?.name || employee.name || "").toLowerCase()).includes(searchTerm.toLowerCase()) ||
      (employee.employeeId?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
      (employee.position?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
      ((employee.user?.email || employee.email || "").toLowerCase()).includes(searchTerm.toLowerCase())
    );
      
    const matchesDepartment = 
      filterDepartment === "" || employee.department === filterDepartment;
      
    return matchesSearchTerm && matchesDepartment;
  });

  // Get unique departments for filter dropdown
  const departments = [...new Set(employees.map((emp) => emp.department))];

  return (
    <div className="space-y-6">
      <div className="sm:flex sm:items-center sm:justify-between">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold text-gray-900">Employees</h1>
          <p className="mt-2 text-sm text-gray-700">
            A list of all employees in your organization including their name, position, department and status.
          </p>
        </div>
        <div className="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
          <button
            type="button"
            onClick={handleAddEmployee}
            className="block rounded-md bg-indigo-600 px-3 py-2 text-center text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 transition-colors duration-200"
          >
            <span className="flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="mr-1.5 h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
              Add Employee
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
            placeholder="Search employees..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="w-full sm:w-40">
          <select
            className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
            value={filterDepartment}
            onChange={(e) => setFilterDepartment(e.target.value)}
          >
            <option value="">All Departments</option>
            {departments.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>
        </div>
        <div className="w-full sm:w-40">
          <select
            className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-t-2 border-indigo-600"></div>
        </div>
      ) : (
        <div className="mt-8 flow-root">
          <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
            <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
              <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
                {filteredEmployees.length === 0 ? (
                  <div className="bg-white py-6 text-center">
                    <p className="text-gray-500">No employees found</p>
                  </div>
                ) : (
                  <table className="min-w-full divide-y divide-gray-300">
                    <thead className="bg-gray-50">
                      <tr>
                        <th
                          scope="col"
                          className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6"
                        >
                          Employee ID
                        </th>
                        <th
                          scope="col"
                          className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                        >
                          Name
                        </th>
                        <th
                          scope="col"
                          className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                        >
                          Position
                        </th>
                        <th
                          scope="col"
                          className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                        >
                          Department
                        </th>
                        <th
                          scope="col"
                          className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                        >
                          Status
                        </th>
                        <th
                          scope="col"
                          className="relative py-3.5 pl-3 pr-4 sm:pr-6"
                        >
                          <span className="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {filteredEmployees.map((employee) => (
                        <tr key={employee.id} className="hover:bg-gray-50">
                          <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                            {employee.employeeId}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                            <div className="font-medium text-gray-900">{employee.user?.name || employee.name}</div>
                            <div className="text-gray-500">{employee.user?.email || employee.email}</div>
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                            {employee.position}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                            {employee.department}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                            <span
                              className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                                employee.isActive
                                  ? "bg-green-100 text-green-800"
                                  : "bg-red-100 text-red-800"
                              }`}
                            >
                              {employee.isActive ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                            <div className="flex justify-end space-x-3">
                              <button
                                onClick={() => handleEditEmployee(employee)}
                                className="rounded-md bg-indigo-50 p-1.5 text-indigo-600 hover:bg-indigo-100 hover:text-indigo-900"
                                title="Edit"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                  <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => handleToggleStatus(employee.id, employee.isActive)}
                                className={`rounded-md p-1.5 ${
                                  employee.isActive
                                    ? "bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-900"
                                    : "bg-green-50 text-green-600 hover:bg-green-100 hover:text-green-900"
                                }`}
                                title={employee.isActive ? "Deactivate" : "Activate"}
                              >
                                {employee.isActive ? (
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                  </svg>
                                ) : (
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                  </svg>
                                )}
                              </button>
                              <button
                                onClick={() => handleDeleteEmployee(employee.id)}
                                className="rounded-md bg-red-50 p-1.5 text-red-600 hover:bg-red-100 hover:text-red-900"
                                title="Delete"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                              </button>
                            </div>
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

      {/* Edit Employee Modal */}
      <EditEmployeeModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSubmit={handleEditEmployeeSubmit}
        employee={selectedEmployee}
      />
    </div>
  );
} 