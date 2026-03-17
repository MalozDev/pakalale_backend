import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const connectionString = `${process.env.DATABASE_URL}`;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

// We use a singleton pattern for the Prisma Client.
// This prevents multiple instances of Prisma Client in development
// which can exhaust the database connection limit.
const prisma = new PrismaClient({
  adapter,
  // Log queries in development mode for debugging
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

export default prisma;
