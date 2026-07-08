import { PrismaClient } from '@prisma/client';
import { startOfDay, toDate } from 'date-fns';
import { toWIB } from '../src/lib/attendanceRules.js';

const prisma = new PrismaClient();

async function main() {
  // Get today in WIB
  const now = new Date();
  const todayWIB = toWIB(now);
  const todayStart = startOfDay(todayWIB);
  
  console.log('Menghapus data attendance untuk tanggal:', todayStart.toISOString());
  
  // First, let's see what records exist
  const existingRecords = await prisma.attendance.findMany({
    where: {
      date: {
        gte: todayStart,
        lt: new Date(todayStart.getTime() + 24 * 60 * 60 * 1000)
      }
    },
    include: {
      employee: true
    }
  });
  
  console.log('Jumlah record yang ditemukan:', existingRecords.length);
  existingRecords.forEach(record => {
    console.log(`- Record ID: ${record.id}, Employee: ${record.employee?.employeeId || record.employeeId}, CheckIn: ${record.checkIn}, CheckOut: ${record.checkOut}`);
  });
  
  // Delete related records first (to avoid foreign key constraints)
  for (const record of existingRecords) {
    console.log(`Menghapus record terkait untuk attendance ID: ${record.id}`);
    
    await prisma.approvalLog.deleteMany({ where: { attendanceId: record.id } });
    await prisma.attendanceAuditLog.deleteMany({ where: { attendanceId: record.id } });
    await prisma.overtimeRequest.deleteMany({ where: { attendanceId: record.id } });
    
    // Now delete the attendance record
    await prisma.attendance.delete({ where: { id: record.id } });
    
    console.log(`Record attendance ${record.id} berhasil dihapus!`);
  }
  
  console.log('Selesai! Semua record attendance hari ini telah dihapus.');
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
