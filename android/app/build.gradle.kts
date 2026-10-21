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
    signingConfigs {
        create("era") {
            storeFile = file("era.jks")
            storePassword = "erakeys1"
            keyAlias = "era"
            keyPassword = "erakeys1"
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("era")
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
