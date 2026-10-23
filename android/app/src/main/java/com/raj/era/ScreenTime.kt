package com.raj.era

import android.app.AppOpsManager
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.os.Build
import android.os.Process
import org.json.JSONArray
import org.json.JSONObject
import java.util.Calendar

/**
 * Screen time from Android's own usage records: how long each app was in the foreground, per half
 * hour of a day. Only totals are read; nothing about what happens inside apps, and nothing leaves
 * the phone. Needs the user to turn on Usage access for Era in Android settings.
 */
object ScreenTime {
    // UsageEvents.Event types, as numbers so older Android versions are fine.
    private const val RESUMED = 1
    private const val PAUSED = 2
    private const val SCREEN_OFF = 16
    private const val KEYGUARD_SHOWN = 17
    private const val SHUTDOWN = 26

    fun granted(ctx: Context): Boolean {
        val ops = ctx.getSystemService(AppOpsManager::class.java) ?: return false
        val mode = if (Build.VERSION.SDK_INT >= 29) {
            ops.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), ctx.packageName)
        } else {
            @Suppress("DEPRECATION")
            ops.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), ctx.packageName)
        }
        return mode == AppOpsManager.MODE_ALLOWED
    }

    private fun skipped(ctx: Context): Set<String> {
        val pm = ctx.packageManager
        val homes = runCatching {
            pm.queryIntentActivities(Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME), PackageManager.MATCH_DEFAULT_ONLY)
                .map { it.activityInfo.packageName }
        }.getOrElse { emptyList() }
        return (homes + listOf(ctx.packageName, "com.android.systemui", "android")).toSet()
    }

    /** {"apps":[{"pkg","label","hint","min"}], "slots":{"pkg":[48 numbers of minutes]}} for a yyyy-mm-dd day. */
    fun day(ctx: Context, ymd: String): String {
        val out = JSONObject().put("apps", JSONArray()).put("slots", JSONObject())
        if (!granted(ctx)) return out.toString()
        val usm = ctx.getSystemService(UsageStatsManager::class.java) ?: return out.toString()
        val parts = ymd.split("-").mapNotNull { it.toIntOrNull() }
        if (parts.size != 3) return out.toString()
        val cal = Calendar.getInstance().apply {
            set(parts[0], parts[1] - 1, parts[2], 0, 0, 0); set(Calendar.MILLISECOND, 0)
        }
        val dayStart = cal.timeInMillis
        cal.add(Calendar.DAY_OF_YEAR, 1)
        val dayEnd = cal.timeInMillis
        val now = System.currentTimeMillis()
        val end = minOf(dayEnd, now)
        if (end <= dayStart) return out.toString()

        // Rebuild foreground sessions from the event stream (starting a few hours early, for an app already open at midnight).
        val events = usm.queryEvents(dayStart - 6 * 3600_000L, end)
        val ev = UsageEvents.Event()
        val sessions = ArrayList<Triple<String, Long, Long>>()
        var cur: String? = null
        var curStart = 0L
        fun close(t: Long) { val p = cur ?: return; if (t > curStart) sessions.add(Triple(p, curStart, t)); cur = null }
        while (events.hasNextEvent()) {
            events.getNextEvent(ev)
            val t = ev.timeStamp
            when (ev.eventType) {
                RESUMED -> if (cur != ev.packageName) { close(t); cur = ev.packageName; curStart = t }
                PAUSED -> if (cur == ev.packageName) close(t)
                SCREEN_OFF, KEYGUARD_SHOWN, SHUTDOWN -> close(t)
            }
        }
        if (cur != null) close(if (end == now) now else minOf(end, curStart + 3 * 3600_000L))

        val skip = skipped(ctx)
        val slotMs = 30 * 60_000L
        val slots = HashMap<String, DoubleArray>()
        for ((pkg, a0, b0) in sessions) {
            if (pkg in skip) continue
            val a = maxOf(a0, dayStart); val b = minOf(b0, end)
            if (b <= a) continue
            val arr = slots.getOrPut(pkg) { DoubleArray(48) }
            var i = ((a - dayStart) / slotMs).toInt()
            while (i < 48) {
                val s = dayStart + i * slotMs; val e = s + slotMs
                if (s >= b) break
                val overlap = minOf(e, b) - maxOf(s, a)
                if (overlap > 0) arr[i] += overlap / 60_000.0
                i++
            }
        }

        val pm = ctx.packageManager
        val apps = JSONArray(); val slotJson = JSONObject()
        slots.entries.map { it.key to it.value.sum() }.filter { it.second >= 1.0 }.sortedByDescending { it.second }.forEach { (pkg, total) ->
            var label = pkg; var hint = ""
            try {
                val info: ApplicationInfo = pm.getApplicationInfo(pkg, 0)
                label = pm.getApplicationLabel(info).toString()
                hint = when (info.category) {
                    ApplicationInfo.CATEGORY_SOCIAL -> "social"
                    ApplicationInfo.CATEGORY_VIDEO -> "video"
                    ApplicationInfo.CATEGORY_GAME -> "game"
                    ApplicationInfo.CATEGORY_NEWS -> "news"
                    ApplicationInfo.CATEGORY_PRODUCTIVITY -> "productivity"
                    else -> ""
                }
            } catch (e: PackageManager.NameNotFoundException) { /* keep the package name */ }
            apps.put(JSONObject().put("pkg", pkg).put("label", label).put("hint", hint).put("min", Math.round(total).toInt()))
            val arr = JSONArray(); slots[pkg]!!.forEach { arr.put(Math.round(it * 10) / 10.0) }
            slotJson.put(pkg, arr)
        }
        return out.put("apps", apps).put("slots", slotJson).toString()
    }
}
