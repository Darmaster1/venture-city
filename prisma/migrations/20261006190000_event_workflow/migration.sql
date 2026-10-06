ALTER TABLE "EventCrisisCard"
  ADD COLUMN "phase" TEXT NOT NULL DEFAULT 'MARKET',
  ADD COLUMN "signalTick" INTEGER,
  ADD COLUMN "responseWindow" INTEGER,
  ADD COLUMN "targetRule" TEXT,
  ADD COLUMN "visibility" TEXT NOT NULL DEFAULT 'PUBLIC';

ALTER TABLE "DeckEntry"
  ADD COLUMN "firedAt" TIMESTAMP(3),
  ADD COLUMN "createdBy" TEXT NOT NULL DEFAULT 'system';

ALTER TABLE "Signal"
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE INDEX "Signal_tick_cardCode_idx" ON "Signal"("tick", "cardCode");

ALTER TABLE "CrisisHit"
  ADD COLUMN "state" TEXT NOT NULL DEFAULT 'OPEN',
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE UNIQUE INDEX "CrisisHit_tick_cardCode_companyId_key" ON "CrisisHit"("tick", "cardCode", "companyId");