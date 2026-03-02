/**
 * EL-032 — Expo config plugin for notification-reader
 * Adds the NotificationListenerService to AndroidManifest.xml
 */
const { withAndroidManifest } = require('@expo/config-plugins');

function withNotificationReader(config) {
  return withAndroidManifest(config, (config) => {
    const mainApplication = config.modResults.manifest.application?.[0];
    if (!mainApplication) return config;

    // Check if service already exists
    const services = mainApplication.service || [];
    const exists = services.some(
      (s) =>
        s.$?.['android:name'] === 'expo.modules.notificationreader.DivaNotificationListenerService'
    );

    if (!exists) {
      mainApplication.service = [
        ...services,
        {
          $: {
            'android:name': 'expo.modules.notificationreader.DivaNotificationListenerService',
            'android:label': 'Diva Notification Reader',
            'android:permission': 'android.permission.BIND_NOTIFICATION_LISTENER_SERVICE',
            'android:exported': 'true',
          },
          'intent-filter': [
            {
              action: [
                {
                  $: {
                    'android:name': 'android.service.notification.NotificationListenerService',
                  },
                },
              ],
            },
          ],
        },
      ];
    }

    return config;
  });
}

module.exports = withNotificationReader;
