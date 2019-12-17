module.exports = {
  entry: 'src/index.js',
  proxy: {
  },
  plugins: [
    ['ice-plugin-fusion', {
      themePackage: '@icedesign/skin',
    }],
    ['ice-plugin-moment-locales', {
      locales: ['zh-cn'],
    }],
    'ice-plugin-css-assets-local',
  ],
};
