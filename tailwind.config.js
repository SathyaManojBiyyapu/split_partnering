/** @type {import('tailwindcss').Config} */
const config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        body: ["var(--font-body)", "system-ui", "sans-serif"],
        heading: ["var(--font-heading)", "Georgia", "serif"],
      },
      colors: {
        gold: {
          primary: "#D4AF37",
          soft: "#E6C97A",
        },
        dark: {
          main: "#050505",
          section: "#0B0B0B",
          card: "#111111",
        },
      },
    },
  },
  plugins: [],
};

export default config;
