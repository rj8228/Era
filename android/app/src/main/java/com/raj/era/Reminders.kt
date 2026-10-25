package com.raj.era

import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.graphics.drawable.Icon
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale

/**
 * Notifications: the daily recap (with a "Looks right" button that logs a normal day without opening
 * the app), the weekly vibe check, and one-off ones the app asks for (era ends, lock-in ends).
 * Settings live in SharedPreferences and alarms are set with AlarmManager. They stay neutral: no red.
 */
object Reminders {
    private const val PREFS = "era-reminders"
    const val CHANNEL = "retro"
    private const val DAILY_ID = 1
    private const val WEEKLY_ID = 2
    const val LOGGED_ID = 3

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

    private fun oncePending(ctx: Context, id: String, title: String, text: String, open: String = "era"): PendingIntent {
        val i = Intent(ctx, ReminderReceiver::class.java).setAction("once:$id").putExtra("kind", "once").putExtra("title", title).putExtra("text", text).putExtra("open", open)
        return PendingIntent.getBroadcast(ctx, 1000 + (id.hashCode() and 0xffff), i, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
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
        val prefs = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val daily = pending(ctx, "daily"); val weekly = pending(ctx, "weekly")
        am.cancel(daily); am.cancel(weekly)
        // Cancel the one-off alarms set last time; the current list is set again below.
        val old = runCatching { JSONArray(prefs.getString("once", "[]")) }.getOrElse { JSONArray() }
        for (i in 0 until old.length()) {
            val o = old.optJSONObject(i) ?: continue
            am.cancel(oncePending(ctx, o.optString("id"), o.optString("title"), o.optString("text")))
        }
        val c = cfg(ctx) ?: return
        if (!c.optBoolean("on", true)) { prefs.edit().putString("once", "[]").apply(); return }
        am.setInexactRepeating(AlarmManager.RTC_WAKEUP, nextAt(c.optString("daily", "21:30"), null), AlarmManager.INTERVAL_DAY, daily)
        am.setInexactRepeating(AlarmManager.RTC_WAKEUP, nextAt(c.optString("weekly", "19:00"), c.optInt("weeklyDow", 0)), AlarmManager.INTERVAL_DAY * 7, weekly)
        val once = c.optJSONArray("once") ?: JSONArray()
        val fmt = SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.US)
        val now = System.currentTimeMillis()
        for (i in 0 until once.length()) {
            val o = once.optJSONObject(i) ?: continue
            val at = runCatching { fmt.parse(o.optString("at"))?.time }.getOrNull() ?: continue
            if (at <= now) continue
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, oncePending(ctx, o.optString("id"), o.optString("title"), o.optString("text"), o.optString("open", "era")))
        }
        prefs.edit().putString("once", once.toString()).apply()
    }

    private fun channel(ctx: Context): NotificationManager? {
        val nm = ctx.getSystemService(NotificationManager::class.java) ?: return null
        nm.createNotificationChannel(NotificationChannel(CHANNEL, "Recaps and retros", NotificationManager.IMPORTANCE_DEFAULT))
        return nm
    }

    private fun openApp(ctx: Context, what: String, code: Int): PendingIntent {
        val i = Intent(ctx, MainActivity::class.java).putExtra("open", what)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        return PendingIntent.getActivity(ctx, code, i, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }

    /** Days of a trip: nothing to log, so the daily recap stays quiet. */
    fun awayToday(ctx: Context): Boolean {
        val a = cfg(ctx)?.optJSONArray("away") ?: return false
        val t = Store.today()
        return (0 until a.length()).any { a.optString(it) == t }
    }

    fun notify(ctx: Context, kind: String, title: String?, text: String?, open: String? = null) {
        val nm = channel(ctx) ?: return
        val c = cfg(ctx)
        val b = Notification.Builder(ctx, CHANNEL).setSmallIcon(R.drawable.ic_note).setAutoCancel(true)
        when (kind) {
            "daily" -> {
                val w = Store.widget(ctx)
                val today = Store.today()
                if (w != null && w.optString("date") == today && w.optBoolean("logged")) return // already logged today
                if (awayToday(ctx)) return // on a trip
                val dayName = Calendar.getInstance().getDisplayName(Calendar.DAY_OF_WEEK, Calendar.LONG, Locale.US) ?: "day"
                val free = if (w != null && w.optString("date") == today) ", " + w.optString("free") + " free" else ""
                val confirm = PendingIntent.getBroadcast(ctx, 11,
                    Intent(ctx, ConfirmReceiver::class.java).setAction(ConfirmReceiver.ACTION).putExtra("d", today).putExtra("from", "notif"),
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
                b.setContentTitle("How did today go?")
                    .setContentText("Your usual $dayName$free")
                    .setContentIntent(openApp(ctx, "check", 12))
                    .addAction(Notification.Action.Builder(null as Icon?, "Looks right", confirm).build())
                    .addAction(Notification.Action.Builder(null as Icon?, "Something changed", openApp(ctx, "check", 13)).build())
                runCatching { nm.notify(DAILY_ID, b.build()) }
            }
            "weekly" -> {
                b.setContentTitle(c?.optString("weeklyTitle")?.takeIf { it.isNotEmpty() } ?: "Vibe check, 3 minutes")
                    .setContentText("See your week's shape and pick one change")
                    .setContentIntent(openApp(ctx, "week", 14))
                runCatching { nm.notify(WEEKLY_ID, b.build()) }
            }
            else -> {
                b.setContentTitle(title ?: "Era").setContentText(text ?: "").setContentIntent(open?.takeIf { it.isNotEmpty() && it != "era" }?.let { openApp(ctx, it, 17) } ?: openApp(ctx, "era", 15))
                runCatching { nm.notify(100 + ((title ?: "").hashCode() and 0xfff), b.build()) }
            }
        }
    }

    /** After "Looks right" on the notification: a quiet confirmation in its place. */
    fun notifyLogged(ctx: Context) {
        val nm = channel(ctx) ?: return
        nm.cancel(DAILY_ID)
        val n = Notification.Builder(ctx, CHANNEL).setSmallIcon(R.drawable.ic_note)
            .setContentTitle("Day logged").setContentText("From the notification. See you tomorrow.")
            .setContentIntent(openApp(ctx, "today", 16)).setAutoCancel(true).setTimeoutAfter(10 * 60_000L).build()
        runCatching { nm.notify(LOGGED_ID, n) }
    }
}

class ReminderReceiver : BroadcastReceiver() {
    override fun onReceive(ctx: Context, intent: Intent) {
        Reminders.notify(ctx, intent.getStringExtra("kind") ?: "daily", intent.getStringExtra("title"), intent.getStringExtra("text"), intent.getStringExtra("open"))
    }
}

/** "Looks right" from the notification or the widget: queue the day for the app and show it as logged. */
class ConfirmReceiver : BroadcastReceiver() {
    companion object { const val ACTION = "com.raj.era.CONFIRM" }
    override fun onReceive(ctx: Context, intent: Intent) {
        val from = intent.getStringExtra("from") ?: ""
        val day = if (from == "widget") Store.today() else intent.getStringExtra("d") ?: Store.today()
        Store.addPending(ctx, JSONObject().put("t", "confirm").put("d", day))
        Store.markLogged(ctx, day)
        if (from == "notif") Reminders.notifyLogged(ctx)
        EraWidgets.updateAll(ctx)
    }
}

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(ctx: Context, intent: Intent) {
        Reminders.schedule(ctx)
        EraWidgets.updateAll(ctx)
    }
}
