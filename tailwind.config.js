/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // <--- ESTA LINHA É OBRIGATÓRIA PARA O BOTÃO FUNCIONAR
  theme: {
    extend: {},
  },
  plugins: [],
}