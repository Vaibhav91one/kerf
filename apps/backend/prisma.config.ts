import { defineConfig, type PrismaConfig } from 'prisma/config';
import { PrismaPg } from '@prisma/adapter-pg';

// Prisma 7 removed `datasource.url` from schema.prisma — same pattern as
// cornice's apps/web/prisma.config.ts. `migrate.adapter` is used by the CLI
// at runtime despite the shipped .d.ts not yet declaring it (prisma@7.9.1).
type PrismaConfigWithMigrateAdapter = PrismaConfig & {
  migrate: { adapter: () => Promise<PrismaPg> };
};

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL,
  },
  migrate: {
    adapter: async () => new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  },
} satisfies PrismaConfigWithMigrateAdapter as PrismaConfig);
