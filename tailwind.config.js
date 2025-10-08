/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        yasaBlue: "#000222", // your signature dark blue
      },
backdropBlur: {
  xs: '2px',
  sm: '4px',
  md: '8px',
  lg: '16px',
},
      backgroundImage: {
  "yasa-gradient": "linear-gradient(160deg, #000000 0%, #000222 60%, #001155 100%)",
},
    },
  },
  plugins: [],
};