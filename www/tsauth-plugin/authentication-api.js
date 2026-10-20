/**
 * cordova.tsauth — Transmit Security Authentication (A+).
 *
 * Passkeys (WebAuthn), native biometrics, PIN code, TOTP, and device-key signing.
 *
 * Every method returns a Promise. Rejections are always
 * `{ code, platformCode, message }` — `code` is stable across platforms
 * (cordova.tsauth.ERRORS), `platformCode` is the SDK's own name. Because the two
 * SDKs have very different error taxonomies, branch on `code` and log
 * `platformCode`.
 */
var impl = require('cordova-ts-authentication.tsauth-bridge');
var errors = require('cordova-ts-authentication.tsauth-errors');

// ---------------------------------------------------------------- lifecycle

/**
 * Init from TransmitSecurity.plist (iOS) / string resources (Android).
 * @param {string} [configurationFile] plist basename, iOS only. Defaults to
 *   `TransmitSecurity`. Ignored on Android, which always reads string resources.
 */
function initializeSDK(configurationFile) {
    return impl.initializeSDK(configurationFile);
}

/**
 * Init with an explicit clientId instead of a configuration file.
 * @param {string} clientId
 * @param {Object} [options]
 * @param {string} [options.baseUrl] defaults to https://api.transmitsecurity.io/
 * @param {string} [options.domain] WebAuthn relying-party domain
 * @param {Object} [options.webAuthnApiPaths] `{ startRegistration, startAuthentication }`
 *   — only needed when passkey ceremonies go through your own backend
 */
function initialize(clientId, options) {
    return impl.initialize(clientId, options);
}

/** Toggles native + JS SDK logging. Off by default. */
function setLoggingEnabled(enabled) {
    return impl.setLoggingEnabled(enabled);
}

// -------------------------------------------------------- WebAuthn / passkeys

/**
 * Registers a passkey for `username`.
 * @returns {Promise<{result: string}>} `result` is the encoded credential to POST
 *   to your backend (or hand back to an Identity Orchestration journey).
 */
function registerWebAuthn(username, displayName) {
    return impl.registerWebAuthn(username, displayName);
}

/**
 * Registers a passkey from a server-provided WebAuthn registration payload,
 * for flows where your backend already called start-registration.
 * @param {Object|string} registrationData the raw JSON from the server
 */
function registerWebAuthnWithData(registrationData) {
    return impl.registerWebAuthnWithData(registrationData);
}

/**
 * Authenticates with a passkey.
 * @param {string} username pass '' to let the platform offer any local passkey
 * @param {Object} [options]
 * @param {boolean} [options.preferLocalCredentials] iOS only; ignored on Android
 */
function authenticateWebAuthn(username, options) {
    return impl.authenticateWebAuthn(username, options);
}

/** Authenticates from a server-provided WebAuthn authentication payload. */
function authenticateWebAuthnWithData(authenticationData, options) {
    return impl.authenticateWebAuthnWithData(authenticationData, options);
}

/** Signs a transaction with a passkey. */
function signWebAuthnTransaction(username, options) {
    return impl.signWebAuthnTransaction(username, options);
}

/** Signs a transaction from a server-provided WebAuthn authentication payload. */
function signWebAuthnTransactionWithData(authenticationData, options) {
    return impl.signWebAuthnTransactionWithData(authenticationData, options);
}

/**
 * Cross-device / out-of-band approval with a passkey.
 * @param {Object} approvalData string→string map describing what is approved
 * @param {string} [username]
 */
function approvalWebAuthn(approvalData, username, options) {
    return impl.approvalWebAuthn(approvalData, username, options);
}

/** Approval from a server-provided WebAuthn authentication payload. */
function approvalWebAuthnWithData(authenticationData, options) {
    return impl.approvalWebAuthnWithData(authenticationData, options);
}

/** Whether this device/OS can do passkeys at all. Check before offering them. */
function isWebAuthnSupported() {
    return impl.isWebAuthnSupported();
}

// ------------------------------------------------------------ native biometrics

/**
 * Enrolls the device biometric key for `username`.
 * @returns {Promise<{publicKeyId, publicKey, keyType, os, attestation}>}
 */
function registerNativeBiometrics(username) {
    return impl.registerNativeBiometrics(username);
}

/**
 * Signs `challenge` with the device biometric key, prompting the user.
 * @param {Object} [promptTexts] Android only — `{ title, subtitle, negativeButton }`.
 *   iOS uses the system Face ID / Touch ID prompt and ignores this.
 * @returns {Promise<{publicKeyId, signature}>}
 */
function authenticateNativeBiometrics(username, challenge, promptTexts) {
    return impl.authenticateNativeBiometrics(username, challenge, promptTexts);
}

/** Removes the device biometric key for `username`. */
function unregisterNativeBiometrics(username) {
    return impl.unregisterNativeBiometrics(username);
}

/** Same as authenticateNativeBiometrics, for out-of-band approval flows. */
function approvalNativeBiometrics(username, challenge, promptTexts) {
    return impl.approvalNativeBiometrics(username, challenge, promptTexts);
}

/**
 * Whether biometrics can be used right now.
 * @returns {Promise<{status: string, statusRaw: string, enrolled: boolean, type: string}>}
 *   `status` is one of BIOMETRICS_STATUS; `type` is faceID/touchID/opticID/
 *   biometric/none (iOS reports the exact sensor, Android only "biometric").
 */
