package expo.modules.notificationreader;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.provider.Settings;
import android.text.TextUtils;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;

import org.json.JSONObject;

import java.util.List;

/**
 * EL-032 — React Native bridge for NotificationReader
 */
public class NotificationReaderModule extends ReactContextBaseJavaModule {
    public static final String NAME = "NotificationReaderModule";

    // Static reference for the listener service to emit events
    static ReactApplicationContext reactContext;

    public NotificationReaderModule(ReactApplicationContext context) {
        super(context);
        reactContext = context;
    }

    @Override
    public String getName() {
        return NAME;
    }

    /**
     * Check if notification listener permission is granted
     */
    private boolean isPermissionGranted() {
        Context ctx = getReactApplicationContext();
        String pkgName = ctx.getPackageName();
        String flat = Settings.Secure.getString(
                ctx.getContentResolver(),
                "enabled_notification_listeners"
        );
        if (!TextUtils.isEmpty(flat)) {
            String[] names = flat.split(":");
            for (String name : names) {
                ComponentName cn = ComponentName.unflattenFromString(name);
                if (cn != null && TextUtils.equals(pkgName, cn.getPackageName())) {
                    return true;
                }
            }
        }
        return false;
    }

    @ReactMethod
    public void getStatus(Promise promise) {
        try {
            boolean granted = isPermissionGranted();
            NotificationStore store = NotificationStore.getInstance(getReactApplicationContext());
            boolean serviceRunning = DivaNotificationListenerService.getInstance() != null;

            WritableMap result = Arguments.createMap();
            result.putBoolean("isAvailable", true);
            result.putBoolean("isPermissionGranted", granted);
            result.putBoolean("isServiceRunning", serviceRunning);
            result.putInt("capturedCount", store.count());

            promise.resolve(result);
        } catch (Exception e) {
            promise.reject("STATUS_ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void requestPermission(Promise promise) {
        try {
            Context ctx = getReactApplicationContext();
            Intent intent = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(intent);
            promise.resolve(null);
        } catch (Exception e) {
            promise.reject("PERMISSION_ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void getNotifications(ReadableMap filter, Promise promise) {
        try {
            NotificationStore store = NotificationStore.getInstance(getReactApplicationContext());

            // Parse filters
            String[] packageNames = null;
            if (filter.hasKey("packageNames")) {
                ReadableArray arr = filter.getArray("packageNames");
                if (arr != null) {
                    packageNames = new String[arr.size()];
                    for (int i = 0; i < arr.size(); i++) {
                        packageNames[i] = arr.getString(i);
                    }
                }
            }

            long since = filter.hasKey("since") ? (long) filter.getDouble("since") : 0;
            int limit = filter.hasKey("limit") ? filter.getInt("limit") : 50;
            String category = filter.hasKey("category") ? filter.getString("category") : "all";

            List<JSONObject> results = store.getFiltered(packageNames, since, limit, category);

            WritableArray arr = Arguments.createArray();
            for (JSONObject notif : results) {
                WritableMap map = Arguments.createMap();
                map.putString("id", notif.optString("id", ""));
                map.putString("packageName", notif.optString("packageName", ""));
                map.putString("appName", notif.optString("appName", ""));
                map.putString("title", notif.optString("title", ""));
                map.putString("text", notif.optString("text", ""));

                if (!notif.isNull("bigText")) {
                    map.putString("bigText", notif.optString("bigText"));
                } else {
                    map.putNull("bigText");
                }

                if (!notif.isNull("subText")) {
                    map.putString("subText", notif.optString("subText"));
                } else {
                    map.putNull("subText");
                }

                map.putDouble("timestamp", notif.optLong("timestamp", 0));
                map.putString("category", notif.optString("category", ""));
                map.putBoolean("isGroup", notif.optBoolean("isGroup", false));

                if (!notif.isNull("conversationTitle")) {
                    map.putString("conversationTitle", notif.optString("conversationTitle"));
                } else {
                    map.putNull("conversationTitle");
                }

                arr.pushMap(map);
            }

            promise.resolve(arr);
        } catch (Exception e) {
            promise.reject("GET_ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void clearNotifications(String packageName, Promise promise) {
        try {
            NotificationStore store = NotificationStore.getInstance(getReactApplicationContext());
            store.clear(packageName);
            promise.resolve(null);
        } catch (Exception e) {
            promise.reject("CLEAR_ERROR", e.getMessage());
        }
    }
}
