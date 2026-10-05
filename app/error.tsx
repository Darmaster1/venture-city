"use client";
import { Navbar, Footer } from "@/src/components/chrome";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div>
      <Navbar />
      <div className="wrap" style={{ maxWidth: 560 }}>
        <div className="card" style={{ borderTop: "5px solid #E5484D", textAlign: "center", padding: 40 }}>
          <div className="label">Something broke</div>
          <h1 style={{ fontSize: 30 }}>The city hiccuped.</h1>
          <p style={{ color: "var(--fg-muted)" }}>{error.message || "An unexpected error hit this page. The journal is safe — this was a display error."}</p>
          <button className="btn btn-primary" onClick={reset} style={{ height: 44, padding: "0 28px" }}>Try again</button>
        </div>
      </div>
      <Footer />
    </div>
  );
}
