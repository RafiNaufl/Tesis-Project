# Migration Guide: Department to Division Rename

## Overview
As of December 2025, the codebase has undergone a significant refactoring to rename "Department" to "Division". This change reflects the organizational structure more accurately and aligns with the new business requirements.

## Database Changes
The `Employee` table schema has been updated. The field `department` has been renamed to `division`.

### Schema Update
```prisma
model Employee {
  // ...
  division      String    // Renamed from department
  // ...
}
```

### Applying Changes
1.  **Generate Prisma Client**:
    ```bash
    npx prisma generate
    ```

2.  **Push Schema Changes**:
    ```bash
    npx prisma db push
    ```
    *Note: This might require a database reset if you have existing data that conflicts with the new schema constraints.*

3.  **Seed Data**:
    The seed scripts have been updated to use `division`.
    ```bash
    npx prisma db seed
    ```

## Code Changes
All references to `department` in the context of employee organization have been renamed to `division`.

### Affected Areas
1.  **API Routes**:
    - `POST /api/employees`: Expects `division` in the request body instead of `department`.
    - `GET /api/employees`: Returns objects with `division` property.
    - `PUT /api/employees/[id]`: Expects `division` in the request body.

2.  **Frontend Components**:
    - `EmployeeManagement.tsx`: Filters and displays "Division".
    - `AddEmployeeModal.tsx` & `EditEmployeeModal.tsx`: Form fields use `division`.
    - `RegistrationForm.tsx`: Registration now asks for Division.

3.  **Types & Interfaces**:
    - `Employee` type in TypeScript files now has `division: string`.
    - Zod schemas in `src/lib/registrationValidation.ts` validate `division`.

## Backward Compatibility
While we attempted to update all occurrences, some legacy logs or comments might still refer to "department". Functionally, `division` is the source of truth.

## Action Items for Developers
-   Search your local branches for `department` and rename to `division` where applicable.
-   Update any local environment variables or scripts that might rely on the old naming convention.
-   Run the test suite to ensure no regressions:
    ```bash
    npm test
    ```
