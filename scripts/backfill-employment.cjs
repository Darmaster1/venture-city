const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
(async () => {
  try {
    const parts = await p.participant.findMany({ where: { companyId: { not: null } } });
    let made = 0;
    for (const pt of parts) {
      const ex = await p.employment.findFirst({ where: { participantId: pt.id, state: "ACTIVE" } });
      if (!ex) {
        await p.employment.create({
          data: { participantId: pt.id, companyId: pt.companyId, role: "staff", domain: pt.domain, level: pt.level ?? 0, salary: pt.salary ?? 100, state: "ACTIVE", startTick: 0 }
        });
        made++;
      }
    }
    console.log(`participants=${parts.length} employments created=${made}`);
  } catch (e) { console.log("ERR", e.message); }
  finally { await p.$disconnect(); }
})();
