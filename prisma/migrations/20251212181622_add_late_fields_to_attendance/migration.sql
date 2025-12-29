-- AlterTable
ALTER TABLE "attendances" ADD COLUMN "lateApprovalStatus" TEXT DEFAULT 'PENDING_LATE_APPROVAL';
ALTER TABLE "attendances" ADD COLUMN "latePhotoUrl" TEXT;
ALTER TABLE "attendances" ADD COLUMN "lateReason" TEXT;
ALTER TABLE "attendances" ADD COLUMN "lateSubmittedAt" DATETIME;
