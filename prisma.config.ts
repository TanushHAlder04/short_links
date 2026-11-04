// Prisma 7 configuration — connection URLs moved here from schema.prisma.
// Prefer DIRECT_URL for migrations against Supabase (bypassing transaction poolers).

import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DIRECT_URL || process.env.DATABASE_URL!,
  },
});
