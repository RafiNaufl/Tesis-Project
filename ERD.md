# Entity Relationship Diagram (ERD) - Sistem Manajemen Absensi dan Payroll

## Ringkasan Entitas dan Relasi

Berikut adalah ERD lengkap untuk sistem manajemen karyawan, absensi, dan penggajian.

```mermaid
erDiagram
    USER ||--o| EMPLOYEE : "has profile"
    USER ||--o{ NOTIFICATION : "receives"
    USER ||--o{ DEVICE_TOKEN : "uses"
    USER ||--o{ SESSION : "has"
    
    EMPLOYEE ||--o{ ATTENDANCE : "records"
    EMPLOYEE ||--o{ PAYROLL : "earns"
    EMPLOYEE ||--o{ LEAVE : "takes"
    EMPLOYEE ||--o{ OVERTIME_REQUEST : "requests"
    EMPLOYEE ||--o{ ADVANCE : "borrows"
    EMPLOYEE ||--o{ SOFT_LOAN : "repays"
    EMPLOYEE ||--o{ ALLOWANCE : "receives"
    EMPLOYEE ||--o{ DEDUCTION : "has"
    EMPLOYEE ||--o{ EMPLOYEE_ID_LOG : "has"
    
    ATTENDANCE ||--o{ APPROVAL_LOG : "has"
    ATTENDANCE ||--o{ ATTENDANCE_AUDIT_LOG : "has"
    
    PAYROLL ||--o{ PAYROLL_AUDIT_LOG : "has"
    PAYROLL ||--o{ ALLOWANCE : "includes"
    PAYROLL ||--o{ DEDUCTION : "includes"
    
    USER {
        string id PK
        string name
        string email UK
        string hashedPassword
        string profileImageUrl
        string role
        datetime createdAt
        datetime updatedAt
    }
    
    DEVICE_TOKEN {
        string id PK
        string userId FK
        string token UK
        string platform
        datetime createdAt
        datetime updatedAt
    }
    
    SESSION {
        string id PK
        string sessionToken UK
        string userId FK
        datetime expires
    }
    
    EMPLOYEE {
        string id PK
        string employeeId UK
        string userId FK UK
        string position
        string division
        float basicSalary
        datetime joiningDate
        string contactNumber UK
        string address
        boolean isActive
        string organization
        string employmentStatus
        string workScheduleType
        float hourlyRate
        float bpjsKesehatan
        float bpjsKetenagakerjaan
    }
    
    ORGANIZATION {
        string id PK
        string name
        string code UK
        int currentSequence
        datetime createdAt
        datetime updatedAt
    }
    
    EMPLOYEE_ID_LOG {
        string id PK
        string employeeId FK
        string oldEmployeeId
        string newEmployeeId
        string changedBy
        string reason
        datetime createdAt
    }
    
    NOTIFICATION {
        string id PK
        string userId FK
        string title
        string message
        string type
        boolean read
        string refType
        string refId
        datetime createdAt
    }
    
    ATTENDANCE {
        string id PK
        string employeeId FK
        datetime date
        datetime updatedAt
        datetime checkIn
        datetime checkOut
        datetime overtimeStart
        datetime overtimeEnd
        string status
        string notes
        boolean isLate
        int lateMinutes
        int overtime
        boolean isOvertimeApproved
        boolean isSundayWork
        boolean isSundayWorkApproved
        string approvedBy
        datetime approvedAt
        float checkInLatitude
        float checkInLongitude
        string checkInPhotoUrl
        float checkOutLatitude
        float checkOutLongitude
        string checkOutPhotoUrl
        float overtimeStartLatitude
        float overtimeStartLongitude
        string overtimeStartPhotoUrl
        string overtimeStartAddressNote
        float overtimeEndLatitude
        float overtimeEndLongitude
        string overtimeEndPhotoUrl
        string overtimeEndAddressNote
        string lateReason
        string latePhotoUrl
        datetime lateSubmittedAt
        string lateApprovalStatus
    }
    
    APPROVAL_LOG {
        string id PK
        string attendanceId FK
        string action
        string actorUserId
        string note
        datetime createdAt
    }
    
    AUDIT_LOG {
        string id PK
        string actorUserId
        string action
        string attendanceId FK
        string employeeId FK
        string ip
        string userAgent
        json metadata
        datetime createdAt
    }
    
    ATTENDANCE_AUDIT_LOG {
        string id PK
        string attendanceId FK
        string userId
        string action
        json oldValue
        json newValue
        datetime timestamp
    }
    
    PAYROLL {
        string id PK
        string employeeId FK
        int month
        int year
        float baseSalary
        float totalAllowances
        float totalDeductions
        float netSalary
        float daysPresent
        float daysAbsent
        int daysLate
        float overtimeHours
        float overtimeAmount
        float payableHours
        float lateDeduction
        float advanceDeduction
        float softLoanDeduction
        float bpjsKesehatanAmount
        float bpjsKetenagakerjaanAmount
        string status
        datetime createdAt
        datetime paidAt
    }
    
    PAYROLL_AUDIT_LOG {
        string id PK
        string payrollId FK
        string userId
        string action
        json oldValue
        json newValue
        datetime timestamp
    }
    
    COMPANY_WORK_HOURS {
        string id PK
        string weekdayStart
        string weekdayEnd
        string saturdayStart
        string saturdayEnd
        string lateThreshold
        datetime effectiveDate
    }
    
    PENALTY_CONFIG {
        string id PK
        float latePerDayAmount
        float maxLateDailyPercent
        float absencePenaltyPercent
        datetime effectiveDate
    }
    
    OVERTIME_CONFIG {
        string id PK
        float rateMultiplier
        float sundayMultiplier
        float holidayMultiplier
        float maxDailyOvertimeHours
        datetime effectiveDate
    }
    
    PAYROLL_CONFIG {
        string id PK
        float minMonthlyWage
        float minHourlyWage
        datetime effectiveDate
    }
    
    PUBLIC_HOLIDAY {
        string id PK
        datetime date UK
        string description
    }
    
    OVERTIME_REQUEST {
        string id PK
        string employeeId FK
        datetime date
        datetime start
        datetime end
        string reason
        string status
        string approvedBy
        datetime approvedAt
        string notes
        datetime createdAt
        datetime updatedAt
    }
    
    ALLOWANCE {
        string id PK
        string employeeId FK
        int month
        int year
        string type
        float amount
        datetime date
        string payrollId FK
    }
    
    DEDUCTION {
        string id PK
        string employeeId FK
        int month
        int year
        string reason
        float amount
        datetime date
        string type
        string payrollId FK
    }
    
    LEAVE {
        string id PK
        string employeeId FK
        datetime startDate
        datetime endDate
        string reason
        string type
        string status
        string approvedBy
        datetime approvedAt
        datetime createdAt
    }
    
    ADVANCE {
        string id PK
        string employeeId FK
        float amount
        int month
        int year
        string reason
        string status
        string rejectionReason
        int deductionMonth
        int deductionYear
        datetime createdAt
        datetime deductedAt
    }
    
    SOFT_LOAN {
        string id PK
        string employeeId FK
        float totalAmount
        float monthlyAmount
        float remainingAmount
        int durationMonths
        int startMonth
        int startYear
        string reason
        string status
        string approvedBy
        datetime approvedAt
        datetime createdAt
        datetime updatedAt
        datetime completedAt
    }
    
    OFFICE_LOCATION {
        string id PK
        string name
        float latitude
        float longitude
        float radius
        datetime createdAt
        datetime updatedAt
    }
```

