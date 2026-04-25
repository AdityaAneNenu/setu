const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Keep Expo defaults and explicitly ensure common font assets stay enabled.
config.resolver.assetExts = Array.from(
  new Set([...(config.resolver.assetExts || []), "ttf", "otf"]),
);

module.exports = config;

