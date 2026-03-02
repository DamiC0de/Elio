package expo.modules.notificationreader;

import android.content.Context;
import android.content.SharedPreferences;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Thread-safe in-memory + SharedPreferences store for captured notifications.
 * Keeps last 500 notifications max.
 */
public class NotificationStore {
    private static final String PREFS_NAME = "diva_notifications";
    private static final String KEY_DATA = "captured_notifications";
    private static final int MAX_STORED = 500;

    private static NotificationStore instance;
    private final List<JSONObject> notifications = new ArrayList<>();
    private final SharedPreferences prefs;

    private NotificationStore(Context context) {
        prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        loadFromDisk();
    }

    public static synchronized NotificationStore getInstance(Context context) {
        if (instance == null) {
            instance = new NotificationStore(context.getApplicationContext());
        }
        return instance;
    }

    public synchronized void add(JSONObject notification) {
        // Generate unique ID
        try {
            notification.put("id", UUID.randomUUID().toString());
        } catch (JSONException e) {
            // ignore
        }

        notifications.add(0, notification); // newest first

        // Trim
        while (notifications.size() > MAX_STORED) {
            notifications.remove(notifications.size() - 1);
        }

        saveToDisk();
    }

    public synchronized List<JSONObject> getAll() {
        return new ArrayList<>(notifications);
    }

    public synchronized List<JSONObject> getFiltered(
            String[] packageNames, long since, int limit, String category) {
        List<JSONObject> result = new ArrayList<>();

        for (JSONObject notif : notifications) {
            if (result.size() >= limit) break;

            try {
                // Filter by timestamp
                if (since > 0 && notif.optLong("timestamp", 0) < since) continue;

                // Filter by package
                if (packageNames != null && packageNames.length > 0) {
                    String pkg = notif.optString("packageName", "");
                    boolean match = false;
                    for (String p : packageNames) {
                        if (pkg.equals(p)) { match = true; break; }
                    }
                    if (!match) continue;
                }

                // Filter by category
                if (category != null && !category.equals("all")) {
                    String cat = notif.optString("category", "");
                    if (!cat.equals(category)) continue;
                }

                result.add(notif);
            } catch (Exception e) {
                // skip malformed
            }
        }
        return result;
    }

    public synchronized void clear(String packageName) {
        if (packageName == null) {
            notifications.clear();
        } else {
            notifications.removeIf(n -> packageName.equals(n.optString("packageName", "")));
        }
        saveToDisk();
    }

    public synchronized int count() {
        return notifications.size();
    }

    private void saveToDisk() {
        JSONArray arr = new JSONArray();
        for (JSONObject n : notifications) {
            arr.put(n);
        }
        prefs.edit().putString(KEY_DATA, arr.toString()).apply();
    }

    private void loadFromDisk() {
        String data = prefs.getString(KEY_DATA, "[]");
        try {
            JSONArray arr = new JSONArray(data);
            for (int i = 0; i < arr.length() && i < MAX_STORED; i++) {
                notifications.add(arr.getJSONObject(i));
            }
        } catch (JSONException e) {
            // corrupt data, start fresh
        }
    }
}
