plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// Version comes from version.js at the repo root, e.g. "0.1.4" -> versionCode 104.
val eraVersion: String = Regex("ERA_VERSION\\s*=\\s*\"([0-9.]+)\"").find(rootProject.file("../version.js").readText())!!.groupValues[1]
val eraCode: Int = eraVersion.split(".").map { it.toInt() }.let { it[0] * 10000 + it[1] * 100 + it[2] }

android {
    namespace = "com.raj.era"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.raj.era"
        minSdk = 26
        targetSdk = 35
        versionCode = eraCode
        versionName = eraVersion
    }

    // One fixed key for every build, so each new APK installs over the last one.
    // The key is never in this repo: CI writes it from secrets (backup in the private rj8228/signing-keys repo).
    // Without ERA_KEYSTORE the release build comes out unsigned.
    val keystore = System.getenv("ERA_KEYSTORE")
    signingConfigs {
        if (keystore != null) create("era") {
            storeFile = file(keystore)
            storePassword = System.getenv("ERA_KEYSTORE_PASSWORD")
            keyAlias = "era"
            keyPassword = System.getenv("ERA_KEY_PASSWORD")
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            if (keystore != null) signingConfig = signingConfigs.getByName("era")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}

dependencies {
    implementation("androidx.webkit:webkit:1.12.1")
}
