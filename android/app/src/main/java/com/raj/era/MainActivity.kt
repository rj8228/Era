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
import android.webkit.JavascriptInterface
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.widget.Toast
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewClientCompat

/**
 * Era on Android: the same web app, served offline from the APK's assets on a virtual https origin
 * (so localStorage works), plus a small bridge for things a web page can't do well here:
 * daily and weekly retro notifications, sharing, and saving a backup file.
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
        if (savedInstanceState != null) web.restoreState(savedInstanceState) else web.loadUrl(HOME)
        Reminders.schedule(this) // keep alarms in place after updates
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
        web.evaluateJavascript("(function(){var s=document.querySelector('.sheet:last-child');if(s){s.remove();return 'closed';}return 'none';})()") { r ->
            if (r?.contains("closed") != true) {
                if (web.canGoBack()) web.goBack() else finish()
            }
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
