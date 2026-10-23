package com.raj.era

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Typeface
import android.widget.RemoteViews
import org.json.JSONObject

/**
 * Home-screen widgets. They only show what the app last sent (Store.widget) and stay neutral:
 * free hours today with a "Looks right" button, today's dial with no red, and weekends left.
 */
object EraWidgets {
    private val KINDS = listOf(FreeWidget::class.java, DialWidget::class.java, WeekendsWidget::class.java)

    fun updateAll(ctx: Context) {
        val m = AppWidgetManager.getInstance(ctx) ?: return
        for (cls in KINDS) {
            val ids = m.getAppWidgetIds(ComponentName(ctx, cls))
            if (ids.isNotEmpty()) update(ctx, m, ids, cls)
        }
    }

    fun update(ctx: Context, m: AppWidgetManager, ids: IntArray, cls: Class<*>) {
        for (id in ids) runCatching { m.updateAppWidget(id, views(ctx, cls)) }
    }

    private fun open(ctx: Context, what: String, code: Int): PendingIntent {
        val i = Intent(ctx, MainActivity::class.java).putExtra("open", what)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        return PendingIntent.getActivity(ctx, code, i, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }

    private fun confirm(ctx: Context): PendingIntent {
        val i = Intent(ctx, ConfirmReceiver::class.java).setAction(ConfirmReceiver.ACTION).putExtra("from", "widget")
        return PendingIntent.getBroadcast(ctx, 31, i, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }

    private fun views(ctx: Context, cls: Class<*>): RemoteViews {
        val w = Store.widget(ctx)
        val fresh = w != null && w.optString("date") == Store.today()
        return when (cls) {
            FreeWidget::class.java -> RemoteViews(ctx.packageName, R.layout.widget_free).apply {
                val logged = fresh && w!!.optBoolean("logged")
                setTextViewText(R.id.w_free, if (fresh) w!!.optString("free") else "–")
                setTextViewText(R.id.w_btn, if (logged) "Logged ✓" else "Looks right")
                setOnClickPendingIntent(R.id.w_root, open(ctx, "today", 21))
                setOnClickPendingIntent(R.id.w_btn, if (logged) open(ctx, "today", 22) else confirm(ctx))
            }
            DialWidget::class.java -> RemoteViews(ctx.packageName, R.layout.widget_dial).apply {
                setImageViewBitmap(R.id.w_img, dial(if (fresh) w else null))
                setOnClickPendingIntent(R.id.w_root, open(ctx, "check", 23))
            }
            else -> RemoteViews(ctx.packageName, R.layout.widget_weekends).apply {
                val left = w?.optInt("wleft", -1) ?: -1
                val year = w?.optString("year") ?: ""
                setTextViewText(R.id.w_title, if (left >= 0) "$left weekend${if (left == 1) "" else "s"} left in $year" else "Weekends left")
                setImageViewBitmap(R.id.w_dots, dots(w))
                val next = w?.optString("next") ?: ""
                setTextViewText(R.id.w_next, if (next.isNotEmpty()) "Next: $next" else "Tap to claim one")
                setOnClickPendingIntent(R.id.w_root, open(ctx, "era", 24))
            }
        }
    }

    private fun color(s: String, fallback: Int) = runCatching { Color.parseColor(s) }.getOrDefault(fallback)

    /** Today's 24-hour dial, midnight at the top. Less-of time is already grey in the data. */
    private fun dial(w: JSONObject?): Bitmap {
        val size = 360
        val bmp = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
        val c = Canvas(bmp)
        val stroke = 44f
        val r = size / 2f - stroke / 2f - 4f
        val rect = RectF(size / 2f - r, size / 2f - r, size / 2f + r, size / 2f + r)
        val p = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE; strokeWidth = stroke }
        p.color = 0xFFE6E9F0.toInt()
        c.drawArc(rect, 0f, 360f, false, p)
        val blocks = w?.optJSONArray("blocks")
        if (blocks != null) for (i in 0 until blocks.length()) {
            val b = blocks.optJSONArray(i) ?: continue
            val s = b.optDouble(0); val e = b.optDouble(1)
            p.color = color(b.optString(2), 0xFFC9CEDC.toInt())
            val start = (s / 24.0 * 360.0 - 90.0).toFloat()
            val sweep = ((e - s) / 24.0 * 360.0).toFloat()
            c.drawArc(rect, start + 0.5f, maxOf(0.5f, sweep - 1f), false, p)
        }
        val tp = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = 0xFF1B1F33.toInt(); textAlign = Paint.Align.CENTER
            textSize = 62f; typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        }
        c.drawText(w?.optString("free")?.takeIf { it.isNotEmpty() } ?: "–", size / 2f, size / 2f + 8f, tp)
        tp.textSize = 28f; tp.typeface = Typeface.DEFAULT; tp.color = 0xFF5A6075.toInt()
        c.drawText("free today", size / 2f, size / 2f + 48f, tp)
        return bmp
    }

    /** Up to 10 dots, one per weekend left this year; claimed ones in their area's colour. */
    private fun dots(w: JSONObject?): Bitmap {
        val n = 10; val cell = 60; val h = 60
        val bmp = Bitmap.createBitmap(n * cell, h, Bitmap.Config.ARGB_8888)
        val c = Canvas(bmp)
        val p = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE }
        val arr = w?.optJSONArray("dots")
        val count = minOf(n, arr?.length() ?: 0)
        for (i in 0 until count) {
            val col = arr!!.optString(i)
            val cx = i * cell + cell / 2f; val cy = h / 2f
            if (col.isNotEmpty()) { p.strokeWidth = 7f; p.color = color(col, 0xFF2463C9.toInt()) } else { p.strokeWidth = 3f; p.color = 0xFFC9CEDC.toInt() }
            c.drawCircle(cx, cy, 20f, p)
        }
        return bmp
    }
}

class FreeWidget : AppWidgetProvider() {
    override fun onUpdate(ctx: Context, m: AppWidgetManager, ids: IntArray) = EraWidgets.update(ctx, m, ids, FreeWidget::class.java)
}

class DialWidget : AppWidgetProvider() {
    override fun onUpdate(ctx: Context, m: AppWidgetManager, ids: IntArray) = EraWidgets.update(ctx, m, ids, DialWidget::class.java)
}

class WeekendsWidget : AppWidgetProvider() {
    override fun onUpdate(ctx: Context, m: AppWidgetManager, ids: IntArray) = EraWidgets.update(ctx, m, ids, WeekendsWidget::class.java)
}
