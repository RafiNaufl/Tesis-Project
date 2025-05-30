"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import AddEmployeeModal from "./AddEmployeeModal";
import EditEmployeeModal from "./EditEmployeeModal";

type Employee = {
  id: string;
  employeeId: string;
  name: string;
  position: string;
  department: string;
  isActive: boolean;
  email: string;
  basicSalary?: number;
  contactNumber?: string;
  address?: string;
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
  const router = useRouter();

  // In a real app, you would fetch this data from your API
  useEffect(() => {
    // Mock data for demo purposes
    const mockEmployees = [
      {
        id: "1",
        employeeId: "EMP001",
        name: "John Doe",
        position: "Software Engineer",
        department: "Engineering",
        isActive: true,
        email: "john@example.com",
        basicSalary: 5000,
      },
      {
        id: "2",
        employeeId: "EMP002",
        name: "Jane Smith",
        position: "HR Manager",
        department: "Human Resources",
        isActive: true,
        email: "jane@example.com",
        basicSalary: 6000,
      },
      {
        id: "3",
        employeeId: "EMP003",
        name: "Robert Johnson",
        position: "Accountant",
        department: "Finance",
        isActive: false,
        email: "robert@example.com",
        basicSalary: 4500,
      },
    ];
    setEmployees(mockEmployees);
  }, []);

  const handleAddEmployee = () => {
    setIsAddModalOpen(true);
  };

  const handleEditEmployee = (employee: Employee) => {
    setSelectedEmployee(employee);
    setIsEditModalOpen(true);
  };

  const handleDeleteEmployee = (employeeId: string) => {
    // In a real app, you would call your API
    setEmployees(employees.filter((emp) => emp.id !== employeeId));
  };

  const handleToggleStatus = (employeeId: string) => {
    // In a real app, you would call your API
    setEmployees(
      employees.map((emp) =>
        emp.id === employeeId ? { ...emp, isActive: !emp.isActive } : emp
      )
    );
  };

  const handleAddEmployeeSubmit = (data: EmployeeFormValues) => {
    // In a real app, you would call your API to create the employee
    const newEmployee: Employee = {
      id: Date.now().toString(),
      employeeId: `EMP${Math.floor(Math.random() * 1000)
        .toString()
        .padStart(3, "0")}`,
      name: data.name,
      position: data.position,
      department: data.department,
      isActive: true,
      email: data.email,
      basicSalary: data.basicSalary,
      contactNumber: data.contactNumber,
      address: data.address,
    };
    setEmployees([...employees, newEmployee]);
  };

  const handleEditEmployeeSubmit = (id: string, data: EmployeeEditFormValues) => {
    // In a real app, you would call your API to update the employee
    setEmployees(
      employees.map((emp) =>
        emp.id === id
          ? {
              ...emp,
              name: data.name,
              position: data.position,
              department: data.department,
              isActive: data.isActive,
              email: data.email,
              basicSalary: data.basicSalary,
              contactNumber: data.contactNumber,
              address: data.address,
            }
          : emp
      )
    );
  };

  return (
    <div className="space-y-6">
      <div className="sm:flex sm:items-center">
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
            className="block rounded-md bg-indigo-600 px-3 py-2 text-center text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            Add Employee
          </button>
        </div>
      </div>

      <div className="mt-8 flow-root">
        <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
            <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
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
                  {employees.map((employee) => (
                    <tr key={employee.id}>
                      <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                        {employee.employeeId}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        {employee.name}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        {employee.position}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        {employee.department}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        <span
                          className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${
                            employee.isActive
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {employee.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                        <button
                          onClick={() => handleEditEmployee(employee)}
                          className="text-indigo-600 hover:text-indigo-900 mr-4"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleToggleStatus(employee.id)}
                          className={`${
                            employee.isActive
                              ? "text-red-600 hover:text-red-900"
                              : "text-green-600 hover:text-green-900"
                          } mr-4`}
                        >
                          {employee.isActive ? "Deactivate" : "Activate"}
                        </button>
                        <button
                          onClick={() => handleDeleteEmployee(employee.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

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