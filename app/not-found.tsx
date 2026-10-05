import { Navbar, Footer } from "@/src/components/chrome";

export default function NotFound() {
  return (
    <div>
      <Navbar />
      <div className="wrap" style={{ maxWidth: 560 }}>
        <div className="card" style={{ borderTop: "5px solid #E8930C", textAlign: "center", padding: 40 }}>
          <div className="label">404</div>
          <h1 style={{ fontSize: 30 }}>This street doesn't exist.</h1>
          <p style={{ color: "var(--fg-muted)" }}>The page moved or was never built. Head back to somewhere real.</p>
          <a className="btn btn-primary" href="/" style={{ height: 44, padding: "0 28px" }}>Back to the city</a>
        </div>
      </div>
      <Footer />
    </div>
  );
}
