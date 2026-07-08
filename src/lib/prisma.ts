import { PrismaClient } from "../generated/prisma";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

const prismaLog: ("query" | "info" | "warn" | "error")[] = [];
if (process.env.PRISMA_LOG_QUERIES === "true") {
  prismaLog.push("query");
}
if (process.env.PRISMA_LOG_WARN === "true") {
  prismaLog.push("warn");
}
if (process.env.PRISMA_LOG_ERROR !== "false") {
  prismaLog.push("error");
}

// Configure Prisma Client with connection pool settings
export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: prismaLog,
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
    // Connection pool configuration
    transactionOptions: {
      maxWait: 10000, // max 10 seconds to wait for a connection
      timeout: 15000, // max 15 seconds for a transaction
    },
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default prisma; 
