"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

const employeeFormSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters" }),
  email: z.string().email({ message: "Please enter a valid email address" }),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
  position: z.string().min(2, { message: "Position is required" }),
  department: z.string().min(2, { message: "Department is required" }),
  basicSalary: z.coerce.number().min(0, { message: "Salary must be a positive number" }),
  contactNumber: z.string().optional(),
  address: z.string().optional(),
});

type EmployeeFormValues = z.infer<typeof employeeFormSchema>;

type AddEmployeeModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: EmployeeFormValues) => void;
};

const departments = [
  "Engineering",
  "Human Resources",
  "Finance",
  "Marketing",
  "Sales",
  "Operations",
  "Customer Support",
  "Research & Development",
  "Legal",
  "Administration"
];

export default function AddEmployeeModal({
  isOpen,
  onClose,
  onSubmit,
}: AddEmployeeModalProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeFormSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      position: "",
      department: "",
      basicSalary: 0,
      contactNumber: "",
      address: "",
    },
  });

  const handleFormSubmit = (data: EmployeeFormValues) => {
    onSubmit(data);
    reset();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          aria-hidden="true"
          onClick={onClose}
        ></div>

        {/* Modal positioning */}
        <span
          className="hidden sm:inline-block sm:h-screen sm:align-middle"
          aria-hidden="true"
        >
          &#8203;
        </span>

        {/* Modal content */}
        <div className="relative inline-block transform overflow-hidden rounded-lg bg-white text-left align-bottom shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:align-middle">
          {/* Modal header */}
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="sm:flex sm:items-start">
              <div className="mt-3 w-full text-center sm:mt-0 sm:text-left">
                <div className="flex items-center justify-between">
                  <h3
                    className="text-lg font-medium leading-6 text-gray-900"
                    id="modal-title"
                  >
                    Add New Employee
                  </h3>
                  <button
                    type="button"
                    className="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                    onClick={onClose}
                  >
                    <span className="sr-only">Close</span>
                    <svg
                      className="h-6 w-6"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth="1.5"
                      stroke="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>

                <div className="mt-4">
                  <form onSubmit={handleSubmit(handleFormSubmit)}>
                    <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">
                      <div>
                        <label
                          htmlFor="name"
                          className="block text-sm font-medium text-gray-700"
                        >
                          Full Name <span className="text-red-500">*</span>
                        </label>
                        <div className="mt-1">
                          <input
                            type="text"
                            id="name"
                            {...register("name")}
                            className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                            placeholder="John Doe"
                          />
                          {errors.name && (
                            <p className="mt-2 text-sm text-red-600">
                              {errors.name.message}
                            </p>
                          )}
                        </div>
                      </div>

                      <div>
                        <label
                          htmlFor="email"
                          className="block text-sm font-medium text-gray-700"
                        >
                          Email <span className="text-red-500">*</span>
                        </label>
                        <div className="mt-1">
                          <input
                            type="email"
                            id="email"
                            {...register("email")}
                            className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                            placeholder="johndoe@example.com"
                          />
                          {errors.email && (
                            <p className="mt-2 text-sm text-red-600">
                              {errors.email.message}
                            </p>
                          )}
                        </div>
                      </div>

                      <div>
                        <label
                          htmlFor="password"
                          className="block text-sm font-medium text-gray-700"
                        >
                          Password <span className="text-red-500">*</span>
                        </label>
                        <div className="mt-1">
                          <input
                            type="password"
                            id="password"
                            {...register("password")}
                            className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                            placeholder="••••••••"
                          />
                          {errors.password && (
                            <p className="mt-2 text-sm text-red-600">
                              {errors.password.message}
                            </p>
                          )}
                        </div>
                      </div>

                      <div>
                        <label
                          htmlFor="position"
                          className="block text-sm font-medium text-gray-700"
                        >
                          Position <span className="text-red-500">*</span>
                        </label>
                        <div className="mt-1">
                          <input
                            type="text"
                            id="position"
                            {...register("position")}
                            className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                            placeholder="Software Engineer"
                          />
                          {errors.position && (
                            <p className="mt-2 text-sm text-red-600">
                              {errors.position.message}
                            </p>
                          )}
                        </div>
                      </div>

                      <div>
                        <label
                          htmlFor="department"
                          className="block text-sm font-medium text-gray-700"
                        >
                          Department <span className="text-red-500">*</span>
                        </label>
                        <div className="mt-1">
                          <select
                            id="department"
                            {...register("department")}
                            className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                          >
                            <option value="">Select a department</option>
                            {departments.map((dept) => (
                              <option key={dept} value={dept}>
                                {dept}
                              </option>
                            ))}
                          </select>
                          {errors.department && (
                            <p className="mt-2 text-sm text-red-600">
                              {errors.department.message}
                            </p>
                          )}
                        </div>
                      </div>

                      <div>
                        <label
                          htmlFor="basicSalary"
                          className="block text-sm font-medium text-gray-700"
                        >
                          Basic Salary <span className="text-red-500">*</span>
                        </label>
                        <div className="mt-1 relative rounded-md shadow-sm">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <span className="text-gray-500 sm:text-sm">$</span>
                          </div>
                          <input
                            type="number"
                            id="basicSalary"
                            {...register("basicSalary")}
                            className="block w-full rounded-md border border-gray-300 bg-white pl-7 pr-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                            placeholder="0.00"
                          />
                          {errors.basicSalary && (
                            <p className="mt-2 text-sm text-red-600">
                              {errors.basicSalary.message}
                            </p>
                          )}
                        </div>
                      </div>

                      <div>
                        <label
                          htmlFor="contactNumber"
                          className="block text-sm font-medium text-gray-700"
                        >
                          Contact Number
                        </label>
                        <div className="mt-1">
                          <input
                            type="text"
                            id="contactNumber"
                            {...register("contactNumber")}
                            className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                            placeholder="+1 (555) 123-4567"
                          />
                          {errors.contactNumber && (
                            <p className="mt-2 text-sm text-red-600">
                              {errors.contactNumber.message}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="sm:col-span-2">
                        <label
                          htmlFor="address"
                          className="block text-sm font-medium text-gray-700"
                        >
                          Address
                        </label>
                        <div className="mt-1">
                          <textarea
                            id="address"
                            rows={3}
                            {...register("address")}
                            className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                            placeholder="123 Main St, Anytown, ST 12345"
                          />
                          {errors.address && (
                            <p className="mt-2 text-sm text-red-600">
                              {errors.address.message}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 sm:mt-8 sm:flex sm:flex-row-reverse">
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="inline-flex w-full justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:bg-indigo-300 disabled:cursor-not-allowed sm:ml-3 sm:w-auto sm:text-sm transition-colors duration-200"
                      >
                        {isSubmitting ? "Adding..." : "Add Employee"}
                      </button>
                      <button
                        type="button"
                        onClick={onClose}
                        className="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:mt-0 sm:w-auto sm:text-sm transition-colors duration-200"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 