-- CreateTable
CREATE TABLE "DealSheet" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "lane" TEXT NOT NULL DEFAULT 'TRADE',
    "type" TEXT NOT NULL DEFAULT 'SPOT',
    "sellerId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "product" TEXT NOT NULL,
    "units" INTEGER NOT NULL,
    "pricePerUnit" INTEGER NOT NULL,
    "floorPrice" INTEGER NOT NULL,
    "startTick" INTEGER NOT NULL DEFAULT 1,
    "endTick" INTEGER NOT NULL DEFAULT 1,
    "settlement" TEXT NOT NULL DEFAULT 'UPFRONT',
    "state" TEXT NOT NULL DEFAULT 'DRAFT',
    "note" TEXT,
    "createdBy" TEXT NOT NULL DEFAULT 'system',
    "sentAt" TIMESTAMP(3),
    "signedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DealSheet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealSignature" (
    "id" TEXT NOT NULL,
    "dealSheetId" TEXT NOT NULL,
    "signerId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'SIGNATORY',
    "state" TEXT NOT NULL DEFAULT 'PENDING',
    "signedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DealSignature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lane" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "desk" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Lane_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatureToggle" (
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FeatureToggle_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "DealSheet_code_key" ON "DealSheet"("code");
CREATE UNIQUE INDEX "DealSignature_dealSheetId_signerId_key" ON "DealSignature"("dealSheetId", "signerId");
CREATE INDEX "DealSignature_dealSheetId_state_idx" ON "DealSignature"("dealSheetId", "state");
CREATE UNIQUE INDEX "Lane_code_key" ON "Lane"("code");

-- Track live bank inventory separately from the T1 reference stock.
ALTER TABLE "Resource" ADD COLUMN "bankStock" INTEGER NOT NULL DEFAULT 0;
UPDATE "Resource" SET "bankStock" = "bankStockT1";
