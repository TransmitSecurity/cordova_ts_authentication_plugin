# cordova-ts-authentication v1.0.0

Production Cordova plugin package for Transmit Security Authentication (A+) (iOS + Android).

## Build info

- Built: 2026-10-20 16:53:56 UTC
- Version: 1.0.0
- Source repo: transmitsecurity-dev/cordova-ts-authentication
- Source commit: 2e14e2a (release/1.0.0)

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
- Android Kotlin bridge + Maven dependency (`src/android/cordova-ts-authentication.gradle`, `com.ts.sdk:authentication`)
- Cordova hooks for Kotlin, Gradle wrapper pinning, and SPM-only iOS cleanup

Xcode resolves the native iOS SDK on first build (`File > Packages > Resolve Package Versions` if needed).
