// Lightweight JS-side logger for the Authentication plugin.
//
// Disabled by default — mirrors the native SDK, which starts with logging off.
// Toggled through setLoggingEnabled(enabled): see lib/bridge.js, which calls
// setEnabled() so the JS and native log levels move together.
//
// Everything goes through a single-string console.log: WKWebView (Cordova iOS)
// only bridges console.log to the native/Xcode log (console.debug/info are
// dropped), and only reliably forwards a single string argument.

var TAG = 'TSAuth';

var _enabled = false;

function setEnabled(enabled) {
    _enabled = enabled === true;
}

function isEnabled() {
    return _enabled;
}

function log(message) {
    if (!_enabled) return;
    console.log(TAG + ': ' + message);
}

module.exports = {
    setEnabled: setEnabled,
    isEnabled: isEnabled,
    debug: log,
    info: log,
    warn: log,
    error: log,
};
