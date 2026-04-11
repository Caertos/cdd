module.exports = {
  env: {
    test: {
      // Jest necesita CJS (transpila módulos) + React
      presets: [
        ['@babel/preset-env', { targets: { node: 'current' } }],
        '@babel/preset-react'
      ]
    },
    // build (NODE_ENV != 'test') → mantiene ESM para el output final
    production: {
      presets: [
        ['@babel/preset-env', { modules: false }],
        '@babel/preset-react'
      ]
    }
  },
  // Fallback para cualquier otro entorno (desarrollo local, etc.)
  presets: [
    ['@babel/preset-env', { modules: false }],
    '@babel/preset-react'
  ]
};
