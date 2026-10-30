-- AlterTable
ALTER TABLE "Url" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "desktopUrl" TEXT,
ADD COLUMN     "normalizedUrl" TEXT,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "ClickEvent" (
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
CREATE TABLE "LinkLifetimeStats" (
    "linkId" TEXT NOT NULL,
    "totalClicks" INTEGER NOT NULL DEFAULT 0,
    "humanClicks" INTEGER NOT NULL DEFAULT 0,
    "botClicks" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LinkLifetimeStats_pkey" PRIMARY KEY ("linkId")
);

-- CreateTable
CREATE TABLE "LinkDailyStats" (
    "linkId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "totalClicks" INTEGER NOT NULL DEFAULT 0,
    "humanClicks" INTEGER NOT NULL DEFAULT 0,
    "botClicks" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "LinkDailyStats_pkey" PRIMARY KEY ("linkId","date")
);

-- CreateTable
CREATE TABLE "LinkDailyDimension" (
    "linkId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "dimensionType" TEXT NOT NULL,
    "dimensionValue" TEXT NOT NULL,
    "totalClicks" INTEGER NOT NULL DEFAULT 0,
    "humanClicks" INTEGER NOT NULL DEFAULT 0,
    "botClicks" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "LinkDailyDimension_pkey" PRIMARY KEY ("linkId","date","dimensionType","dimensionValue")
);

-- CreateTable
CREATE TABLE "CreationRequest" (
    "scope" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreationRequest_pkey" PRIMARY KEY ("scope","keyHash")
);

-- CreateTable
CREATE TABLE "WebhookDelivery" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "sourceEventId" TEXT NOT NULL,
    "linkId" TEXT NOT NULL,
    "milestone" INTEGER NOT NULL,
    "destination" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
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
CREATE TABLE "MigrationProgress" (
    "id" TEXT NOT NULL,
    "cursor" TEXT,
    "processed" INTEGER NOT NULL DEFAULT 0,
    "validatedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MigrationProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClickEvent_clickedAt_eventId_idx" ON "ClickEvent"("clickedAt", "eventId");

-- CreateIndex
CREATE INDEX "ClickEvent_linkId_clickedAt_idx" ON "ClickEvent"("linkId", "clickedAt");

-- CreateIndex
CREATE INDEX "CreationRequest_expiresAt_idx" ON "CreationRequest"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookDelivery_eventId_key" ON "WebhookDelivery"("eventId");

-- CreateIndex
CREATE INDEX "WebhookDelivery_status_nextAttemptAt_idx" ON "WebhookDelivery"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "WebhookDelivery_sourceEventId_idx" ON "WebhookDelivery"("sourceEventId");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookDelivery_linkId_milestone_key" ON "WebhookDelivery"("linkId", "milestone");

-- CreateIndex
CREATE INDEX "Url_userId_deletedAt_idx" ON "Url"("userId", "deletedAt");

-- AddForeignKey
ALTER TABLE "ClickEvent" ADD CONSTRAINT "ClickEvent_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "Url"("shortCode") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinkLifetimeStats" ADD CONSTRAINT "LinkLifetimeStats_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "Url"("shortCode") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinkDailyStats" ADD CONSTRAINT "LinkDailyStats_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "Url"("shortCode") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinkDailyDimension" ADD CONSTRAINT "LinkDailyDimension_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "Url"("shortCode") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookDelivery" ADD CONSTRAINT "WebhookDelivery_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "Url"("shortCode") ON DELETE RESTRICT ON UPDATE CASCADE;
