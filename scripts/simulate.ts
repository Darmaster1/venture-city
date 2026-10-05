import { settleTick } from "@/src/settlement";
const tick = Number(process.argv[2] ?? 1);
console.log(`Simulating settle for tick ${tick} (needs DATABASE_URL/POSTGRES_PRISMA_URL).`);
settleTick(tick, "sim").then((r) => { console.log(r.log.join("\n")); console.log(`done in ${r.ms}ms`); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
