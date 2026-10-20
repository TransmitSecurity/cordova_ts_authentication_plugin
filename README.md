# Cordova TS Authentication (A+) — User Guide

## Overview

`cordova-ts-authentication` brings Transmit Security Authentication to a Cordova app on **iOS and Android**:

- **Passkeys / WebAuthn** — register, authenticate, transaction signing, cross-device approval
- **Native biometrics** — Face ID / Touch ID / Android BiometricPrompt-backed key
- **PIN code** — device-bound PIN with a two-phase commit
- **TOTP** — register an authenticator and generate codes
- **Device key** — sign an arbitrary challenge

The plugin clobbers **`cordova.tsauth`**. Every method returns a Promise.

## Requirements

| | |
|---|---|
| Cordova | `cordova-ios` ≥ 8.0.0, `cordova-android` ≥ 12.0.0 (14.0.1+ recommended) |
| iOS | 13.0+, Xcode 16+ (SPM must reach GitHub) |
| Android | minSdk 24 (SDK floor is API 21), compileSdk 35 |

`cordova-android` 12 is a hard floor: the native biometric prompt needs a `FragmentActivity`, and that is the version where `CordovaActivity` became an `AppCompatActivity`. You do **not** need to modify your `MainActivity`.

## Native SDK versions

| Platform | Dependency | Version |
|----------|-----------|---------|
| iOS | [TransmitSecurity/authentication-ios-sdk](https://github.com/TransmitSecurity/authentication-ios-sdk) via SPM | `1.2.2` |
| Android | `com.ts.sdk:authentication` from the Transmit Maven repo | `1.0.31` |

Declared by the plugin — you do not add them yourself.

## Installation

```bash
cordova plugin add /path/to/cordova-ts-authentication
cordova platform add ios android
cordova prepare ios android
```

### iOS setup

Deployment target 13.0+:

```xml
<platform name="ios">
    <preference name="deployment-target" value="13.0" />
</platform>
```

**Passkeys require an Associated Domains entitlement.** The plugin cannot add this for you — it needs your relying-party domain:

```xml
<platform name="ios">
    <config-file target="*/Entitlements-Debug.plist" parent="com.apple.developer.associated-domains">
        <array><string>webcredentials:your-domain.com</string></array>
    </config-file>
    <config-file target="*/Entitlements-Release.plist" parent="com.apple.developer.associated-domains">
        <array><string>webcredentials:your-domain.com</string></array>
    </config-file>
</platform>
```

Your domain must also serve `/.well-known/apple-app-site-association` with a `webcredentials` entry for your app id. Without this, passkey registration fails with `invalidDomain`.

The plugin adds `NSFaceIDUsageDescription` with a generic string. Override it in your own `config.xml` if you want different wording.

### Android setup

```xml
<platform name="android">
    <preference name="android-minSdkVersion" value="24" />
</platform>
```

The plugin adds `INTERNET`, `ACCESS_NETWORK_STATE`, and `USE_BIOMETRIC`, plus the Transmit Maven repository and the SDK dependency.

**Passkeys require Digital Asset Links.** Serve `/.well-known/assetlinks.json` on your domain including your app's package name and signing-certificate SHA-256 fingerprint. Without it, registration fails with `invalidDomain`.

Two `after_prepare` hooks keep the build working — Kotlin compilation (cordova-android resets it off every prepare) and Gradle wrapper pinning. Both run automatically.

## Configuration

`initializeSDK()` reads credentials from a native config file; `initialize(clientId, options)` takes them in JavaScript. Use one or the other.

**iOS — `TransmitSecurity.plist`** (ship via `<resource-file>`):

```xml
<dict>
    <key>credentials</key>
    <dict>
        <key>baseUrl</key><string>https://api.transmitsecurity.io/</string>
        <key>clientId</key><string>YOUR_CLIENT_ID</string>
        <key>domain</key><string>your-domain.com</string>
    </dict>
</dict>
```

**Android — `strings.xml`**:

```xml
<resources>
    <string name="transmit_security_client_id">YOUR_CLIENT_ID</string>
    <string name="transmit_security_base_url">https://api.transmitsecurity.io/</string>
    <string name="transmit_security_domain">your-domain.com</string>
</resources>
```

The `configurationFile` argument is the **iOS plist basename only**; Android ignores it.

## Quick start

```js
document.addEventListener('deviceready', async function () {
    await cordova.tsauth.setLoggingEnabled(true);
    await cordova.tsauth.initializeSDK();          // or initialize(clientId, {...})

    if (await cordova.tsauth.isWebAuthnSupported()) {
        const { result } = await cordova.tsauth.registerWebAuthn('alice@example.com', 'Alice');
        // POST `result` to your backend to complete registration
    }
}, false);
```

Or initialize explicitly:

```js
await cordova.tsauth.initialize('YOUR_CLIENT_ID', {
    baseUrl: 'https://api.transmitsecurity.io/',
    domain: 'your-domain.com',
    // Only when passkey ceremonies go through your own backend:
    webAuthnApiPaths: {
        startRegistration: '/webauthn/register/start',
        startAuthentication: '/webauthn/authenticate/start',
    },
});
```

## API reference

All methods return a Promise. Rejections are always `{ code, platformCode, message }` — see [Error handling](#error-handling).

### Lifecycle

| Method | Resolves with |
|--------|--------------|
| `initializeSDK(configurationFile?)` | `true` |
| `initialize(clientId, options?)` | `true` |
| `setLoggingEnabled(enabled)` | `true` |

`options`: `baseUrl`, `domain`, `webAuthnApiPaths: { startRegistration, startAuthentication }`.

### Passkeys (WebAuthn)

| Method | Resolves with |
|--------|--------------|
| `isWebAuthnSupported()` | `boolean` |
| `registerWebAuthn(username, displayName?)` | `{ result }` |
| `registerWebAuthnWithData(registrationData)` | `{ result }` |
| `authenticateWebAuthn(username, options?)` | `{ result }` |
| `authenticateWebAuthnWithData(authenticationData, options?)` | `{ result }` |
| `signWebAuthnTransaction(username, options?)` | `{ result }` |
| `signWebAuthnTransactionWithData(authenticationData, options?)` | `{ result }` |
| `approvalWebAuthn(approvalData, username?, options?)` | `{ result }` |
| `approvalWebAuthnWithData(authenticationData, options?)` | `{ result }` |

`result` is the encoded credential — POST it to your backend, or hand it to an Identity Orchestration journey via `submitClientResponse`.

Pass `username: ''` to `authenticateWebAuthn` to let the platform offer any local passkey.

`options`: `{ preferLocalCredentials: true }` — iOS only, ignored on Android.

The `*WithData` variants take a server-provided WebAuthn payload (object or JSON string), for flows where your backend already called start-registration / start-authentication.

### Native biometrics

| Method | Resolves with |
|--------|--------------|
| `registerNativeBiometrics(username)` | `{ publicKeyId, publicKey, keyType, attestation, os }` |
| `authenticateNativeBiometrics(username, challenge, promptTexts?)` | `{ publicKeyId, signature }` |
| `approvalNativeBiometrics(username, challenge, promptTexts?)` | `{ publicKeyId, signature }` |
| `unregisterNativeBiometrics(username)` | `{ publicKeyId }` |
| `getNativeBiometricsStatus()` | `{ status, statusRaw, enrolled, type }` |

`promptTexts` is `{ title, subtitle, negativeButton }` — **Android only**; iOS uses the system prompt. The plugin supplies defaults.

`status` is one of `cordova.tsauth.BIOMETRICS_STATUS`: `available`, `notEnrolled`, `notAvailable`, `permissionDenied`, `lockedOut`, `unknown`. `type` is `faceID`/`touchID`/`opticID` on iOS, always `biometric` on Android.

Check status before offering biometrics:

```js
const bio = await cordova.tsauth.getNativeBiometricsStatus();
if (bio.status !== cordova.tsauth.BIOMETRICS_STATUS.AVAILABLE) {
    // fall back to PIN or passkey
}
```

### PIN code — note the two-phase commit

| Method | Resolves with |
|--------|--------------|
| `registerPinCode(username, pinCode)` | `{ publicKeyId, publicKey, keyType, aliasDeviceName, contextIdentifier }` |
| `commitPinRegistration(contextIdentifier)` | `true` |
| `authenticatePinCode(username, pinCode, challenge)` | `{ publicKeyId, signature, challenge }` |
| `unregisterPinCode(username)` | `{ publicKeyId, contextIdentifier }` |
| `commitPinUnregistration(contextIdentifier)` | `true` |

Registration is **not durable** until committed. Commit only after your backend has accepted the public key, so a failed upload does not leave a PIN the server does not know about:

```js
const reg = await cordova.tsauth.registerPinCode('alice', '1234');
await myBackend.storePublicKey(reg.publicKey, reg.publicKeyId);  // must succeed first
await cordova.tsauth.commitPinRegistration(reg.contextIdentifier);
```

The pending context is held **in memory**. If the app restarts between the two calls, the identifier is gone and `commitPinRegistration` rejects with `invalidArgs` — correct, since the registration never became durable. Just start over.

`unregisterPinCode` works the same way, with `commitPinUnregistration`.

### TOTP

| Method | Resolves with |
|--------|--------------|
| `registerTOTP(uri, securityType?)` | `{ issuer, label, uuid }` |
| `generateTOTPCode(uuid)` | `{ code }` |
| `generateTOTPCodeWithChallenge(uuid, challenge)` | `{ code }` |

`uri` is an `otpauth://` URI. `securityType` is one of `cordova.tsauth.TOTP_SECURITY_TYPE`: `none` (default), `biometric`, `devicePin`, `devicePinOrBiometric` — anything other than `none` prompts the user when generating a code.

Persist the returned `uuid`; it is how you generate codes later.

### Device

| Method | Resolves with |
|--------|--------------|
| `getDeviceInfo()` | `{ publicKeyId, publicKey, keyType }` (`keyType` Android-only) |
| `signWithDeviceKey(challenge)` | `{ signature }` |

## Error handling

Every rejection has the same shape:

```js
try {
    await cordova.tsauth.registerWebAuthn('alice');
} catch (e) {
    // e.code         stable across platforms  → branch on this
    // e.platformCode the SDK's own name       → log this
    // e.message      human-readable
}
```

Cancellation is the common case and usually should not surface as an error:

```js
catch (e) {
    if (cordova.tsauth.isUserCanceled(e)) return;   // user backed out
    showError(e.message);
    console.warn(e.code, e.platformCode);
}
```

### `cordova.tsauth.ERRORS`

`notInitialized`, `initializationError`, `unsupported`, `requestIsRunning`, `networkError`, `internalError`, `invalidArgs`, `userCanceled`, `notRegistered`, `userNotFound`, `noCredentials`, `invalidDomain`, `biometricsNotAvailable`, `biometricsNotEnrolled`, `biometricsLockedOut`, `permissionDenied`, `devicePinNotAvailable`, `incorrectURIFormat`, `duplicateCommitRegistration`

Android's SDK has a much finer-grained taxonomy than iOS (24 biometric error kinds vs 9). `code` is the normalized subset both platforms share; when a platform error has no mapping, `code` falls back to the raw `platformCode` rather than being flattened to `internalError` — so you never lose information, but you should branch on the documented codes above.

## Troubleshooting

| Symptom | Cause |
|---------|-------|
| `cordova.tsauth` is undefined | Called before `deviceready`, or `cordova prepare` not re-run |
| `notInitialized` | `initializeSDK` / `initialize` never resolved successfully |
| `invalidDomain` on passkeys | Associated Domains (iOS) or assetlinks.json (Android) not set up for your RP domain |
| `unsupported` on passkeys | OS too old, or no platform authenticator — gate on `isWebAuthnSupported()` |
| `biometricsNotEnrolled` | No fingerprint/face enrolled on the device |
| `invalidArgs` from `commitPinRegistration` | App restarted since `registerPinCode`, or already committed |
| Android: plugin not found at runtime | Kotlin compilation disabled — re-run `cordova prepare` |
| iOS: `no such module 'TSAuthenticationSDK'` | SPM not resolved — File → Packages → Resolve Package Versions, then Clean Build Folder |
| iOS simulator: keychain errors `-34018` | Build lacks keychain entitlements — build with a signing team selected |

## Using it with Identity Orchestration

The [IDO plugin](../cordova_ts_identity_orchestration) drives journeys but cannot produce credentials. When a journey reaches a passkey / biometrics / TOTP step, this plugin produces the credential and the result goes back via `submitClientResponse`:

```js
case cordova.tsido.STEPS.WEB_AUTHN_REGISTRATION: {
    const { result } = await cordova.tsauth.registerWebAuthn(response.data.username);
    await cordova.tsido.submitClientResponse('clientInput', { webauthn_encoded_result: result });
    break;
}
```

The IDO example app implements this for every credential-producing step — see `example/www/js/journey/auth-plus-steps.js` there.
