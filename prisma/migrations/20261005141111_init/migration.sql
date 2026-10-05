-- CreateTable
CREATE TABLE "Run" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "rulesVersion" TEXT NOT NULL DEFAULT '1.0.0',
    "contentVersion" TEXT NOT NULL DEFAULT '1.0.0',
    "appVersion" TEXT NOT NULL DEFAULT '1.0.0',
    "activeSet" TEXT NOT NULL DEFAULT 'CITY10',
    "N" INTEGER NOT NULL DEFAULT 10,
    "P" INTEGER NOT NULL DEFAULT 80,
    "leadThesis" TEXT,
    "rumourE20True" BOOLEAN NOT NULL DEFAULT false,
    "infoMode" TEXT NOT NULL DEFAULT 'CLOSED',
    "currentTick" INTEGER NOT NULL DEFAULT 0,
    "clockState" TEXT NOT NULL DEFAULT 'PRE',
    "capTableLocked" BOOLEAN NOT NULL DEFAULT false,
    "lunchStartedAt" TIMESTAMP(3),
    "lunchEndsAt" TIMESTAMP(3),
    "freezeAt" TIMESTAMP(3),
    "marketOpenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL DEFAULT 'seed',

    CONSTRAINT "Run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Param" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "formulaOfN" TEXT,
    "sourceRef" TEXT,

    CONSTRAINT "Param_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "Tick" (
    "tickNo" INTEGER NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settledAt" TIMESTAMP(3),
    "settledBy" TEXT,
    "snapshotRef" TEXT,
    "notes" TEXT,

    CONSTRAINT "Tick_pkey" PRIMARY KEY ("tickNo")
);

