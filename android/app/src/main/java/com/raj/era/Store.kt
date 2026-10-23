package com.raj.era

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Small shared store between the web app and the parts of Era that run without it
 * (notification buttons, widgets): taps waiting for the app, what to open next, and the widget data.
 */
object Store {
    private const val PREFS = "era-bridge"

    private fun prefs(ctx: Context) = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun today(): String = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())

    @Synchronized
    fun addPending(ctx: Context, item: JSONObject) {
        val list = runCatching { JSONArray(prefs(ctx).getString("pending", "[]")) }.getOrElse { JSONArray() }
        list.put(item)
        prefs(ctx).edit().putString("pending", list.toString()).commit()
    }

    @Synchronized
    fun takePending(ctx: Context): String {
        val s = prefs(ctx).getString("pending", "[]") ?: "[]"
        prefs(ctx).edit().remove("pending").commit()
        return s
    }

    fun setOpen(ctx: Context, what: String) { prefs(ctx).edit().putString("open", what).commit() }

    @Synchronized
    fun takeOpen(ctx: Context): String {
        val s = prefs(ctx).getString("open", "") ?: ""
        if (s.isNotEmpty()) prefs(ctx).edit().remove("open").commit()
        return s
    }

    fun setWidget(ctx: Context, json: String) { prefs(ctx).edit().putString("widget", json).apply() }

    fun widget(ctx: Context): JSONObject? =
        prefs(ctx).getString("widget", null)?.let { runCatching { JSONObject(it) }.getOrNull() }

    /** After "Looks right" from a notification or widget, show the day as logged right away. */
    fun markLogged(ctx: Context, day: String) {
        val w = widget(ctx) ?: return
        if (w.optString("date") == day) { w.put("logged", true); setWidget(ctx, w.toString()) }
    }
}