## Penjelasan Entitas Utama

### 1. Authentication & User Management
- **USER**: Akun autentikasi pengguna sistem
- **EMPLOYEE**: Profil karyawan yang terkait dengan USER (1:1)
- **SESSION**: Sesi login pengguna
- **DEVICE_TOKEN**: Token perangkat untuk notifikasi push
- **NOTIFICATION**: Notifikasi sistem untuk pengguna

### 2. Employee & Organization
- **EMPLOYEE**: Data utama karyawan
- **ORGANIZATION**: Struktur organisasi/perusahaan
- **EMPLOYEE_ID_LOG**: Log perubahan ID karyawan

### 3. Attendance
- **ATTENDANCE**: Catatan absensi harian karyawan
- **APPROVAL_LOG**: Log persetujuan absensi/lembur
- **ATTENDANCE_AUDIT_LOG**: Audit log perubahan data absensi
- **OVERTIME_REQUEST**: Permintaan lembur karyawan
- **LEAVE**: Permintaan izin/cuti karyawan

### 4. Payroll
- **PAYROLL**: Slip gaji bulanan
- **ALLOWANCE**: Tunjangan karyawan
- **DEDUCTION**: Potongan gaji
- **PAYROLL_AUDIT_LOG**: Audit log perubahan payroll
- **ADVANCE**: Pinjaman gaji karyawan
- **SOFT_LOAN**: Pinjaman lunak karyawan

