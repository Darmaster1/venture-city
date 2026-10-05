const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
(async () => {
  try {
    const lock = await p.settlementLock.findUnique({ where: { id: 1 } });
    console.log("lock:", JSON.stringify(lock));
    const run = await p.run.findFirst({ orderBy: { date: "desc" } });
    console.log("clock:", run.clockState, "tick:", run.currentTick);
    if (run.clockState === "FROZEN_FOR_SETTLEMENT") {
      await p.run.updateMany({ data: { clockState: "PRE" } });
      console.log("clock reset to PRE");
    }
    if (lock.lockedAt) {
      await p.$executeRawUnsafe(`UPDATE "SettlementLock" SET "lockedAt"=NULL,"lockedBy"=NULL WHERE id=1`);
      console.log("lock cleared");
    }
  } catch (e) { console.log("ERR", e.message); }
  finally { await p.$disconnect(); }
})();
