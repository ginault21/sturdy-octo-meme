import prisma from '../../app/db.server';

export async function cleanDatabase(): Promise<void> {
  // Delete in reverse dependency order to avoid FK violations
  await prisma.$executeRawUnsafe('DELETE FROM "ChangeLog"');
  await prisma.$executeRawUnsafe('DELETE FROM "File"');
  await prisma.$executeRawUnsafe('DELETE FROM "Job"');
  await prisma.$executeRawUnsafe('DELETE FROM "JobTemplate"');
  await prisma.$executeRawUnsafe('DELETE FROM "Store"');
}

export { prisma };
