# Release notes

## 1.0.0

Initial release of the Transmit Security Authentication (A+) plugin for Cordova (iOS and Android), exposed as `cordova.tsauth`.

- **Initialization:** `initializeSDK()` from the platform configuration file, or `initialize(clientId, options)` programmatically, plus `setLoggingEnabled`.
- **Passkeys (WebAuthn):** register, authenticate, sign transactions and approve, each also available with server-provided data (`…WithData`). `isWebAuthnSupported` checks device support.
- **Native biometrics:** register, authenticate, approve and unregister; `getNativeBiometricsStatus` reports the current state.
- **PIN code:** register, authenticate and unregister with a two-phase commit (`commitPinRegistration`, `commitPinUnregistration`).
- **TOTP:** `registerTOTP`, `generateTOTPCode` and `generateTOTPCodeWithChallenge`.
- **Device key:** `getDeviceInfo` and `signWithDeviceKey`.
- **Errors:** normalized `code` values (`cordova.tsauth.ERRORS`), the same on both platforms, plus `isUserCanceled(error)`.
- **With Identity Orchestration:** completes the credential steps of [`cordova-plugin-identity-orchestration`](https://github.com/TransmitSecurity/cordova_ts_identity_orchestration_plugin) journeys.

**Native SDKs:** iOS `TSAuthenticationSDK` 1.2.2 (Swift Package Manager), Android `com.ts.sdk:authentication` 1.0.31.

**Requirements:** `cordova-ios` ≥ 8.0.0, `cordova-android` ≥ 12.0.0, iOS 13+, Android minSdk 24.
