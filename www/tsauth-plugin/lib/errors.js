// Cross-platform error code normalization.
//
// The two SDKs model failures very differently:
//
//   iOS      nested Swift enums — TSAuthenticationError.webAuthnError(.canceled),
//            .nativeBiometricsError(.nativeBiometricsNotEnrolled), .totpError(...),
//            .pinCodeError(...)
//   Android  a sealed class per domain, each with its own subclass list —
//            TSWebAuthnAuthenticationError.UserCancelled, TSBiometricsAuthError.
//            BiometricErrorNonEnrolled, TSTOTPError.IncorrectURIFormat, …
//
// Android's taxonomy is much finer-grained (24 biometric cases vs 9 on iOS), so
// collapsing both onto one enum would throw away detail. Instead the native
// bridges report the platform's own name in `platformCode`, and this module maps
// the subset apps actually branch on onto a stable `code`.
//
// An unmapped platform code is passed through unchanged, so nothing is lost.

/** Stable, cross-platform error codes. */
var CODES = {
    // lifecycle
    NOT_INITIALIZED: 'notInitialized',
    INITIALIZATION_ERROR: 'initializationError',
    UNSUPPORTED: 'unsupported',
    REQUEST_IS_RUNNING: 'requestIsRunning',
    NETWORK_ERROR: 'networkError',
    INTERNAL_ERROR: 'internalError',
    INVALID_ARGS: 'invalidArgs',

    // user-driven
    USER_CANCELED: 'userCanceled',

    // credential state
    NOT_REGISTERED: 'notRegistered',
    USER_NOT_FOUND: 'userNotFound',
    NO_CREDENTIALS: 'noCredentials',
    INVALID_DOMAIN: 'invalidDomain',

    // biometrics
    BIOMETRICS_NOT_AVAILABLE: 'biometricsNotAvailable',
    BIOMETRICS_NOT_ENROLLED: 'biometricsNotEnrolled',
    BIOMETRICS_LOCKED_OUT: 'biometricsLockedOut',
    PERMISSION_DENIED: 'permissionDenied',

    // device credential (TOTP security types)
    DEVICE_PIN_NOT_AVAILABLE: 'devicePinNotAvailable',

    // TOTP / PIN specifics
    INCORRECT_URI_FORMAT: 'incorrectURIFormat',
    DUPLICATE_COMMIT: 'duplicateCommitRegistration',
};