-- CreateTable
CREATE TABLE "Resource" (
    "code" TEXT NOT NULL,
    "bankBasePrice" INTEGER NOT NULL,
    "bankStockT1" INTEGER NOT NULL,
    "restockPerTick" INTEGER NOT NULL,

    CONSTRAINT "Resource_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "Slot" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "institutionFallback" TEXT NOT NULL,

    CONSTRAINT "Slot_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "SectorTag" (
    "code" TEXT NOT NULL,

    CONSTRAINT "SectorTag_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "SettlementLock" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "lockedAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "tickNo" INTEGER,

    CONSTRAINT "SettlementLock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "archetype" TEXT NOT NULL DEFAULT 'startup',
    "cluster" JSONB NOT NULL DEFAULT '[]',
    "workforceMix" TEXT NOT NULL DEFAULT 'TECH_LED',
    "origin" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "reserveOrder" INTEGER,
    "lifecycle" TEXT NOT NULL DEFAULT 'OPERATING',
    "distressedSinceTick" INTEGER,
    "strategicAdjustment" INTEGER NOT NULL DEFAULT 0,
    "ceoPersona" TEXT NOT NULL DEFAULT 'Operator',
    "deficitDomain" TEXT NOT NULL DEFAULT 'Operations',
    "criticalSlot" TEXT,
    "fillsSlots" JSONB NOT NULL DEFAULT '[]',
    "needsSlots" JSONB NOT NULL DEFAULT '[]',
    "gateRef" TEXT,
    "baselineRv" INTEGER,
    "foundedTick" INTEGER,
    "parentCompanyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL DEFAULT 'seed',

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyTier" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "effectiveFromTick" INTEGER NOT NULL DEFAULT 0,
    "tier" TEXT NOT NULL,
    "reason" TEXT,

    CONSTRAINT "CompanyTier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequiredSeat" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "required" INTEGER NOT NULL,
    "fixedAtTick" INTEGER NOT NULL DEFAULT 0,
    "reason" TEXT,

    CONSTRAINT "RequiredSeat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductCard" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "deliveryUnit" TEXT NOT NULL DEFAULT 'unit',
    "resourceCost" JSONB NOT NULL DEFAULT '{}',
    "unitsPerTick" INTEGER NOT NULL DEFAULT 1,
    "listPrice" INTEGER NOT NULL DEFAULT 500,
    "floorPrice" INTEGER NOT NULL DEFAULT 400,
    "eligibleBuyers" JSONB NOT NULL DEFAULT '[]',
    "licenceRequired" TEXT,
    "isSupplyProduct" BOOLEAN NOT NULL DEFAULT false,
    "recipe" JSONB,
    "capacity" INTEGER,
    "upgrades" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotableAsset" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "bookValue" INTEGER NOT NULL,
    "pledgedToLoanId" TEXT,

    CONSTRAINT "NotableAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Participant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "badgeNo" TEXT NOT NULL,
    "arrivalTime" TIMESTAMP(3),
    "companyId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'EMPLOYEE',
    "domain" TEXT NOT NULL DEFAULT 'Operations',
    "level" INTEGER NOT NULL DEFAULT 0,
    "salary" INTEGER NOT NULL DEFAULT 100,
    "isSignatory" BOOLEAN NOT NULL DEFAULT false,
    "capabilityTags" JSONB NOT NULL DEFAULT '[]',
    "moveCooldownUntilTick" INTEGER,
    "retentionLockUntilTick" INTEGER,
    "qrToken" TEXT NOT NULL,
    "needsFlag" BOOLEAN NOT NULL DEFAULT false,
    "walletAccountId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL DEFAULT 'seed',

    CONSTRAINT "Participant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Volunteer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "deskOrCompany" TEXT,
    "loginSecretHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL DEFAULT 'seed',

    CONSTRAINT "Volunteer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employment" (
    "id" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'staff',
    "domain" TEXT NOT NULL DEFAULT 'Operations',
    "level" INTEGER NOT NULL DEFAULT 0,
    "salary" INTEGER NOT NULL DEFAULT 100,
    "equityGrantShares" INTEGER NOT NULL DEFAULT 0,
    "retentionBonus" INTEGER NOT NULL DEFAULT 0,
    "state" TEXT NOT NULL DEFAULT 'ACTIVE',
    "offerExpiresTick" INTEGER,
    "startTick" INTEGER NOT NULL DEFAULT 0,
    "endTick" INTEGER,
    "counterofferOf" TEXT,

    CONSTRAINT "Employment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TalentIndex" (
    "id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "tick" INTEGER NOT NULL,
    "index" INTEGER NOT NULL DEFAULT 100,

    CONSTRAINT "TalentIndex_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "ownerType" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL DEFAULT 'seed',

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalEntry" (
    "id" TEXT NOT NULL,
    "txId" TEXT NOT NULL,
    "tick" INTEGER NOT NULL DEFAULT 0,
    "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accountId" TEXT NOT NULL,
    "asset" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "refType" TEXT,
    "refId" TEXT,
    "paperFormNo" TEXT,
    "enteredBy" TEXT NOT NULL DEFAULT 'system',
    "stepNo" INTEGER,
    "reversesEntryId" TEXT,

    CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SETTLED',
    "proposedTick" INTEGER,
    "acceptedAt" TIMESTAMP(3),
    "negotiatorIds" JSONB,
    "signerIds" JSONB,
    "desk" TEXT,
    "paperFormNo" TEXT,
    "flags" JSONB,
    "idempotencyKey" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL DEFAULT 'system',

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'RECURRING',
    "sellerId" TEXT,
    "buyerId" TEXT,
    "customerCardId" TEXT,
    "unitsPerTick" INTEGER,
    "pricePerUnit" INTEGER,
    "startTick" INTEGER NOT NULL DEFAULT 1,
    "endTick" INTEGER NOT NULL DEFAULT 6,
    "settlement" TEXT NOT NULL DEFAULT 'PER_TICK',
    "penaltyPct" INTEGER NOT NULL DEFAULT 10,
    "latePaymentPct" INTEGER NOT NULL DEFAULT 10,
    "exclusivityUntil" INTEGER,
    "forceMajeureCodes" JSONB,
    "state" TEXT NOT NULL DEFAULT 'PROPOSED',
    "consecutiveBreaches" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL DEFAULT 'seed',

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractLine" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "tick" INTEGER NOT NULL,
    "unitsDue" INTEGER NOT NULL,
    "unitsDelivered" INTEGER NOT NULL DEFAULT 0,
    "paymentDue" INTEGER NOT NULL,
    "paymentMade" INTEGER NOT NULL DEFAULT 0,
    "outcome" TEXT,

    CONSTRAINT "ContractLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Loan" (
    "id" TEXT NOT NULL,
    "product" TEXT NOT NULL,
    "lenderAccount" TEXT NOT NULL DEFAULT 'BANK',
    "borrowerCompany" TEXT NOT NULL,
    "principal" INTEGER NOT NULL,
    "flatRate" INTEGER NOT NULL DEFAULT 10,
    "termTicks" INTEGER NOT NULL DEFAULT 4,
    "schedule" TEXT NOT NULL DEFAULT 'EQUAL',
    "firstDueTick" INTEGER NOT NULL,
    "securityRef" TEXT,
    "state" TEXT NOT NULL DEFAULT 'DISBURSED',
    "missedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL DEFAULT 'seed',

    CONSTRAINT "Loan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReliabilityEvent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "tick" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "ref" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL DEFAULT 'system',

    CONSTRAINT "ReliabilityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShareHolding" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "holderType" TEXT NOT NULL,
    "holderId" TEXT NOT NULL,
    "shares" INTEGER NOT NULL,
    "class" TEXT NOT NULL DEFAULT 'COMMON',
    "rights" JSONB,

    CONSTRAINT "ShareHolding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TermSheet" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "product" TEXT NOT NULL,
    "sponsorPartner" TEXT NOT NULL DEFAULT 'Partner',
    "amount" INTEGER NOT NULL,
    "rvAtSigning" INTEGER NOT NULL,
    "preMoney" INTEGER NOT NULL,
    "multiple" DOUBLE PRECISION NOT NULL,
    "pricePerShare" DOUBLE PRECISION NOT NULL,
    "newShares" INTEGER NOT NULL,
    "tranche2Amount" INTEGER,
    "tranche2Milestone" TEXT,
    "tranche2DeadlineTick" INTEGER,
    "state" TEXT NOT NULL DEFAULT 'PROPOSED',
    "expiresTick" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL DEFAULT 'seed',

    CONSTRAINT "TermSheet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionOrder" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "standingQty" INTEGER NOT NULL DEFAULT 1,
    "effectiveFromTick" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "ProductionOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyTick" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "tick" INTEGER NOT NULL,
    "cash" INTEGER NOT NULL DEFAULT 0,
    "debt" INTEGER NOT NULL DEFAULT 0,
    "receivables" INTEGER NOT NULL DEFAULT 0,
    "resourcesValue" INTEGER NOT NULL DEFAULT 0,
    "nav" INTEGER NOT NULL DEFAULT 0,
    "verifiedRevenue" INTEGER NOT NULL DEFAULT 0,
    "rv" INTEGER NOT NULL DEFAULT 0,
    "wc" INTEGER NOT NULL DEFAULT 0,
    "creditGrade" TEXT NOT NULL DEFAULT 'B',
    "runway" INTEGER NOT NULL DEFAULT 99,
    "ticksAtZero" JSONB,
    "distressedTriggers" JSONB,
    "arrears" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CompanyTick_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerCard" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "segment" TEXT NOT NULL DEFAULT 'Enterprise',
    "sector" TEXT NOT NULL DEFAULT 'Tech and Data',
    "ratePerTick" INTEGER NOT NULL DEFAULT 1000,
    "ticks" INTEGER NOT NULL DEFAULT 4,
    "decideBy" INTEGER,
    "assignee" TEXT,
    "mustLicence" TEXT,
    "heldBack" BOOLEAN NOT NULL DEFAULT false,
    "payload" JSONB,

    CONSTRAINT "CustomerCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerCardInstance" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "companyId" TEXT,
    "state" TEXT NOT NULL DEFAULT 'OPEN',
    "awardedTick" INTEGER,

    CONSTRAINT "CustomerCardInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierLine" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL DEFAULT 20,
    "bandLow" DOUBLE PRECISION,
    "bandHigh" DOUBLE PRECISION,
    "minOrder" INTEGER NOT NULL DEFAULT 20,
    "terms" TEXT NOT NULL DEFAULT 'upfront',
    "kind" TEXT NOT NULL DEFAULT 'STANDARD',
    "capacityPT" INTEGER NOT NULL DEFAULT 120,
    "payload" JSONB,

    CONSTRAINT "SupplierLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankProduct" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "terms" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "BankProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvestorProduct" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "terms" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "InvestorProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Licence" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fee" INTEGER NOT NULL,
    "ticks" INTEGER NOT NULL DEFAULT 1,
    "requires" JSONB,

    CONSTRAINT "Licence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Grant" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "maxAmt" INTEGER NOT NULL,
    "terms" JSONB,

    CONSTRAINT "Grant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tender" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "requires" TEXT,
    "sector" TEXT NOT NULL DEFAULT 'Tech and Data',
    "releaseTick" INTEGER NOT NULL DEFAULT 3,
    "state" TEXT NOT NULL DEFAULT 'QUEUED',

    CONSTRAINT "Tender_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegInstrument" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "payload" JSONB,

    CONSTRAINT "RegInstrument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaProduct" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "terms" JSONB,

    CONSTRAINT "MediaProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaOutlet" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slots" INTEGER NOT NULL DEFAULT 1,
    "booked" INTEGER NOT NULL DEFAULT 0,
    "payload" JSONB,

    CONSTRAINT "MediaOutlet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LicenceHolding" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "licenceId" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "LicenceHolding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MissionCard" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "tier" INTEGER NOT NULL DEFAULT 1,
    "reward" INTEGER NOT NULL DEFAULT 500,
    "window" INTEGER NOT NULL DEFAULT 2,
    "deadline" INTEGER NOT NULL DEFAULT 1,
    "flags" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "MissionCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MissionInstance" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "companyId" TEXT,
    "holderId" TEXT,
    "state" TEXT NOT NULL DEFAULT 'OPEN',
    "tick" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MissionInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpportunityCard" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 1000,
    "method" TEXT NOT NULL DEFAULT 'FIRST_COMMIT',
    "payload" JSONB,
    "state" TEXT NOT NULL DEFAULT 'QUEUED',

    CONSTRAINT "OpportunityCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpportunityInstance" (
    "id" TEXT NOT NULL,
    "oppId" TEXT NOT NULL,
    "companyId" TEXT,
    "state" TEXT NOT NULL DEFAULT 'LIVE',
    "tick" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "OpportunityInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventCrisisCard" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "tick" INTEGER NOT NULL DEFAULT 1,
    "payload" JSONB,
    "state" TEXT NOT NULL DEFAULT 'QUEUED',

    CONSTRAINT "EventCrisisCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeckEntry" (
    "id" TEXT NOT NULL,
    "tick" INTEGER NOT NULL,
    "cardId" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'QUEUED',
    "targetId" TEXT,
    "vetoLog" TEXT,

    CONSTRAINT "DeckEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Signal" (
    "id" TEXT NOT NULL,
    "tick" INTEGER NOT NULL,
    "cardCode" TEXT NOT NULL,
    "holderId" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'whisper',

    CONSTRAINT "Signal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrisisHit" (
    "id" TEXT NOT NULL,
    "tick" INTEGER NOT NULL,
    "cardCode" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CrisisHit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuctionLot" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "openingPrice" INTEGER NOT NULL,
    "floorPrice" INTEGER NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'OPEN',
    "winnerId" TEXT,
    "price" INTEGER,

    CONSTRAINT "AuctionLot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bid" (
    "id" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "bidderId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "tick" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Bid_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InfoCard" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "grade" TEXT NOT NULL DEFAULT 'C',
    "copy" TEXT NOT NULL DEFAULT '',
    "provenance" TEXT NOT NULL DEFAULT '',
    "truthStatus" TEXT NOT NULL DEFAULT 'UNVERIFIED',
    "hiddenNeed" TEXT,
    "bestFit" TEXT,

    CONSTRAINT "InfoCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InfoHolding" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "holderId" TEXT NOT NULL,
    "holderCompany" TEXT,
    "state" TEXT NOT NULL DEFAULT 'HELD',

    CONSTRAINT "InfoHolding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InfoTrade" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "price" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "InfoTrade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InfoVerification" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "verifier" TEXT NOT NULL,
    "result" TEXT NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "InfoVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Broker" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Broker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhisperLog" (
    "id" TEXT NOT NULL,
    "tick" INTEGER NOT NULL,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "topic" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "WhisperLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ObjectiveTemplate" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "text" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "ObjectiveTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ObjectiveAssignment" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "holderId" TEXT NOT NULL,
    "holderCompany" TEXT,
    "state" TEXT NOT NULL DEFAULT 'ACTIVE',
    "note" TEXT,

    CONSTRAINT "ObjectiveAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FounderEntry" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "tick" INTEGER NOT NULL,
    "band" TEXT NOT NULL DEFAULT 'C',
    "score" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,

    CONSTRAINT "FounderEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ruling" (
    "id" TEXT NOT NULL,
    "tick" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "by" TEXT NOT NULL DEFAULT 'GM',

    CONSTRAINT "Ruling_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Incident" (
    "id" TEXT NOT NULL,
    "tick" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'LOW',

    CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "tick" INTEGER NOT NULL DEFAULT 0,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "refType" TEXT,
    "refId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Snapshot" (
    "id" TEXT NOT NULL,
    "tick" INTEGER NOT NULL,
    "phase" TEXT NOT NULL,
    "fileRef" TEXT,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL DEFAULT 'system',

    CONSTRAINT "Snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DecisionCard" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "thesisFit" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "checks" JSONB,
    "multiple" DOUBLE PRECISION NOT NULL DEFAULT 0.5,

    CONSTRAINT "DecisionCard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CompanyTier_companyId_resource_effectiveFromTick_key" ON "CompanyTier"("companyId", "resource", "effectiveFromTick");

-- CreateIndex
CREATE UNIQUE INDEX "RequiredSeat_companyId_domain_key" ON "RequiredSeat"("companyId", "domain");

-- CreateIndex
CREATE UNIQUE INDEX "Participant_badgeNo_key" ON "Participant"("badgeNo");

-- CreateIndex
CREATE UNIQUE INDEX "Participant_qrToken_key" ON "Participant"("qrToken");

-- CreateIndex
CREATE UNIQUE INDEX "TalentIndex_domain_tick_key" ON "TalentIndex"("domain", "tick");

-- CreateIndex
CREATE UNIQUE INDEX "Account_ownerType_ownerId_label_key" ON "Account"("ownerType", "ownerId", "label");

-- CreateIndex
CREATE INDEX "JournalEntry_accountId_asset_idx" ON "JournalEntry"("accountId", "asset");

-- CreateIndex
CREATE INDEX "JournalEntry_tick_idx" ON "JournalEntry"("tick");

-- CreateIndex
CREATE INDEX "JournalEntry_txId_idx" ON "JournalEntry"("txId");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_idempotencyKey_key" ON "Transaction"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "ContractLine_contractId_tick_key" ON "ContractLine"("contractId", "tick");

-- CreateIndex
CREATE UNIQUE INDEX "ShareHolding_companyId_holderType_holderId_class_key" ON "ShareHolding"("companyId", "holderType", "holderId", "class");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyTick_companyId_tick_key" ON "CompanyTick"("companyId", "tick");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerCard_code_key" ON "CustomerCard"("code");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierLine_code_key" ON "SupplierLine"("code");

-- CreateIndex
CREATE UNIQUE INDEX "BankProduct_code_key" ON "BankProduct"("code");

-- CreateIndex
CREATE UNIQUE INDEX "InvestorProduct_code_key" ON "InvestorProduct"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Licence_code_key" ON "Licence"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Grant_code_key" ON "Grant"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Tender_code_key" ON "Tender"("code");

-- CreateIndex
CREATE UNIQUE INDEX "RegInstrument_code_key" ON "RegInstrument"("code");

-- CreateIndex
CREATE UNIQUE INDEX "MediaProduct_code_key" ON "MediaProduct"("code");

-- CreateIndex
CREATE UNIQUE INDEX "MediaOutlet_code_key" ON "MediaOutlet"("code");

-- CreateIndex
CREATE UNIQUE INDEX "MissionCard_code_key" ON "MissionCard"("code");

-- CreateIndex
CREATE UNIQUE INDEX "OpportunityCard_code_key" ON "OpportunityCard"("code");

-- CreateIndex
CREATE UNIQUE INDEX "EventCrisisCard_code_key" ON "EventCrisisCard"("code");

-- CreateIndex
CREATE UNIQUE INDEX "AuctionLot_code_key" ON "AuctionLot"("code");

-- CreateIndex
CREATE UNIQUE INDEX "InfoCard_code_key" ON "InfoCard"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ObjectiveTemplate_code_key" ON "ObjectiveTemplate"("code");
