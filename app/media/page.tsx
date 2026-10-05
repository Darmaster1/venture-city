import { prisma } from "@/src/db";
import { Navbar, Footer, Stat } from "@/src/components/chrome";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";
export default async function Page() {
  const prods = await prisma.mediaProduct.findMany();
  return (<div><Navbar /><div className="wrap">
    <h1 className="page-title">Media desk</h1>
    <p className="page-sub">Stories, campaigns and audience access. Brand discount 25% on features.</p>
    <div className="stat-grid">
      <Stat label="Products" value={String(prods.length)} color="#E84FB8" />
      <Stat label="Viral threshold" value="5" sub="buyers · +20 sector index" color="#FF9F2E" />
    </div>
    <div className="card" style={{ borderTop: "5px solid #E84FB8" }}>
      <table className="vc"><thead><tr><th>Code</th><th>Product</th><th className="num">Price</th></tr></thead>
        <tbody>{prods.map((p) => <tr key={p.id}><td className="mono">{p.code}</td><td>{p.name}</td><td className="num">{p.price === 0 ? "Free" : `${p.price.toLocaleString("en-IN")} VB`}</td></tr>)}</tbody>
      </table>
    </div>
  </div><Footer /></div>);
}
