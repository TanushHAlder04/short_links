-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('pending', 'delivering', 'delivered', 'failed');

-- CreateEnum
CREATE TYPE "DimensionType" AS ENUM ('country', 'device', 'browser', 'operatingSystem', 'referrerDomain');

-- DropForeignKey
ALTER TABLE "ClickEvent" DROP CONSTRAINT IF EXISTS "ClickEvent_linkId_fkey";

-- DropForeignKey
ALTER TABLE "LinkLifetimeStats" DROP CONSTRAINT IF EXISTS "LinkLifetimeStats_linkId_fkey";

-- DropForeignKey
ALTER TABLE "LinkDailyStats" DROP CONSTRAINT IF EXISTS "LinkDailyStats_linkId_fkey";

-- DropForeignKey
ALTER TABLE "LinkDailyDimension" DROP CONSTRAINT IF EXISTS "LinkDailyDimension_linkId_fkey";

-- DropForeignKey
ALTER TABLE "WebhookDelivery" DROP CONSTRAINT IF EXISTS "WebhookDelivery_linkId_fkey";

-- DropIndex (redundant with composite (userId, createdAt) and (userId, deletedAt) indexes)
DROP INDEX IF EXISTS "Url_userId_idx";

-- AlterTable Url (Enforce customAlias uniqueness)
CREATE UNIQUE INDEX IF NOT EXISTS "Url_customAlias_key" ON "Url"("customAlias");

-- CreateIndex on Url.apiKeyId
CREATE INDEX IF NOT EXISTS "Url_apiKeyId_idx" ON "Url"("apiKeyId");

-- AddForeignKey Url.apiKeyId -> ApiKey.id
ALTER TABLE "Url" ADD CONSTRAINT "Url_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "ApiKey"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable LinkLifetimeStats (Unique visitors metric)
ALTER TABLE "LinkLifetimeStats" ADD COLUMN IF NOT EXISTS "uniqueVisitors" INTEGER NOT NULL DEFAULT 0;

-- AlterTable LinkDailyStats (Unique visitors metric)
ALTER TABLE "LinkDailyStats" ADD COLUMN IF NOT EXISTS "uniqueVisitors" INTEGER NOT NULL DEFAULT 0;

-- AlterTable LinkDailyDimension (Migrate dimensionType to native PostgreSQL Enum)
ALTER TABLE "LinkDailyDimension" ALTER COLUMN "dimensionType" TYPE "DimensionType" USING ("dimensionType"::"DimensionType");

-- AlterTable WebhookDelivery (Migrate status to native PostgreSQL Enum)
ALTER TABLE "WebhookDelivery" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "WebhookDelivery" ALTER COLUMN "status" TYPE "DeliveryStatus" USING ("status"::"DeliveryStatus");
ALTER TABLE "WebhookDelivery" ALTER COLUMN "status" SET DEFAULT 'pending'::"DeliveryStatus";

-- AddForeignKey with ON DELETE CASCADE for clean hard-deletion
ALTER TABLE "ClickEvent" ADD CONSTRAINT "ClickEvent_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "Url"("shortCode") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LinkLifetimeStats" ADD CONSTRAINT "LinkLifetimeStats_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "Url"("shortCode") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LinkDailyStats" ADD CONSTRAINT "LinkDailyStats_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "Url"("shortCode") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LinkDailyDimension" ADD CONSTRAINT "LinkDailyDimension_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "Url"("shortCode") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WebhookDelivery" ADD CONSTRAINT "WebhookDelivery_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "Url"("shortCode") ON DELETE CASCADE ON UPDATE CASCADE;

