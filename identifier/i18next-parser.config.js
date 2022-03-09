module.exports = {
  input: [
    'src/**/*.{js,jsx,ts,tsx}',
    // Use ! to filter out files or directories
    '!src/**/*.spec.{js,jsx,ts,tsx}',
    '!src/i18n/**',
    '!**/node_modules/**',
  ],
  resetDefaultValueLocale: true,
  output: './i18n/$LOCALE-$NAMESPACE.json',
  locales: ['dev'],
}
