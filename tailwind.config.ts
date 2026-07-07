import type { Config } from "tailwindcss";

// Brand tokens mirror docs/reference-microsite/styles.css (RIPCO ISG navy/gold).
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          900: "#070f1d",
          850: "#0a1424",
          800: "#0c1a2e",
          700: "#15293f",
          600: "#1d3550",
        },
        gold: { DEFAULT: "#c9a24b", bright: "#e0bd66" },
        // Monday status label hexes (for pills)
        status: {
          green: "#00c875",
          orange: "#fdab3d",
          red: "#df2f4a",
          blue: "#579bfc",
          purple: "#a25ddc",
          navy: "#225091",
        },
      },
      fontFamily: {
        serif: ["Fraunces", "Georgia", "serif"],
        sans: ["Hanken Grotesk", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
