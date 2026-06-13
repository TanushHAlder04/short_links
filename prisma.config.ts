// prisma.config.ts
// Prisma 7 configuration — connection URLs moved here from schema.prisma.
// See: https://pris.ly/d/config-datasource

// prisma.config.ts


import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DIRECT_URL!,
  },
});