const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Resolve zustand package root once, bypassing the exports map.
const zustandRoot = path.dirname(require.resolve('zustand/package.json'));

const originalResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Zustand's ESM builds use import.meta which Metro can't handle on web.
  // Force the CJS .js files by constructing the path from the package root directly.
  if (moduleName.startsWith('zustand/')) {
    const subpath = moduleName.slice('zustand/'.length);
    return {
      filePath: path.join(zustandRoot, `${subpath}.js`),
      type: 'sourceFile',
    };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