// Keys are lower-cased platform codes with separators stripped, so the same
// entry matches iOS `nativeBiometricsNotEnrolled`, Android
// `BiometricErrorNonEnrolled`, and `NOT_REGISTERED`.
var PLATFORM_TO_CODE = {
    // ---- lifecycle
    notinitialized: CODES.NOT_INITIALIZED,
    sdknotinitialized: CODES.NOT_INITIALIZED,
    initializationerror: CODES.INITIALIZATION_ERROR,
    unsupported: CODES.UNSUPPORTED,
    unsupportedosversion: CODES.UNSUPPORTED,
    apinotsupported: CODES.UNSUPPORTED,
    credentialunsupported: CODES.UNSUPPORTED,
    customcredentialsnotsupported: CODES.UNSUPPORTED,
    passwordcredentialsnotsupported: CODES.UNSUPPORTED,
    unexpectedtypeofcredential: CODES.UNSUPPORTED,
    biometricerrorunsupported: CODES.UNSUPPORTED,
    requestisrunning: CODES.REQUEST_IS_RUNNING,
    networkerror: CODES.NETWORK_ERROR,
    internal: CODES.INTERNAL_ERROR,
    internalerror: CODES.INTERNAL_ERROR,
    unknown: CODES.INTERNAL_ERROR,
    other: CODES.INTERNAL_ERROR,
    generalpasskeyerror: CODES.INTERNAL_ERROR,
    providerconfigurationerror: CODES.INTERNAL_ERROR,
    clientnotfound: CODES.INTERNAL_ERROR,
    requestcannotbevalidated: CODES.INTERNAL_ERROR,
    failed: CODES.INTERNAL_ERROR,
    failure: CODES.INTERNAL_ERROR,
    nothandled: CODES.INTERNAL_ERROR,
    notinteractive: CODES.INTERNAL_ERROR,
    invalidresponse: CODES.INTERNAL_ERROR,
    generatekeyfailed: CODES.INTERNAL_ERROR,
    loadkeyfailed: CODES.INTERNAL_ERROR,
    unabletoprocess: CODES.INTERNAL_ERROR,
    nospace: CODES.INTERNAL_ERROR,
    biometricerrorstatusunknown: CODES.INTERNAL_ERROR,
    invalidargs: CODES.INVALID_ARGS,

    // ---- user cancellation (iOS splits canceled/userCanceled; Android adds
    // NegativeButton for "tapped the prompt's cancel button")
    canceled: CODES.USER_CANCELED,
    cancelled: CODES.USER_CANCELED,
    usercanceled: CODES.USER_CANCELED,
    usercancelled: CODES.USER_CANCELED,
    negativebutton: CODES.USER_CANCELED,
    createcredentialsinterrupted: CODES.USER_CANCELED,
    interruptederror: CODES.USER_CANCELED,
    timeout: CODES.USER_CANCELED,

    // ---- credential state
    notregistered: CODES.NOT_REGISTERED,
    invalidwebauthnsession: CODES.NOT_REGISTERED,
    usernotfound: CODES.USER_NOT_FOUND,
    useridmismatch: CODES.USER_NOT_FOUND,
    registrationusernamemismatch: CODES.USER_NOT_FOUND,
    nocredentials: CODES.NO_CREDENTIALS,
    noregisteredcredentials: CODES.NO_CREDENTIALS,
    invaliddomain: CODES.INVALID_DOMAIN,

    // ---- biometrics
    nativebiometricsnotavailable: CODES.BIOMETRICS_NOT_AVAILABLE,
    biometricerrorhwunavailable: CODES.BIOMETRICS_NOT_AVAILABLE,
    biometricerrornohardware: CODES.BIOMETRICS_NOT_AVAILABLE,
    biometricerrorsecurityupdaterequired: CODES.BIOMETRICS_NOT_AVAILABLE,
    nativebiometricsnotenrolled: CODES.BIOMETRICS_NOT_ENROLLED,
    biometricerrornonenrolled: CODES.BIOMETRICS_NOT_ENROLLED,
    lockedout: CODES.BIOMETRICS_LOCKED_OUT,
    lockout: CODES.BIOMETRICS_LOCKED_OUT,
    lockoutpermanent: CODES.BIOMETRICS_LOCKED_OUT,
    permissiondenied: CODES.PERMISSION_DENIED,
    // `NoMatch` (face/finger not recognized) is deliberately unmapped: it is not
    // `biometricsNotEnrolled`, so the platform code passes through as `code`.

    // ---- device credential
    devicepinnotavailable: CODES.DEVICE_PIN_NOT_AVAILABLE,
    devicepinorbiometricnotavailable: CODES.DEVICE_PIN_NOT_AVAILABLE,

    // ---- TOTP / PIN specifics
    incorrecturiformat: CODES.INCORRECT_URI_FORMAT,
    invalidsecret: CODES.INCORRECT_URI_FORMAT,
    invalidalgorithm: CODES.INCORRECT_URI_FORMAT,
    invalidperiod: CODES.INCORRECT_URI_FORMAT,
    invaliddigits: CODES.INCORRECT_URI_FORMAT,
    duplicatecommitregistration: CODES.DUPLICATE_COMMIT,

    // Android-only: the SDK needs a FragmentActivity for biometric-protected
    // TOTP. cordova-android 12+ satisfies this; older majors do not.
    biometricssecuritycontextshouldbefragmentactivityorappcompatactivity:
        CODES.BIOMETRICS_NOT_AVAILABLE,
};

function key(platformCode) {
    return String(platformCode).replace(/[_\s.-]/g, '').toLowerCase();
}

/**
 * @param {string} platformCode the SDK's own error name
 * @returns {string|null} a CODES value, or platformCode when unrecognized
 */
function normalize(platformCode) {
    if (typeof platformCode !== 'string' || platformCode === '') return null;
    return PLATFORM_TO_CODE[key(platformCode)] || platformCode;
}

/**
 * Rewrites a native rejection into the shape the public API promises:
 * `{ code, platformCode, message }`.
 */
function decorate(error) {
    if (!error || typeof error !== 'object') {
        return { code: CODES.INTERNAL_ERROR, platformCode: null, message: String(error) };
    }
    var platformCode = error.platformCode || error.code || null;
    return {
        code: normalize(platformCode) || CODES.INTERNAL_ERROR,
        platformCode: platformCode,
        message: error.message || '',
    };
}

/** True when the failure was the user backing out — usually not worth surfacing. */
function isUserCanceled(error) {
    return !!error && error.code === CODES.USER_CANCELED;
}

module.exports = {
    CODES: CODES,
    normalize: normalize,
    decorate: decorate,
    isUserCanceled: isUserCanceled,
};
