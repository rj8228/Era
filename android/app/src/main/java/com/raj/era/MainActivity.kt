package com.raj.era

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.ContentValues
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.MediaStore
import android.provider.Settings
import android.webkit.JavascriptInterface
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.widget.Toast
import androidx.webkit.ServiceWorkerClientCompat
import androidx.webkit.ServiceWorkerControllerCompat
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewFeature
import androidx.webkit.WebViewClientCompat

/**
 * Era on Android: the same web app, served offline from the APK's assets on a virtual https origin
 * (so localStorage works), plus a small bridge for things a web page can't do here: notifications
 * (with a "Looks right" button), screen time, home-screen widgets, sharing and saving a backup file.
 */
class MainActivity : Activity() {

    companion object {
        private const val HOST = "appassets.androidplatform.net"
        private const val HOME = "https://$HOST/assets/index.html"
        private const val REQ_FILE = 7
        private const val REQ_NOTIFY = 8
    }

    private lateinit var web: WebView
    private lateinit var loader: WebViewAssetLoader
    private var fileCallback: ValueCallback<Array<Uri>>? = null

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        loader = WebViewAssetLoader.Builder()
            .setDomain(HOST)
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        // Older versions registered a service worker; route its requests to the APK's files too,
        // so it can never serve stale code after an update (the page then removes it).
        if (WebViewFeature.isFeatureSupported(WebViewFeature.SERVICE_WORKER_BASIC_USAGE)) {
            ServiceWorkerControllerCompat.getInstance().setServiceWorkerClient(object : ServiceWorkerClientCompat() {
                override fun shouldInterceptRequest(request: WebResourceRequest): WebResourceResponse? =
                    loader.shouldInterceptRequest(request.url)
            })
        }
        web = WebView(this)
        setContentView(web)
        web.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = false
            allowContentAccess = false
        }
        web.addJavascriptInterface(Bridge(), "EraNative")
        web.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(view: WebView, callback: ValueCallback<Array<Uri>>, params: FileChooserParams): Boolean {
                fileCallback?.onReceiveValue(null)
                fileCallback = callback
                val pick = Intent(Intent.ACTION_GET_CONTENT).apply {
                    addCategory(Intent.CATEGORY_OPENABLE)
                    type = "*/*"
                }
                return try { startActivityForResult(pick, REQ_FILE); true } catch (e: ActivityNotFoundException) { fileCallback = null; false }
            }
        }
        web.webViewClient = object : WebViewClientCompat() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
                loader.shouldInterceptRequest(request.url)

            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                if (request.url.host == HOST) return false
                openExternal(request.url)
                return true
            }
        }
        // A new install of the app: drop the HTTP cache so every file is read fresh (saved data is kept).
        val prefs = getSharedPreferences("era-app", MODE_PRIVATE)
        val ver = packageManager.getPackageInfo(packageName, 0).versionName ?: ""
        if (prefs.getString("ver", "") != ver) { web.clearCache(true); prefs.edit().putString("ver", ver).apply() }
        handleOpen(intent)
        if (savedInstanceState != null) web.restoreState(savedInstanceState) else web.loadUrl(HOME)
        Reminders.schedule(this) // keep alarms in place after updates
    }

    /** Notifications and widgets open the app with "open" = check / today / week / era. */
    private fun handleOpen(i: Intent?) {
        val what = i?.getStringExtra("open")
        if (!what.isNullOrEmpty()) { Store.setOpen(this, what); i?.removeExtra("open") }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleOpen(intent)
        resumePage()
    }

    override fun onResume() {
        super.onResume()
        resumePage()
    }

    private fun resumePage() {
        if (::web.isInitialized) web.evaluateJavascript("window.eraResume && window.eraResume()", null)
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        web.saveState(outState)
    }

    @Deprecated("Deprecated in Java")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == REQ_FILE) {
            val uri = if (resultCode == RESULT_OK) data?.data else null
            fileCallback?.onReceiveValue(if (uri != null) arrayOf(uri) else null)
            fileCallback = null
        }
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        web.evaluateJavascript("(window.eraBack ? window.eraBack() : 'none')") { r ->
            if (r?.contains("closed") != true) finish()
        }
    }

    private fun openExternal(uri: Uri) {
        try { startActivity(Intent(Intent.ACTION_VIEW, uri)) }
        catch (e: ActivityNotFoundException) { Toast.makeText(this, "No app can open that link", Toast.LENGTH_SHORT).show() }
    }

    inner class Bridge {
        /** Called by the page with {"on":true,"daily":"21:30","weekly":"19:00","weeklyDow":0,"app":"Era"}. */
        @JavascriptInterface
        fun schedule(json: String) {
            Reminders.save(this@MainActivity, json)
            runOnUiThread {
                if (Build.VERSION.SDK_INT >= 33 &&
                    checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED &&
                    Reminders.isOn(this@MainActivity)) {
                    requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), REQ_NOTIFY)
                }
                Reminders.schedule(this@MainActivity)
            }
        }

        /** "granted" once Usage access is on for Era. */
        @JavascriptInterface
        fun stStatus(): String = if (ScreenTime.granted(this@MainActivity)) "granted" else "denied"

        /** Opens Android's Usage access settings. */
        @JavascriptInterface
        fun stOpen() {
            runOnUiThread {
                try { startActivity(Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).setData(Uri.parse("package:$packageName"))) }
                catch (e: Exception) {
                    try { startActivity(Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)) }
                    catch (e2: Exception) { Toast.makeText(this@MainActivity, "Open Settings → Apps → Special access → Usage access", Toast.LENGTH_LONG).show() }
                }
            }
        }

        /** Minutes per app and per half hour for a yyyy-mm-dd day. */
        @JavascriptInterface
        fun stDay(day: String): String = runCatching { ScreenTime.day(this@MainActivity, day) }.getOrElse { "{\"apps\":[],\"slots\":{}}" }

        /** Taps on notification and widget buttons since the app last ran. */
        @JavascriptInterface
        fun takePending(): String = Store.takePending(this@MainActivity)

        @JavascriptInterface
        fun takeOpen(): String = Store.takeOpen(this@MainActivity)

        /** What the home-screen widgets show. */
        @JavascriptInterface
        fun setWidget(json: String) {
            Store.setWidget(this@MainActivity, json)
            EraWidgets.updateAll(this@MainActivity)
        }

        @JavascriptInterface
        fun share(text: String) {
            runOnUiThread {
                val send = Intent(Intent.ACTION_SEND).apply { type = "text/plain"; putExtra(Intent.EXTRA_TEXT, text) }
                startActivity(Intent.createChooser(send, "Share"))
            }
        }

        /** Saves a text file (the backup) to Downloads. */
        @JavascriptInterface
        fun saveFile(name: String, text: String) {
            runOnUiThread {
                try {
                    if (Build.VERSION.SDK_INT >= 29) {
                        val values = ContentValues().apply {
                            put(MediaStore.Downloads.DISPLAY_NAME, name)
                            put(MediaStore.Downloads.MIME_TYPE, "application/json")
                        }
                        val uri = contentResolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
                        if (uri != null) contentResolver.openOutputStream(uri)?.use { it.write(text.toByteArray()) }
                        Toast.makeText(this@MainActivity, "Saved $name to Downloads", Toast.LENGTH_LONG).show()
                    } else {
                        share(text)
                    }
                } catch (e: Exception) {
                    Toast.makeText(this@MainActivity, "Couldn't save the backup", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }
}
