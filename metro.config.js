const { getDefaultConfig } = require('expo/metro-config');

// En la web, expo-sqlite usa SQLite compilado a WebAssembly y necesita SharedArrayBuffer,
// que el navegador solo da si la página llega con las cabeceras COOP y COEP.
const config = getDefaultConfig(__dirname);
if (!config.resolver.assetExts.includes('wasm')) config.resolver.assetExts.push('wasm');

const enhance = config.server.enhanceMiddleware;
config.server.enhanceMiddleware = (middleware, server) => {
  const m = enhance ? enhance(middleware, server) : middleware;
  return (req, res, next) => {
    // require-corp y no credentialless: Safari (iPhone, iPad) no entiende credentialless.
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    return m(req, res, next);
  };
};

module.exports = config;
