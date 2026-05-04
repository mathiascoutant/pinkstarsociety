/** CommonJS : évite la transpilation ESM (sucrase / charCodes) au chargement de la config. */
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
