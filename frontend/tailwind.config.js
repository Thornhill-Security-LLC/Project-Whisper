/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f5f7ff",
          100: "#e6eaff",
          500: "#4f46e5",
          700: "#3730a3",
        },
      },
    },
  },
  plugins: [],
};
