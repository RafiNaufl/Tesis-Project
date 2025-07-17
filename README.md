# Employee Management System

A comprehensive employee management system that handles attendance tracking, payroll management, and employee records with role-based access control.

## Features

### User Authentication
- Secure login for both administrators and employees
- Role-based access control (Admin/Employee)
- Session management with NextAuth.js

### Employee Management
- Complete employee profile management
- Add, edit, and delete employee records
- Department and position tracking
- Employee status management (active/inactive)

### Attendance Tracking
- Daily check-in and check-out functionality
- Automatic status calculation (Present/Late/Half-day/Absent)
- Monthly attendance reports
- Filtering by date, employee, and department

### Payroll Management
- Automated salary calculation based on attendance
- Support for allowances (transport, housing, etc.)
- Support for deductions (tax, insurance, etc.)
- Overtime calculation
- Monthly payslip generation
- Payroll status tracking (Pending/Paid)

### Notifications System
- System notifications for important events
- Attendance status notifications
- Payslip availability alerts
- Read/unread status tracking

### Reporting
- Employee attendance reports
- Payroll summary reports
- Department-wise reporting
- Exportable data formats

## Tech Stack

- **Frontend**: Next.js 15, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, TypeScript
- **Authentication**: NextAuth.js
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Form Handling**: React Hook Form
- **Validation**: Zod

## Getting Started

### Prerequisites

- Node.js 18+ installed
- PostgreSQL installed and running
- Git

### Installation

1. Install dependencies:

```bash
npm install
```

2. Configure the environment variables:

Create or edit the `.env` file with your database connection details:

```
DATABASE_URL="postgresql://postgres:password@localhost:5432/employee_system"
NEXTAUTH_SECRET="your-secret-key-change-in-production"
NEXTAUTH_URL="http://localhost:3000"
```

3. Set up the database:

```bash
npx prisma db push
```

4. Seed the database with initial data:

```bash
npx prisma db seed
```

5. Start the development server:

```bash
npm run dev
```

6. Access the application at http://localhost:3000

7. (Optional) Run Prisma Studio to manage your database visually:

```bash
npx prisma studio
```

This will start Prisma Studio on http://localhost:5555, providing a visual interface to view and edit your database data.

## Account Credentials

After seeding the database, you can login with the following accounts:

### Admin Account
- Email: admin@example.com
- Password: admin123

### Employee Accounts
- Email: employee@example.com
- Password: employee123
- Email: jane@example.com
- Password: employee123
- Email: robert@example.com
- Password: employee123

## Application Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/                # API Routes
│   │   ├── attendance/     # Attendance API
│   │   ├── auth/           # Authentication API
│   │   ├── employees/      # Employee Management API
│   │   ├── payroll/        # Payroll API
│   │   └── notifications/  # Notifications API
│   ├── dashboard/          # Dashboard pages
│   ├── login/              # Login page
│   ├── profile/            # User profile page
│   └── ...                 # Other pages
├── components/             # React components
│   ├── attendance/         # Attendance components
│   ├── employees/          # Employee management components
│   ├── layouts/            # Layout components
│   ├── payroll/            # Payroll components
│   └── ui/                 # UI components
├── lib/                    # Utility functions
│   ├── auth.ts             # Authentication helpers
│   ├── db.ts               # Database client
│   └── ...                 # Other utilities
└── generated/              # Generated files (Prisma client)
```

## API Routes

The application provides the following API endpoints:

- **Authentication**
  - `POST /api/auth/signin`: User login
  - `GET /api/auth/session`: Get current session
  - `POST /api/auth/signout`: User logout

- **Employees**
  - `GET /api/employees`: List all employees
  - `POST /api/employees`: Create a new employee
  - `GET /api/employees/:id`: Get employee details
  - `PUT /api/employees/:id`: Update employee
  - `DELETE /api/employees/:id`: Delete employee

- **Attendance**
  - `GET /api/attendance`: Get attendance records
  - `POST /api/attendance`: Check-in or check-out

- **Payroll**
  - `GET /api/payroll`: Get payroll records
  - `POST /api/payroll`: Generate payroll
  - `PUT /api/payroll/:id`: Update payroll status

- **Notifications**
  - `GET /api/notifications`: Get user notifications
  - `POST /api/notifications`: Create notification

## Database Schema

The database consists of the following tables:

- **users**: User authentication and role information
- **employees**: Employee details and job information
- **attendance**: Daily attendance records
- **payroll**: Monthly payroll records
- **deductions**: Salary deductions
- **allowances**: Salary allowances
- **notifications**: System notifications

## Development Tools

### Authentication Checker Scripts

The project includes several utility scripts to verify authentication functionality:

- **check-user.js**: Verifies admin user authentication
  ```bash
  node check-user.js
  ```

- **check-employee.js**: Verifies employee user authentication
  ```bash
  node check-employee.js
  ```

- **check-all-users.js**: Comprehensive authentication checker that tests:
  - Admin user authentication
  - Employee user authentication
  - Invalid password handling
  - Non-existent user handling
  ```bash
  node check-all-users.js
  ```

- **test-nextauth-session.js**: Tests NextAuth.js session endpoints
  ```bash
  node test-nextauth-session.js
  ```

