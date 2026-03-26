import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#09090b",
        foreground: "#fafafa",
        card: "#121214",
        "card-border": "#27272a",
        primary: {
          DEFAULT: "#a855f7",
          hover: "#9333ea",
          foreground: "#ffffff",
        },
        secondary: {
          DEFAULT: "#06b6d4",
          hover: "#0891b2",
        },
        accent: {
          DEFAULT: "#f97316",
          hover: "#ea580c",
        },
        success: {
          DEFAULT: "#22c55e",
        },
        muted: {
          DEFAULT: "#a1a1aa",
          foreground: "#71717a",
        }
      },
      fontFamily: {
        sans: ["var(--font-inter)", "sans-serif"],
        mono: ["var(--font-fira-code)", "monospace"],
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic": "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
    },
  },
  plugins: [],
};
export default config;