function getNativeBiometricsStatus() {
    return impl.getNativeBiometricsStatus();
}

// -------------------------------------------------------------------- PIN code

/**
 * Registers a PIN code. The registration is **not durable** until you call
 * commitPinRegistration() with the returned contextIdentifier — commit only
 * after your backend has accepted the public key.
 * @returns {Promise<{publicKeyId, publicKey, keyType, aliasDeviceName, contextIdentifier}>}
 */
function registerPinCode(username, pinCode) {
    return impl.registerPinCode(username, pinCode);
}

/** Finalizes a registerPinCode() whose key your backend has accepted. */
function commitPinRegistration(contextIdentifier) {
    return impl.commitPinRegistration(contextIdentifier);
}

/** @returns {Promise<{publicKeyId, signature, challenge}>} */
function authenticatePinCode(username, pinCode, challenge) {
    return impl.authenticatePinCode(username, pinCode, challenge);
}

/**
 * Removes the PIN code registration. Like registration, this needs a matching
 * commitPinUnregistration() to become durable.
 * @returns {Promise<{publicKeyId, contextIdentifier}>}
 */
function unregisterPinCode(username) {
    return impl.unregisterPinCode(username);
}

/** Finalizes an unregisterPinCode(). */
function commitPinUnregistration(contextIdentifier) {
    return impl.commitPinUnregistration(contextIdentifier);
}

// ------------------------------------------------------------------------ TOTP

/**
 * Registers a TOTP authenticator from an otpauth:// URI.
 * @param {string} uri
 * @param {string} [securityType] one of TOTP_SECURITY_TYPE; defaults to `none`
 * @returns {Promise<{issuer, label, uuid}>} keep `uuid` to generate codes later
 */
function registerTOTP(uri, securityType) {
    return impl.registerTOTP(uri, securityType);
}

/** @returns {Promise<{code: string}>} */
function generateTOTPCode(uuid) {
    return impl.generateTOTPCode(uuid);
}

/** Generates a code bound to `challenge`, for transaction signing. */
function generateTOTPCodeWithChallenge(uuid, challenge) {
    return impl.generateTOTPCodeWithChallenge(uuid, challenge);
}

// ---------------------------------------------------------------------- device

/** @returns {Promise<{publicKeyId, publicKey, keyType}>} keyType is Android-only. */
function getDeviceInfo() {
    return impl.getDeviceInfo();
}

/** @returns {Promise<{signature: string}>} */
function signWithDeviceKey(challenge) {
    return impl.signWithDeviceKey(challenge);
}

module.exports = {
    // lifecycle
    initializeSDK: initializeSDK,
    initialize: initialize,
    setLoggingEnabled: setLoggingEnabled,

    // WebAuthn / passkeys
    registerWebAuthn: registerWebAuthn,
    registerWebAuthnWithData: registerWebAuthnWithData,
    authenticateWebAuthn: authenticateWebAuthn,
    authenticateWebAuthnWithData: authenticateWebAuthnWithData,
    signWebAuthnTransaction: signWebAuthnTransaction,
    signWebAuthnTransactionWithData: signWebAuthnTransactionWithData,
    approvalWebAuthn: approvalWebAuthn,
    approvalWebAuthnWithData: approvalWebAuthnWithData,
    isWebAuthnSupported: isWebAuthnSupported,

    // native biometrics
    registerNativeBiometrics: registerNativeBiometrics,
    authenticateNativeBiometrics: authenticateNativeBiometrics,
    unregisterNativeBiometrics: unregisterNativeBiometrics,
    approvalNativeBiometrics: approvalNativeBiometrics,
    getNativeBiometricsStatus: getNativeBiometricsStatus,

    // PIN code
    registerPinCode: registerPinCode,
    commitPinRegistration: commitPinRegistration,
    authenticatePinCode: authenticatePinCode,
    unregisterPinCode: unregisterPinCode,
    commitPinUnregistration: commitPinUnregistration,

    // TOTP
    registerTOTP: registerTOTP,
    generateTOTPCode: generateTOTPCode,
    generateTOTPCodeWithChallenge: generateTOTPCodeWithChallenge,

    // device
    getDeviceInfo: getDeviceInfo,
    signWithDeviceKey: signWithDeviceKey,

    /** Stable cross-platform error codes (see the `code` on every rejection). */
    ERRORS: errors.CODES,
    /** True when a rejection was the user backing out of a prompt. */
    isUserCanceled: errors.isUserCanceled,

    /** Values accepted by registerTOTP(uri, securityType). */
    TOTP_SECURITY_TYPE: {
        NONE: 'none',
        BIOMETRIC: 'biometric',
        DEVICE_PIN: 'devicePin',
        DEVICE_PIN_OR_BIOMETRIC: 'devicePinOrBiometric',
    },

    /** Values of `status` from getNativeBiometricsStatus(). */
    BIOMETRICS_STATUS: {
        AVAILABLE: 'available',
        NOT_ENROLLED: 'notEnrolled',
        NOT_AVAILABLE: 'notAvailable',
        PERMISSION_DENIED: 'permissionDenied',
        LOCKED_OUT: 'lockedOut',
        UNKNOWN: 'unknown',
    },
};
