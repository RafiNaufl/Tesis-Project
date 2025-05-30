"use client";

import { useEffect, useState } from "react";

type DashboardStats = {
  totalEmployees: number;
  presentToday: number;
  pendingPayrolls: number;
  totalSalaryExpense: number;
};

type ActivityItem = {
  id: string;
  employeeName: string;
  action: string;
  time: string;
  status: string;
};

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalEmployees: 0,
    presentToday: 0,
    pendingPayrolls: 0,
    totalSalaryExpense: 0,
  });
  const [recentActivities, setRecentActivities] = useState<ActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      setIsLoading(true);
      try {
        // Fetch dashboard statistics
        const statsResponse = await fetch('/api/reports/summary');
        if (!statsResponse.ok) throw new Error('Failed to fetch dashboard stats');
        const statsData = await statsResponse.json();
        
        // Fetch recent attendance activity
        const activityResponse = await fetch('/api/attendance?limit=5');
        if (!activityResponse.ok) throw new Error('Failed to fetch recent activities');
        const activityData = await activityResponse.json();
        
        // Format the data for our components
        setStats({
          totalEmployees: statsData.payroll.employeeCount || 0,
          presentToday: statsData.attendance.presentCount || 0,
          pendingPayrolls: statsData.payroll.pendingCount || 0,
          totalSalaryExpense: statsData.payroll.totalNetSalary || 0,
        });
        
        // Format attendance records as activities
        const activities = activityData.map((item: any) => ({
          id: item.id,
          employeeName: item.employee?.user?.name || "Unknown Employee",
          action: item.status === "PRESENT" ? "checked in" : 
                 item.status === "ABSENT" ? "is absent" : 
                 item.status === "LATE" ? "checked in late" : "is on half day",
          time: new Date(item.checkIn || item.date).toLocaleString([], {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
          }),
          status: item.status
        }));
        
        setRecentActivities(activities);
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Admin Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">
          Overview of your organization
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Employees */}
        <div className="overflow-hidden rounded-lg bg-white shadow">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg
                  className="h-6 w-6 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="1.5"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
                  />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Total Employees
                  </dt>
                  <dd>
                    <div className="text-lg font-medium text-gray-900">
                      {isLoading ? "Loading..." : stats.totalEmployees}
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* Present Today */}
        <div className="overflow-hidden rounded-lg bg-white shadow">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg
                  className="h-6 w-6 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="1.5"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M11.35 3.836c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m8.9-4.414c.376.023.75.05 1.124.08 1.131.094 1.976 1.057 1.976 2.192V16.5A2.25 2.25 0 0118 18.75h-2.25m-7.5-10.5H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V18.75m-7.5-10.5h6.375c.621 0 1.125.504 1.125 1.125v9.375m-8.25-3l1.5 1.5 3-3.75"
                  />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Present Today
                  </dt>
                  <dd>
                    <div className="text-lg font-medium text-gray-900">
                      {isLoading ? "Loading..." : stats.presentToday}
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* Pending Payrolls */}
        <div className="overflow-hidden rounded-lg bg-white shadow">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg
                  className="h-6 w-6 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="1.5"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Pending Payrolls
                  </dt>
                  <dd>
                    <div className="text-lg font-medium text-gray-900">
                      {isLoading ? "Loading..." : stats.pendingPayrolls}
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* Total Salary Expense */}
        <div className="overflow-hidden rounded-lg bg-white shadow">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg
                  className="h-6 w-6 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="1.5"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 01-.75.75h-.75m-6-1.5H3.375c-.621 0-1.125-.504-1.125-1.125V15c0-.621.504-1.125 1.125-1.125H9.75"
                  />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Total Salary Expense
                  </dt>
                  <dd>
                    <div className="text-lg font-medium text-gray-900">
                      {isLoading ? "Loading..." : `$${stats.totalSalaryExpense.toLocaleString()}`}
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="overflow-hidden bg-white shadow sm:rounded-md">
        <div className="px-4 py-5 sm:px-6">
          <h3 className="text-lg font-medium leading-6 text-gray-900">
            Recent Activities
          </h3>
        </div>
        {isLoading ? (
          <div className="px-4 py-5 sm:p-6 text-center">Loading recent activities...</div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {recentActivities.length > 0 ? (
              recentActivities.map((activity) => (
                <li key={activity.id}>
                  <div className="px-4 py-4 sm:px-6">
                    <div className="flex items-center justify-between">
                      <p className="truncate text-sm font-medium text-indigo-600">
                        {activity.employeeName} {activity.action}
                      </p>
                      <div className="ml-2 flex flex-shrink-0">
                        <p className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 
                          ${activity.status === "PRESENT" ? "bg-green-100 text-green-800" :
                            activity.status === "ABSENT" ? "bg-red-100 text-red-800" :
                            activity.status === "LATE" ? "bg-yellow-100 text-yellow-800" : 
                            "bg-gray-100 text-gray-800"}`}>
                          {activity.time}
                        </p>
                      </div>
                    </div>
                  </div>
                </li>
              ))
            ) : (
              <li>
                <div className="px-4 py-4 sm:px-6 text-center">
                  No recent activities found
                </div>
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
} 