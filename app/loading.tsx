import { Navbar, HamsterLoader } from "@/src/components/chrome";

export default function Loading() {
  return (
    <div>
      <Navbar />
      <div className="wrap" style={{ maxWidth: 560, textAlign: "center", paddingTop: 60 }}>
        <HamsterLoader label="Opening the city." />
      </div>
    </div>
  );
}
