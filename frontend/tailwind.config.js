/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#EEF5F0",
          100: "#D7E7DC",
          200: "#AFCFB9",
          500: "#2E7A52",
          600: "#235E3F",
          700: "#194B32",
          800: "#143B28",
          900: "#0D2A1C",
        },
        surface: "#F8F6F1",
        card: "#FFFFFF",
      },
      boxShadow: {
        soft: "0 1px 2px rgba(17,24,39,0.04), 0 2px 8px rgba(17,24,39,0.06)",
        popup: "0 10px 30px rgba(17,24,39,0.12)",
      },
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      container: {
        center: true,
        padding: { DEFAULT: "1rem", lg: "2rem" },
      },
    },
  },
  plugins: [],
};
