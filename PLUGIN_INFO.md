# cordova-ts-authentication v1.0.0

Production Cordova plugin package for Transmit Security Authentication (A+) (iOS + Android).

## Build info

- Built: 2026-10-20 18:08:36 UTC
- Version: 1.0.0

## Installation

### From git

```bash
cordova plugin add https://github.com/TransmitSecurity/cordova_ts_authentication_plugin.git
# pinned to a release tag:
cordova plugin add https://github.com/TransmitSecurity/cordova_ts_authentication_plugin.git#v1.0.0
```

### From a local checkout of this package

```bash
cordova plugin add /path/to/cordova-ts-authentication
```

Then configure credentials and call `cordova.tsauth.initializeSDK()` or `cordova.tsauth.initialize(...)`.
See **UserGuide.md** for platform setup, API reference, and error handling.

## Contents

- JavaScript API under `www/tsauth-plugin/` (`cordova.tsauth`)
- iOS Swift Package (`Package.swift`) resolving TSAuthenticationSDK from `TransmitSecurity/authentication-ios-sdk` (`1.2.2`) via SPM
- Android Kotlin bridge + Maven dependency `com.ts.sdk:authentication:1.0.31` (`src/android/cordova-ts-authentication.gradle`)
- Cordova hooks for Kotlin, Gradle wrapper pinning, and SPM-only iOS cleanup

Xcode resolves the native iOS SDK on first build (`File > Packages > Resolve Package Versions` if needed).
