# System Diagrams & Architecture

This document contains the updated diagrams for the Payroll and Attendance System, representing the current implementation and logical structure.

## 1. Use Case Diagram System
Menggambarkan interaksi antara aktor (Admin & Karyawan) dengan fitur-fitur utama sistem.

```mermaid
graph TD
    subgraph Actors
        E[Employee]
        A[Admin]
    end

    subgraph "System Boundary: Payroll & Attendance"
        UC1(Login/Logout)
        UC2(Mark Attendance)
        UC3(Request Overtime/Leave)
        UC4(Request Advance/Loan)
        UC5(View Payslip)
        UC6(Manage Employees)
        UC7(Approve/Reject Requests)
        UC8(Generate Payroll)
        UC9(Configure System)
        UC10(View Reports)
    end

    E --> UC1
    E --> UC2
    E --> UC3
    E --> UC4
    E --> UC5

    A --> UC1
    A --> UC6
    A --> UC7
    A --> UC8
    A --> UC9
    A --> UC10
```

---

## 2. Entity Relationship Diagram (ERD)
Menunjukkan hubungan antar entitas data dalam sistem secara konseptual.

```mermaid
erDiagram
    USER ||--o| EMPLOYEE : "has profile"
    USER ||--o{ NOTIFICATION : "receives"
    USER ||--o{ DEVICE_TOKEN : "uses"
    
    EMPLOYEE ||--o{ ATTENDANCE : "records"
    EMPLOYEE ||--o{ PAYROLL : "earns"
    EMPLOYEE ||--o{ LEAVE : "takes"
    EMPLOYEE ||--o{ OVERTIME_REQUEST : "requests"
    EMPLOYEE ||--o{ ADVANCE : "borrows"
    EMPLOYEE ||--o{ SOFT_LOAN : "repays"
    
    ATTENDANCE ||--o{ APPROVAL_LOG : "validated by"
    PAYROLL ||--o{ DEDUCTION : "includes"
    PAYROLL ||--o{ ALLOWANCE : "includes"
```

---

## 3. Logical Record Structure (LRS)
Representasi detail dari skema database, termasuk tipe data, Primary Key (PK), dan Foreign Key (FK).

```mermaid
erDiagram
    users {
        string id PK
        string email UK
        string role
        datetime createdAt
    }
    employees {
        string id PK
        string userId FK
        string employeeId UK
        string position
        float basicSalary
        float hourlyRate
        boolean isActive
    }
    attendances {
        string id PK
        string employeeId FK
        datetime date
        datetime checkIn
        datetime checkOut
        string status
        boolean isLate
        int lateMinutes
    }
    payrolls {
        string id PK
        string employeeId FK
        int month
        int year
        float netSalary
        string status
    }
    deductions {
        string id PK
        string employeeId FK
        string payrollId FK
        float amount
        string type
    }
    allowances {
        string id PK
        string employeeId FK
        float amount
        string type
    }
    overtime_requests {
        string id PK
        string employeeId FK
        datetime date
        float hours
        string status
    }
    soft_loans {
        string id PK
        string employeeId FK
        float totalAmount
        float remainingAmount
        string status
    }

    users ||--o| employees : "1:1"
    employees ||--o{ attendances : "1:N"
    employees ||--o{ payrolls : "1:N"
    payrolls ||--o{ deductions : "1:N"
    employees ||--o{ overtime_requests : "1:N"
    employees ||--o{ soft_loans : "1:N"
```

---

## 4. Activity Diagram (Payroll Generation Process)
Alur kerja proses pembuatan payroll bulanan oleh Admin.

```mermaid
flowchart TD
    Start([Start Generation]) --> Input[Select Month & Year]
    Input --> Fetch[Phase 1: Fetch Employee Data]
    
    subgraph Calculation [Phase 2: Calculation Engine]
        Fetch --> Type{Schedule Type?}
        Type -- SHIFT --> CalcShift[Calculate Fixed Monthly Salary]
        Type -- NON-SHIFT --> CalcNonShift[Calculate Hourly/Daily Salary]
        
        CalcShift --> OT[Calculate Overtime]
        CalcNonShift --> OT
        
        OT --> Deduct[Calculate Deductions: BPJS, Loans, Advances]
        Deduct --> Result[Aggregate Total Net Salary]
    end
    
    Result --> Transaction[Phase 3: DB Transaction]
    
    subgraph DB_Transaction [Atomic Execution]
        Transaction --> Cleanup[Delete Existing PENDING Records]
        Cleanup --> Save[Insert New Payroll & Details]
        Save --> UpdateLoan{Update Loan Balance?}
        UpdateLoan -- Yes --> Mutate[Decrement Loan Remaining Amount]
        UpdateLoan -- No --> Audit[Insert Audit Log]
        Mutate --> Audit
    end
    
    Audit --> Commit[Commit Transaction]
    Commit --> End([End: Notify Admin])
```

---

## 5. Flowchart (Proses Absensi Harian)
Alur proses absensi harian karyawan (Check-in, Check-out, dan Lembur).

```mermaid
flowchart TD
    Start([Mulai]) --> Login{Terautentikasi?}
    Login -- Tidak --> Auth[Proses Login]
    Auth --> Login
    Login -- Ya --> Dash[Dashboard Karyawan]
    
    Dash --> Action{Pilih Aksi}
    
    subgraph Capture [Fase Pengambilan Data]
        Action -- "Check-in" --> SnapIn[Ambil Foto & Geolokasi]
        Action -- "Check-out" --> SnapOut[Ambil Foto & Geolokasi]
    end
    
    subgraph Validation [Fase Validasi & Aturan]
        SnapIn --> CheckInRule{Sudah Absen?}
        CheckInRule -- Ya --> ErrorIn[Tampilkan Error: Sudah Absen]
        CheckInRule -- Tidak --> CalcStatus[Hitung Status: On-time/Late/Sunday]
        
        SnapOut --> CheckOutRule{Sudah Check-in?}
        CheckOutRule -- Tidak --> ErrorOut[Tampilkan Error: Belum Check-in]
        CheckOutRule -- Ya --> CheckOT{Melewati Jam Kerja?}
    end
    
    subgraph Processing [Fase Pemrosesan]
        CalcStatus --> SaveIn[Simpan ke DB: Status & Jam Masuk]
        SaveIn --> NotifyIn[Kirim Notifikasi ke Karyawan]
        
        CheckOT -- Ya --> OTForm[Input Alasan Lembur & Persetujuan]
        CheckOT -- Tidak --> SaveOut[Simpan ke DB: Jam Keluar]
        OTForm --> SaveOut
        SaveOut --> CalcHours[Hitung Total Jam Kerja Harian]
    end
    
    ErrorIn --> Dash
    ErrorOut --> Dash
    NotifyIn --> End([Selesai])
    CalcHours --> End
```
