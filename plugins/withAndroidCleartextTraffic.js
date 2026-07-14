const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * Allow HTTP only for controlled LAN builds.
 *
 * Android 9+ blocks cleartext traffic by default. V1 device testing points at
 * a loopback backend exposed on the trusted LAN, so the generated manifest
 * must opt in explicitly. Set `enabled` to false before an HTTPS production
 * build.
 */
module.exports = function withAndroidCleartextTraffic(config, options = {}) {
  return withAndroidManifest(config, (nextConfig) => {
    const application = nextConfig.modResults.manifest.application?.[0];
    if (!application?.$) {
      throw new Error('AndroidManifest is missing its application element');
    }

    if (options.enabled === false) {
      delete application.$['android:usesCleartextTraffic'];
    } else {
      application.$['android:usesCleartextTraffic'] = 'true';
    }
    return nextConfig;
  });
};
