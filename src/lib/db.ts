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

export const db = globalForPrisma.prisma || new PrismaClient({ log: prismaLog });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

export default db; 
