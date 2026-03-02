package expo.modules.notificationreader;

import android.app.Notification;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import android.util.Log;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import org.json.JSONObject;

import java.util.HashMap;
import java.util.Map;

/**
 * EL-032 — Android NotificationListenerService
 * Captures incoming notifications from messaging apps, email, etc.
 * Requires user to grant "Notification Access" in Android Settings.
 */
public class DivaNotificationListenerService extends NotificationListenerService {
    private static final String TAG = "DivaNotifListener";

    // Known messaging/email packages we care about
    private static final Map<String, String[]> KNOWN_APPS = new HashMap<>();
    static {
        KNOWN_APPS.put("com.whatsapp", new String[]{"WhatsApp", "message"});
        KNOWN_APPS.put("com.whatsapp.w4b", new String[]{"WhatsApp Business", "message"});
        KNOWN_APPS.put("org.telegram.messenger", new String[]{"Telegram", "message"});
        KNOWN_APPS.put("com.facebook.orca", new String[]{"Messenger", "message"});
        KNOWN_APPS.put("com.google.android.apps.messaging", new String[]{"Messages", "message"});
        KNOWN_APPS.put("com.samsung.android.messaging", new String[]{"Samsung Messages", "message"});
        KNOWN_APPS.put("com.google.android.gm", new String[]{"Gmail", "email"});
        KNOWN_APPS.put("com.microsoft.office.outlook", new String[]{"Outlook", "email"});
        KNOWN_APPS.put("com.yahoo.mobile.client.android.mail", new String[]{"Yahoo Mail", "email"});
        KNOWN_APPS.put("com.instagram.android", new String[]{"Instagram", "social"});
        KNOWN_APPS.put("com.discord", new String[]{"Discord", "message"});
        KNOWN_APPS.put("com.Slack", new String[]{"Slack", "message"});
        KNOWN_APPS.put("com.snapchat.android", new String[]{"Snapchat", "social"});
    }

    // Static reference for the React Native module to access
    private static DivaNotificationListenerService instance;

    public static DivaNotificationListenerService getInstance() {
        return instance;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
        Log.i(TAG, "NotificationListenerService created");
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        instance = null;
        Log.i(TAG, "NotificationListenerService destroyed");
    }

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        if (sbn == null) return;

        String packageName = sbn.getPackageName();

        // Only capture from known apps (ignore system, our own app, etc.)
        if (!KNOWN_APPS.containsKey(packageName)) {
            // Still capture if it looks like a message notification
            Notification notification = sbn.getNotification();
            if (notification == null) return;
            String category = notification.category;
            if (category == null ||
                (!Notification.CATEGORY_MESSAGE.equals(category) &&
                 !Notification.CATEGORY_EMAIL.equals(category) &&
                 !Notification.CATEGORY_SOCIAL.equals(category))) {
                return; // Skip non-messaging notifications from unknown apps
            }
        }

