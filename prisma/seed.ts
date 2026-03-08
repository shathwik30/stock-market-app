import 'dotenv/config';
import { config } from 'dotenv';
config({ path: '.env.local' });

import bcrypt from 'bcryptjs';
import { PrismaClient } from '../lib/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL not set');

  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  const password = await bcrypt.hash('Qwerty@12345', 10);

  const user = await prisma.user.create({
    data: {
      username: 'shathwik',
      email: 'shathwik@example.com',
      password,
      firstName: 'Shathwik',
    },
  });

  console.log('User seeded:', { id: user.id, username: user.username, email: user.email });
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
