const { PrismaClient } = require("@prisma/client");
const crypto = require("crypto");
const p = new PrismaClient();
(async () => {
  try {
    const gmPass = crypto.randomBytes(12).toString("hex");
    const boot = crypto.randomBytes(16).toString("hex");
    const hash = crypto.createHash("sha256").update(gmPass).digest("hex");
    await p.volunteer.update({ where: { id: "gm-1" }, data: { loginSecretHash: hash } });
    console.log("gm-1 password rotated. NEW_GM_PASSWORD=" + gmPass);
    console.log("NEW_BOOTSTRAP_SECRET=" + boot);
  } catch (e) { console.log("ERR", e.message); }
  finally { await p.$disconnect(); }
})();
