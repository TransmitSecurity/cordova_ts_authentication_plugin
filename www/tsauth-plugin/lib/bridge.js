var exec = require('cordova/exec');
var logger = require('cordova-ts-authentication.tsauth-logger');
var errors = require('cordova-ts-authentication.tsauth-errors');

/**
 * Every native call funnels through here so rejections arrive in one shape:
 * `{ code, platformCode, message }` (see lib/errors.js).
 */
function call(method, args) {
    args = args || [];
    return new Promise(function (resolve, reject) {
        exec(resolve, function (error) {
            var decorated = errors.decorate(error);
            logger.error(method + ' failed: ' + decorated.code +
                (decorated.message ? ' — ' + decorated.message : ''));
            reject(decorated);
        }, 'TSAuthPlugin', method, args);
    });
}

module.exports = {
    call: call,

    // ---- lifecycle
    initializeSDK: function (configurationFile) {
        return call('initializeSDK', [{ configurationFile: configurationFile || null }]);
    },
    initialize: function (clientId, options) {
        return call('initialize', [{ clientId: clientId, options: options || null }]);
    },
    setLoggingEnabled: function (enabled) {
        logger.setEnabled(!!enabled);
        return call('setLoggingEnabled', [{ enabled: !!enabled }]);
    },

    // ---- WebAuthn / passkeys
    registerWebAuthn: function (username, displayName) {
        return call('registerWebAuthn', [{
            username: username,
            displayName: displayName || null,
        }]);
    },
    registerWebAuthnWithData: function (registrationData) {
        return call('registerWebAuthnWithData', [{ registrationData: registrationData }]);
    },
    authenticateWebAuthn: function (username, options) {
        return call('authenticateWebAuthn', [{
            username: username,
            options: options || null,
        }]);
    },
    authenticateWebAuthnWithData: function (authenticationData, options) {
        return call('authenticateWebAuthnWithData', [{
            authenticationData: authenticationData,
            options: options || null,
        }]);
    },
    signWebAuthnTransaction: function (username, options) {
        return call('signWebAuthnTransaction', [{
            username: username,
            options: options || null,
        }]);
    },
    signWebAuthnTransactionWithData: function (authenticationData, options) {
        return call('signWebAuthnTransactionWithData', [{
            authenticationData: authenticationData,
            options: options || null,
        }]);
    },
    approvalWebAuthn: function (approvalData, username, options) {
        return call('approvalWebAuthn', [{
            approvalData: approvalData || null,
            username: username || null,
            options: options || null,
        }]);
    },
    approvalWebAuthnWithData: function (authenticationData, options) {
        return call('approvalWebAuthnWithData', [{
            authenticationData: authenticationData,
            options: options || null,
        }]);
    },
    isWebAuthnSupported: function () {
        return call('isWebAuthnSupported');
    },

    // ---- native biometrics
    registerNativeBiometrics: function (username) {
        return call('registerNativeBiometrics', [{ username: username }]);
    },
    authenticateNativeBiometrics: function (username, challenge, promptTexts) {
        return call('authenticateNativeBiometrics', [{
            username: username,
            challenge: challenge,
            promptTexts: promptTexts || null,
        }]);
    },
    unregisterNativeBiometrics: function (username) {
        return call('unregisterNativeBiometrics', [{ username: username }]);
    },
    approvalNativeBiometrics: function (username, challenge, promptTexts) {
        return call('approvalNativeBiometrics', [{
            username: username,
            challenge: challenge,
            promptTexts: promptTexts || null,
        }]);
    },
    getNativeBiometricsStatus: function () {
        return call('getNativeBiometricsStatus');
    },

    // ---- PIN code
    registerPinCode: function (username, pinCode) {
        return call('registerPinCode', [{ username: username, pinCode: pinCode }]);
    },
    commitPinRegistration: function (contextIdentifier) {
        return call('commitPinRegistration', [{ contextIdentifier: contextIdentifier }]);
    },
    authenticatePinCode: function (username, pinCode, challenge) {
        return call('authenticatePinCode', [{
            username: username,
            pinCode: pinCode,
            challenge: challenge,
        }]);
    },
    unregisterPinCode: function (username) {
        return call('unregisterPinCode', [{ username: username }]);
    },
    commitPinUnregistration: function (contextIdentifier) {
        return call('commitPinUnregistration', [{ contextIdentifier: contextIdentifier }]);
    },

    // ---- TOTP
    registerTOTP: function (uri, securityType) {
        return call('registerTOTP', [{ uri: uri, securityType: securityType || null }]);
    },
    generateTOTPCode: function (uuid) {
        return call('generateTOTPCode', [{ uuid: uuid }]);
    },
    generateTOTPCodeWithChallenge: function (uuid, challenge) {
        return call('generateTOTPCodeWithChallenge', [{ uuid: uuid, challenge: challenge }]);
    },

    // ---- device
    getDeviceInfo: function () {
        return call('getDeviceInfo');
    },
    signWithDeviceKey: function (challenge) {
        return call('signWithDeviceKey', [{ challenge: challenge }]);
    },
};
