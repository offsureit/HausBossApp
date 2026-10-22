// Metro config. Aliases:
//   `@/…` → ./shared/…   (pure modules shared with the HausBoss web app: types, adapters, status rules, time maths;
//                        copied from the web repo's src/ — keep them in sync when the web rules change)
//   `~/…` → ./src/…      (mobile code)
const { getSentryExpoConfig } = require('@sentry/react-native/metro');
const path = require('path');

const projectRoot = __dirname;
const shared = path.resolve(projectRoot, 'shared');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getSentryExpoConfig(projectRoot);

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith('@/')) return context.resolveRequest(context, path.join(shared, moduleName.slice(2)), platform);
  if (moduleName.startsWith('~/')) return context.resolveRequest(context, path.join(projectRoot, 'src', moduleName.slice(2)), platform);
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
