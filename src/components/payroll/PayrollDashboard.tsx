"use client";

import { useState } from "react";
import PayrollManagement from "@/components/payroll/PayrollManagement";
import AdvanceRequest from "@/components/payroll/AdvanceRequest";
import SoftLoanRequest from "@/components/payroll/SoftLoanRequest";
import AdvanceApproval from "@/components/payroll/AdvanceApproval";
import SoftLoanApproval from "@/components/payroll/SoftLoanApproval";

interface PayrollDashboardProps {
  user: {
    id: string;
    role: string;
    name?: string;
  };
}

export default function PayrollDashboard({ user }: PayrollDashboardProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const isAdmin = user.role === 'ADMIN';

  const employeeTabs = [
    { id: 'overview', name: 'Ringkasan Gaji', component: <PayrollManagement /> },
    { id: 'advance', name: 'Input Kasbon', component: <AdvanceRequest onSuccess={() => {}} /> },
    { id: 'softloan', name: 'Input Pinjaman Lunak', component: <SoftLoanRequest onSuccess={() => {}} /> },
  ];

  const adminTabs = [
    { id: 'overview', name: 'Manajemen Gaji', component: <PayrollManagement /> },
    { id: 'advance-approval', name: 'Approval Kasbon', component: <AdvanceApproval /> },
    { id: 'softloan-approval', name: 'Approval Pinjaman Lunak', component: <SoftLoanApproval /> },
  ];

  const tabs = isAdmin ? adminTabs : employeeTabs;

  return (
    <div className="space-y-6">
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              } whitespace-nowrap border-b-2 py-2 px-1 text-sm font-medium`}
            >
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      <div className="mt-6">
        {tabs.find(tab => tab.id === activeTab)?.component}
      </div>
    </div>
  );
}