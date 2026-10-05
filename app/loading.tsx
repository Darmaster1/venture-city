import { Navbar } from "@/src/components/chrome";

export default function Loading() {
  return (
    <div>
      <Navbar />
      <div className="wrap" style={{ maxWidth: 560, textAlign: "center", paddingTop: 80 }}>
        <div className="spinner" />
        <p style={{ color: "var(--fg-muted)" }}>Opening the city.</p>
      </div>
    </div>
  );
}
