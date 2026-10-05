import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        "bg-elevated": "var(--bg-elevated)",
        "bg-sunken": "var(--bg-sunken)",
        border: "var(--border)",
        "border-strong": "var(--border-strong)",
        fg: "var(--fg)",
        "fg-muted": "var(--fg-muted)",
        "fg-subtle": "var(--fg-subtle)",
        accent: "var(--accent)",
        "accent-hover": "var(--accent-hover)",
        positive: "var(--positive)",
        negative: "var(--negative)",
        warning: "var(--warning)",
        critical: "var(--critical)",
        info: "var(--info)",
        neutral: "var(--neutral)"
      },
      fontSize: {
        "2xs": "11px",
        xs: "13px",
        sm: "14px",
        md: "15px",
        lg: "17px",
        xl: "22px",
        "2xl": "28px",
        "3xl": "36px"
      }
    }
  },
  plugins: []
};
export default config;
