const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
(async () => {
  try {
    console.log("companies:", await p.company.count());
    console.log("participants:", await p.participant.count());
    console.log("accounts:", await p.account.count());
    console.log("tx:", await p.transaction.count());
    console.log("runs:", await p.run.count());
  } catch (e) {
    console.log("ERR", e.message);
  } finally {
    await p.$disconnect();
  }
})();
