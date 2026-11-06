import 'dotenv/config'
import pg from 'pg'

const sql = `
-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "DeliveryStatus" AS ENUM ('pending', 'delivering', 'delivered', 'failed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "DimensionType" AS ENUM ('country', 'device', 'browser', 'operatingSystem', 'referrerDomain');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- DropIndex
DROP INDEX IF EXISTS "Url_shortCode_idx";
DROP INDEX IF EXISTS "Url_userId_idx";

-- AlterTable
ALTER TABLE "Click" ADD COLUMN IF NOT EXISTS "isBot" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Url" ADD COLUMN IF NOT EXISTS "androidUrl" TEXT,
ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "desktopUrl" TEXT,
ADD COLUMN IF NOT EXISTS "iosUrl" TEXT,
ADD COLUMN IF NOT EXISTS "normalizedUrl" TEXT,
ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS "webhookSecret" TEXT,
ADD COLUMN IF NOT EXISTS "webhookUrl" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "ClickEvent" (
    "eventId" TEXT NOT NULL,
    "linkId" TEXT NOT NULL,
    "clickedAt" TIMESTAMP(3) NOT NULL,
    "country" TEXT NOT NULL,
    "device" TEXT NOT NULL,
    "browser" TEXT NOT NULL,
    "operatingSystem" TEXT NOT NULL,
    "referrerDomain" TEXT NOT NULL,
    "isBot" BOOLEAN NOT NULL,
    "ipHash" TEXT,

    CONSTRAINT "ClickEvent_pkey" PRIMARY KEY ("eventId")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "LinkLifetimeStats" (
    "linkId" TEXT NOT NULL,
    "totalClicks" INTEGER NOT NULL DEFAULT 0,
    "humanClicks" INTEGER NOT NULL DEFAULT 0,
    "botClicks" INTEGER NOT NULL DEFAULT 0,
    "uniqueVisitors" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LinkLifetimeStats_pkey" PRIMARY KEY ("linkId")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "LinkDailyStats" (
    "linkId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "totalClicks" INTEGER NOT NULL DEFAULT 0,
    "humanClicks" INTEGER NOT NULL DEFAULT 0,
    "botClicks" INTEGER NOT NULL DEFAULT 0,
    "uniqueVisitors" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "LinkDailyStats_pkey" PRIMARY KEY ("linkId","date")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "LinkDailyDimension" (
    "linkId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "dimensionType" "DimensionType" NOT NULL,
    "dimensionValue" TEXT NOT NULL,
    "totalClicks" INTEGER NOT NULL DEFAULT 0,
    "humanClicks" INTEGER NOT NULL DEFAULT 0,
    "botClicks" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "LinkDailyDimension_pkey" PRIMARY KEY ("linkId","date","dimensionType","dimensionValue")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CreationRequest" (
    "scope" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreationRequest_pkey" PRIMARY KEY ("scope","keyHash")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "WebhookDelivery" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "sourceEventId" TEXT NOT NULL,
    "linkId" TEXT NOT NULL,
    "milestone" INTEGER NOT NULL,
    "destination" TEXT NOT NULL,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'pending',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "retryGeneration" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "nextAttemptAt" TIMESTAMP(3),
    "responseStatus" INTEGER,
    "errorSummary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),

    CONSTRAINT "WebhookDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "MigrationProgress" (
    "id" TEXT NOT NULL,
    "cursor" TEXT,
    "processed" INTEGER NOT NULL DEFAULT 0,
    "validatedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MigrationProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ClickEvent_clickedAt_eventId_idx" ON "ClickEvent"("clickedAt", "eventId");
CREATE INDEX IF NOT EXISTS "ClickEvent_linkId_clickedAt_idx" ON "ClickEvent"("linkId", "clickedAt");
CREATE INDEX IF NOT EXISTS "CreationRequest_expiresAt_idx" ON "CreationRequest"("expiresAt");
CREATE UNIQUE INDEX IF NOT EXISTS "WebhookDelivery_eventId_key" ON "WebhookDelivery"("eventId");
CREATE INDEX IF NOT EXISTS "WebhookDelivery_status_nextAttemptAt_idx" ON "WebhookDelivery"("status", "nextAttemptAt");
CREATE INDEX IF NOT EXISTS "WebhookDelivery_sourceEventId_idx" ON "WebhookDelivery"("sourceEventId");
CREATE UNIQUE INDEX IF NOT EXISTS "WebhookDelivery_linkId_milestone_key" ON "WebhookDelivery"("linkId", "milestone");
CREATE INDEX IF NOT EXISTS "Click_shortCode_isBot_idx" ON "Click"("shortCode", "isBot");
CREATE UNIQUE INDEX IF NOT EXISTS "Url_customAlias_key" ON "Url"("customAlias");
CREATE INDEX IF NOT EXISTS "Url_createdAt_idx" ON "Url"("createdAt");
CREATE INDEX IF NOT EXISTS "Url_expiresAt_idx" ON "Url"("expiresAt");
CREATE INDEX IF NOT EXISTS "Url_userId_createdAt_idx" ON "Url"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "Url_userId_deletedAt_idx" ON "Url"("userId", "deletedAt");
CREATE INDEX IF NOT EXISTS "Url_apiKeyId_idx" ON "Url"("apiKeyId");
CREATE INDEX IF NOT EXISTS "Url_isActive_idx" ON "Url"("isActive");

-- AddForeignKey
ALTER TABLE "Url" DROP CONSTRAINT IF EXISTS "Url_apiKeyId_fkey";
ALTER TABLE "Url" ADD CONSTRAINT "Url_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "ApiKey"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ClickEvent" DROP CONSTRAINT IF EXISTS "ClickEvent_linkId_fkey";
ALTER TABLE "ClickEvent" ADD CONSTRAINT "ClickEvent_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "Url"("shortCode") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LinkLifetimeStats" DROP CONSTRAINT IF EXISTS "LinkLifetimeStats_linkId_fkey";
ALTER TABLE "LinkLifetimeStats" ADD CONSTRAINT "LinkLifetimeStats_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "Url"("shortCode") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LinkDailyStats" DROP CONSTRAINT IF EXISTS "LinkDailyStats_linkId_fkey";
ALTER TABLE "LinkDailyStats" ADD CONSTRAINT "LinkDailyStats_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "Url"("shortCode") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LinkDailyDimension" DROP CONSTRAINT IF EXISTS "LinkDailyDimension_linkId_fkey";
ALTER TABLE "LinkDailyDimension" ADD CONSTRAINT "LinkDailyDimension_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "Url"("shortCode") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WebhookDelivery" DROP CONSTRAINT IF EXISTS "WebhookDelivery_linkId_fkey";
ALTER TABLE "WebhookDelivery" ADD CONSTRAINT "WebhookDelivery_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "Url"("shortCode") ON DELETE CASCADE ON UPDATE CASCADE;
`

async function applyMigration() {
  const dbUrl = new URL(process.env.DATABASE_URL)
  dbUrl.port = '5432'
  dbUrl.searchParams.delete('pgbouncer')

  const pool = new pg.Pool({ connectionString: dbUrl.toString() })
  const client = await pool.connect()
  try {
    console.log('Beginning schema synchronization...')
    await client.query('BEGIN')
    await client.query(sql)
    await client.query('COMMIT')
    console.log('Schema synchronization succeeded!')
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('Migration failed:', err)
  } finally {
    client.release()
    await pool.end()
  }
}

applyMigration()

