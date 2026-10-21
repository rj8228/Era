plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.raj.era"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.raj.era"
        minSdk = 26
        targetSdk = 35
        versionCode = 2
        versionName = "0.1.1"
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
