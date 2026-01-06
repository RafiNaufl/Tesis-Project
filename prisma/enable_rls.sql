-- Enable Row Level Security on all tables
-- This ensures that by default, no data is accessible via Supabase API (PostgREST)
-- unless explicit policies are created.

-- List of tables mapped from Prisma schema
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "employees" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "organizations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "employee_id_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "attendances" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "approval_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payrolls" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "company_work_hours" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "penalty_config" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "overtime_config" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public_holidays" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "overtime_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payroll_audit_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "attendance_audit_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payroll_config" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "deductions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "allowances" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "leaves" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "advances" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "soft_loans" ENABLE ROW LEVEL SECURITY;

-- Create policies for public access if needed (optional)
-- For example, if you want to allow authenticated users to read their own data.
-- Currently, we will just enable RLS to fix the "Unrestricted" warning.
-- Prisma (used by Next.js server side) connects as a privileged user and bypasses RLS by default.
-- So this change primarily secures the Supabase Data API.

-- Policy to allow Service Role (used by Prisma if configured correctly or backend scripts) to have full access
-- Note: The postgres/service_role user usually bypasses RLS anyway, but good to be explicit if using Supabase client.

-- Example: Allow users to read their own data (This is just a template, not applying blindly)
-- CREATE POLICY "Users can view own data" ON "users" FOR SELECT USING (auth.uid() = id);
