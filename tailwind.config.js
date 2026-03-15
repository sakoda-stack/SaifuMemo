/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        accent: "#3B7DD8",
        medical: "#E05C5C",
        "medical-light": "#FDEAEA",
        success: "#3DB87C",
        "app-bg": "#F7F6F2",
      },
      fontFamily: {
        sans: ["-apple-system", "BlinkMacSystemFont", "Hiragino Sans", "sans-serif"],
      },
    },
  },
  plugins: [],
};
