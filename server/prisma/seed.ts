import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("password123", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: { homeCurrency: "USD" },
    create: {
      email: "admin@example.com",
      passwordHash,
      name: "Ada Admin",
      role: "ADMIN",
      department: "IT",
      homeCurrency: "USD",
    },
  });

  const manager = await prisma.user.upsert({
    where: { email: "manager@example.com" },
    update: { homeCurrency: "GBP" },
    create: {
      email: "manager@example.com",
      passwordHash,
      name: "Mia Manager",
      role: "MANAGER",
      department: "Engineering",
      homeCurrency: "GBP",
    },
  });

  await prisma.user.upsert({
    where: { email: "employee@example.com" },
    update: { homeCurrency: "INR" },
    create: {
      email: "employee@example.com",
      passwordHash,
      name: "Eli Employee",
      role: "EMPLOYEE",
      department: "Engineering",
      homeCurrency: "INR",
      managerId: manager.id,
    },
  });

  await prisma.user.upsert({
    where: { email: "finance@example.com" },
    update: { homeCurrency: "USD" },
    create: {
      email: "finance@example.com",
      passwordHash,
      name: "Fin Finance",
      role: "FINANCE",
      department: "Finance",
      homeCurrency: "USD",
    },
  });

  await prisma.user.upsert({
    where: { email: "hr@example.com" },
    update: { homeCurrency: "USD" },
    create: {
      email: "hr@example.com",
      passwordHash,
      name: "Hana HR",
      role: "HR",
      department: "People",
      homeCurrency: "USD",
    },
  });

  console.log(
    "Seeded users: admin@example.com, manager@example.com, employee@example.com, finance@example.com, hr@example.com"
  );
  console.log(`Password for all seeded users: password123`);
  console.log(`Admin id: ${admin.id}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
