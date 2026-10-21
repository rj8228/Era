package com.raj.era

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import org.json.JSONObject
import java.util.Calendar

/** Daily and weekly retro reminders, kept in SharedPreferences and set with AlarmManager. */
object Reminders {
    private const val PREFS = "era-reminders"
    const val CHANNEL = "retro"

    fun save(ctx: Context, json: String) {
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString("cfg", json).apply()
    }

    private fun cfg(ctx: Context): JSONObject? =
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("cfg", null)?.let { runCatching { JSONObject(it) }.getOrNull() }

    fun isOn(ctx: Context) = cfg(ctx)?.optBoolean("on", true) ?: false

    private fun pending(ctx: Context, kind: String): PendingIntent {
        val i = Intent(ctx, ReminderReceiver::class.java).putExtra("kind", kind)
        return PendingIntent.getBroadcast(ctx, if (kind == "daily") 1 else 2, i, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }

    private fun nextAt(hm: String, dow: Int?): Long {
        val parts = hm.split(":")
        val c = Calendar.getInstance()
        c.set(Calendar.HOUR_OF_DAY, parts.getOrNull(0)?.toIntOrNull() ?: 21)
        c.set(Calendar.MINUTE, parts.getOrNull(1)?.toIntOrNull() ?: 30)
        c.set(Calendar.SECOND, 0); c.set(Calendar.MILLISECOND, 0)
        val now = System.currentTimeMillis()
        if (dow == null) {
            if (c.timeInMillis <= now) c.add(Calendar.DAY_OF_YEAR, 1)
        } else {
            // dow: 0 = Sunday, as in JavaScript
            while (c.get(Calendar.DAY_OF_WEEK) - 1 != dow || c.timeInMillis <= now) c.add(Calendar.DAY_OF_YEAR, 1)
        }
        return c.timeInMillis
    }

    fun schedule(ctx: Context) {
        val am = ctx.getSystemService(AlarmManager::class.java) ?: return
        val daily = pending(ctx, "daily"); val weekly = pending(ctx, "weekly")
        am.cancel(daily); am.cancel(weekly)
        val c = cfg(ctx) ?: return
        if (!c.optBoolean("on", true)) return
        am.setInexactRepeating(AlarmManager.RTC_WAKEUP, nextAt(c.optString("daily", "21:30"), null), AlarmManager.INTERVAL_DAY, daily)
        am.setInexactRepeating(AlarmManager.RTC_WAKEUP, nextAt(c.optString("weekly", "19:00"), c.optInt("weeklyDow", 0)), AlarmManager.INTERVAL_DAY * 7, weekly)
    }

    fun notify(ctx: Context, kind: String) {
        val nm = ctx.getSystemService(NotificationManager::class.java) ?: return
        if (Build.VERSION.SDK_INT >= 26) nm.createNotificationChannel(NotificationChannel(CHANNEL, "Retros", NotificationManager.IMPORTANCE_DEFAULT))
        val open = PendingIntent.getActivity(ctx, 0, Intent(ctx, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP), PendingIntent.FLAG_IMMUTABLE)
        val title = if (kind == "weekly") "Weekly retro, 3 minutes" else "How did today go?"
        val text = if (kind == "weekly") "Look at your week's shape and pick one change." else "30 seconds: same as usual, or tap what was different."
        val n = android.app.Notification.Builder(ctx, CHANNEL)
            .setSmallIcon(R.drawable.ic_note)
            .setContentTitle(title)
            .setContentText(text)
            .setContentIntent(open)
            .setAutoCancel(true)
            .build()
        runCatching { nm.notify(if (kind == "weekly") 2 else 1, n) }
    }
}

class ReminderReceiver : BroadcastReceiver() {
    override fun onReceive(ctx: Context, intent: Intent) {
        Reminders.notify(ctx, intent.getStringExtra("kind") ?: "daily")
    }
}

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(ctx: Context, intent: Intent) {
        Reminders.schedule(ctx)
    }
}
