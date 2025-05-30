# Employee Management System

A comprehensive employee management system that handles attendance tracking and payroll management.

## Features

- User Authentication (Admin/Employee)
- Attendance Tracking
- Payroll Management
- Reporting
- Role-based Access Control

## Tech Stack

- Next.js 15 (React framework)
- TypeScript
- Tailwind CSS (Styling)
- NextAuth.js (Authentication)
- Prisma (ORM)
- PostgreSQL (Database)
- React Hook Form (Form handling)
- Zod (Validation)

## Getting Started

### Prerequisites

- Node.js 18+ installed
- PostgreSQL installed and running

### Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd employee-management-system
```

2. Install dependencies:

```bash
npm install
```

3. Configure the environment variables:

Edit the `.env` file with your database connection details:

```
DATABASE_URL="postgresql://postgres:password@localhost:5432/employee_system"
NEXTAUTH_SECRET="your-secret-key-change-in-production"
NEXTAUTH_URL="http://localhost:3000"
```

4. Set up the database:

```bash
npx prisma db push
```

5. Seed the database with initial data:

```bash
npx prisma db seed
```

6. Start the development server:

```bash
npm run dev
```

7. Access the application at http://localhost:3000

## Default Admin Account

After seeding the database, you can login with:

- Email: admin@example.com
- Password: admin123

## Database Schema

The database consists of the following tables:

- users
- employees
- attendances
- payrolls
- deductions
- allowances

## License

This project is licensed under the MIT License.
