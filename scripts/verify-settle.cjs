const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
(async () => {
  try {
    const rows = await p.$queryRaw`SELECT a."ownerType", SUM(j.amount)::bigint AS s FROM "JournalEntry" j JOIN "Account" a ON a.id = j."accountId" WHERE j.asset = 'VB' GROUP BY a."ownerType"`;
    let total = 0n;
    for (const r of rows) { console.log(r.ownerType, r.s.toString()); total += BigInt(r.s); }
    console.log("TOTAL VB (must be 0):", total.toString());
    const ct = await p.companyTick.findMany({ where: { tick: 1 } });
    console.log("companyTick tick1 rows:", ct.length, "sample RV:", ct.slice(0, 3).map((x) => x.companyId + "=" + x.rv).join(","));
    const run = await p.run.findFirst({ orderBy: { date: "desc" } });
    console.log("clock:", run.clockState, "tick:", run.currentTick);
  } catch (e) { console.log("ERR", e.message); }
  finally { await p.$disconnect(); }
})();