### 5. Configuration
- **COMPANY_WORK_HOURS**: Pengaturan jam kerja perusahaan
- **PENALTY_CONFIG**: Pengaturan denda keterlambatan
- **OVERTIME_CONFIG**: Pengaturan perhitungan lembur
- **PAYROLL_CONFIG**: Pengaturan penggajian (UMR, dll.)
- **PUBLIC_HOLIDAY**: Hari libur nasional
- **OFFICE_LOCATION**: Lokasi kantor untuk validasi absensi

### 6. Audit
- **AUDIT_LOG**: Log aktivitas umum sistem

## Kardinalitas Relasi

| Relasi | Jenis | Deskripsi |
|--------|-------|-----------|
| USER ↔ EMPLOYEE | 1:1 | Satu user memiliki satu profil karyawan |
| USER ↔ NOTIFICATION | 1:N | Satu user menerima banyak notifikasi |
| USER ↔ DEVICE_TOKEN | 1:N | Satu user memiliki banyak device token |
| USER ↔ SESSION | 1:N | Satu user memiliki banyak sesi login |
| EMPLOYEE ↔ ATTENDANCE | 1:N | Satu karyawan memiliki banyak catatan absensi |
| EMPLOYEE ↔ PAYROLL | 1:N | Satu karyawan memiliki banyak slip gaji |
| EMPLOYEE ↔ LEAVE | 1:N | Satu karyawan mengajukan banyak izin/cuti |
| EMPLOYEE ↔ OVERTIME_REQUEST | 1:N | Satu karyawan mengajukan banyak permintaan lembur |
| EMPLOYEE ↔ ADVANCE | 1:N | Satu karyawan memiliki banyak pinjaman gaji |
| EMPLOYEE ↔ SOFT_LOAN | 1:N | Satu karyawan memiliki banyak pinjaman lunak |
| EMPLOYEE ↔ ALLOWANCE | 1:N | Satu karyawan menerima banyak tunjangan |
| EMPLOYEE ↔ DEDUCTION | 1:N | Satu karyawan memiliki banyak potongan |
| ATTENDANCE ↔ APPROVAL_LOG | 1:N | Satu absensi memiliki banyak log approval |
| ATTENDANCE ↔ ATTENDANCE_AUDIT_LOG | 1:N | Satu absensi memiliki banyak audit log |
| PAYROLL ↔ PAYROLL_AUDIT_LOG | 1:N | Satu payroll memiliki banyak audit log |
| PAYROLL ↔ ALLOWANCE | 1:N | Satu payroll termasuk banyak tunjangan |
| PAYROLL ↔ DEDUCTION | 1:N | Satu payroll termasuk banyak potongan |

## Notasi Kode
- **PK**: Primary Key (Kunci Primer)
- **FK**: Foreign Key (Kunci Asing)
- **UK**: Unique Key (Kunci Unik)
- **1:1**: One-to-One (Satu ke Satu)
- **1:N**: One-to-Many (Satu ke Banyak)