        try {
            JSONObject captured = extractNotification(sbn);
            if (captured == null) return;

            // Store it
            NotificationStore store = NotificationStore.getInstance(this);
            store.add(captured);

            Log.d(TAG, "Captured notification from " + packageName +
                    ": " + captured.optString("title", "") +
                    " — " + captured.optString("text", "").substring(0, Math.min(50, captured.optString("text", "").length())));

            // Emit event to React Native (if app is in foreground)
            emitToReactNative(captured);

        } catch (Exception e) {
            Log.e(TAG, "Error processing notification", e);
        }
    }

    @Override
    public void onNotificationRemoved(StatusBarNotification sbn) {
        // We don't remove stored notifications when dismissed
        // They persist for Diva to read later
    }

    private JSONObject extractNotification(StatusBarNotification sbn) {
        try {
            Notification notification = sbn.getNotification();
            Bundle extras = notification.extras;
            String packageName = sbn.getPackageName();

            // Extract text content
            String title = extras.getString(Notification.EXTRA_TITLE, "");
            CharSequence textCs = extras.getCharSequence(Notification.EXTRA_TEXT);
            String text = textCs != null ? textCs.toString() : "";

            // BigText contains the full message (not truncated)
            CharSequence bigTextCs = extras.getCharSequence(Notification.EXTRA_BIG_TEXT);
            String bigText = bigTextCs != null ? bigTextCs.toString() : null;

            // Sub text (group name in WhatsApp, account in Gmail, etc.)
            CharSequence subTextCs = extras.getCharSequence(Notification.EXTRA_SUB_TEXT);
            String subText = subTextCs != null ? subTextCs.toString() : null;

            // Conversation title (group chats)
            CharSequence convTitleCs = extras.getCharSequence(Notification.EXTRA_CONVERSATION_TITLE);
            String conversationTitle = convTitleCs != null ? convTitleCs.toString() : null;

            // Is group?
            boolean isGroup = extras.getBoolean(Notification.EXTRA_IS_GROUP_CONVERSATION, false)
                    || conversationTitle != null;

            // Skip empty notifications
            if (title.isEmpty() && text.isEmpty()) return null;

            // Resolve app name
            String appName = packageName;
            String appCategory = "other";
            String[] known = KNOWN_APPS.get(packageName);
            if (known != null) {
                appName = known[0];
                appCategory = known[1];
            } else {
                // Try to get app label from PackageManager
                try {
                    PackageManager pm = getPackageManager();
                    ApplicationInfo appInfo = pm.getApplicationInfo(packageName, 0);
                    appName = pm.getApplicationLabel(appInfo).toString();
                } catch (PackageManager.NameNotFoundException e) {
                    // keep packageName
                }

                // Infer category from notification category
                String notifCategory = notification.category;
                if (Notification.CATEGORY_MESSAGE.equals(notifCategory)) {
                    appCategory = "message";
                } else if (Notification.CATEGORY_EMAIL.equals(notifCategory)) {
                    appCategory = "email";
                } else if (Notification.CATEGORY_SOCIAL.equals(notifCategory)) {
                    appCategory = "social";
                }
            }

            JSONObject obj = new JSONObject();
            obj.put("packageName", packageName);
            obj.put("appName", appName);
            obj.put("title", title);
            obj.put("text", text);
            obj.put("bigText", bigText);
            obj.put("subText", subText);
            obj.put("timestamp", sbn.getPostTime());
            obj.put("category", appCategory);
            obj.put("isGroup", isGroup);
            obj.put("conversationTitle", conversationTitle);

            return obj;

        } catch (Exception e) {
            Log.e(TAG, "Failed to extract notification", e);
            return null;
        }
    }

    private void emitToReactNative(JSONObject notification) {
        // This will only work if the React context is available (app in foreground)
        try {
            // We use a static approach — the module will register a listener
            if (NotificationReaderModule.reactContext != null) {
                WritableMap map = Arguments.createMap();
                map.putString("id", notification.optString("id", ""));
                map.putString("packageName", notification.optString("packageName", ""));
                map.putString("appName", notification.optString("appName", ""));
                map.putString("title", notification.optString("title", ""));
                map.putString("text", notification.optString("text", ""));
                map.putString("bigText", notification.isNull("bigText") ? null : notification.optString("bigText"));
                map.putString("subText", notification.isNull("subText") ? null : notification.optString("subText"));
                map.putDouble("timestamp", notification.optLong("timestamp", 0));
                map.putString("category", notification.optString("category", ""));
                map.putBoolean("isGroup", notification.optBoolean("isGroup", false));
                map.putString("conversationTitle", notification.isNull("conversationTitle") ? null : notification.optString("conversationTitle"));

                NotificationReaderModule.reactContext
                        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                        .emit("onNotificationReceived", map);
            }
        } catch (Exception e) {
            Log.d(TAG, "Could not emit to RN (app might be in background)");
        }
    }
}
