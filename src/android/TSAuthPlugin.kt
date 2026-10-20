package com.transmitsecurity.tsauth

import android.content.Context
import android.util.Base64
import androidx.fragment.app.FragmentActivity
import com.transmit.authentication.AuthenticationResult
import com.transmit.authentication.DeviceInfo
import com.transmit.authentication.RegistrationResult
import com.transmit.authentication.TSAuthCallback
import com.transmit.authentication.TSAuthentication
import com.transmit.authentication.TSAuthenticationInitOptions
import com.transmit.authentication.TSSignResult
import com.transmit.authentication.TSWebAuthnApiPaths
import com.transmit.authentication.TSWebAuthnApprovalResult
import com.transmit.authentication.biometrics.BiometricPromptTexts
import com.transmit.authentication.biometrics.TSBiometricsAuthResult
import com.transmit.authentication.biometrics.TSBiometricsRegistrationResult
import com.transmit.authentication.biometrics.TSBiometricsUnregistrationResult
import com.transmit.authentication.biometrics.TSNativeBiometricsApprovalResult
import com.transmit.authentication.biometrics.TSNativeBiometricsStatus
import com.transmit.authentication.crpto.totp.ITSRegisterTOTPCallback
import com.transmit.authentication.crpto.totp.ITSTOTPGenerateTOTPCallback
import com.transmit.authentication.crpto.totp.TSTOTPError
import com.transmit.authentication.crpto.totp.TSTOTPRegistrationResult
import com.transmit.authentication.crpto.totp.TSTOTPSecurityType
import com.transmit.authentication.network.startauth.TSWebAuthnAuthenticationData
import com.transmit.authentication.pincode.TSPinCodeAuthenticationResult
import com.transmit.authentication.pincode.TSPinCodeRegistrationContext
import com.transmit.authentication.pincode.TSPinCodeRegistrationResult
import com.transmit.authentication.pincode.TSPinCodeUnregistrationContext
import com.transmit.authentication.pincode.TSPinCodeUnregistrationResult
import com.transmit.authentication.webauthn.TSWebAuthnRegistrationData
import org.apache.cordova.CallbackContext
import org.apache.cordova.CordovaPlugin
import org.apache.cordova.PluginResult
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

class TSAuthPlugin : CordovaPlugin() {

    companion object {
        private const val DEFAULT_BASE_URL = "https://api.transmitsecurity.io/"
        private const val DEFAULT_PROMPT_TITLE = "Authenticate"
        private const val DEFAULT_PROMPT_SUBTITLE = "Confirm your identity to continue"
        private const val DEFAULT_PROMPT_NEGATIVE = "Cancel"
    }

    /**
     * PIN registration/unregistration is a two-phase commit: the SDK returns a
     * context that must be retained until the app confirms its backend accepted
     * the key. JS cannot hold a Kotlin object, so contexts are parked here under
     * an opaque identifier that crosses the bridge instead.
     */
    private val pinRegistrationContexts = ConcurrentHashMap<String, TSPinCodeRegistrationContext>()
    private val pinUnregistrationContexts =
        ConcurrentHashMap<String, TSPinCodeUnregistrationContext>()

    private val appContext: Context
        get() = cordova.activity.applicationContext

    /**
     * The biometric prompt needs a FragmentActivity. cordova-android 12+ has
     * CordovaActivity extend AppCompatActivity (itself a FragmentActivity), so
     * this is a plain upcast — see the engine constraint in plugin.xml.
     */
    private val fragmentActivity: FragmentActivity
        get() = cordova.activity

    override fun onDestroy() {
        pinRegistrationContexts.clear()
        pinUnregistrationContexts.clear()
        super.onDestroy()
    }

    override fun execute(action: String, args: JSONArray, callback: CallbackContext): Boolean {
        when (action) {
            // lifecycle
            "initializeSDK"                   -> initializeSDK(callback)
            "initialize"                      -> initialize(args, callback)
            "setLoggingEnabled"               -> setLoggingEnabled(args, callback)
            // webauthn
            "registerWebAuthn"                -> registerWebAuthn(args, callback)
            "registerWebAuthnWithData"        -> registerWebAuthnWithData(args, callback)
            "authenticateWebAuthn"            -> authenticateWebAuthn(args, callback)
            "authenticateWebAuthnWithData"    -> authenticateWebAuthnWithData(args, callback)
            "signWebAuthnTransaction"         -> signWebAuthnTransaction(args, callback)
            "signWebAuthnTransactionWithData" -> signWebAuthnTransactionWithData(args, callback)
            "approvalWebAuthn"                -> approvalWebAuthn(args, callback)
            "approvalWebAuthnWithData"        -> approvalWebAuthnWithData(args, callback)
            "isWebAuthnSupported"             -> isWebAuthnSupported(callback)
            // native biometrics
            "registerNativeBiometrics"        -> registerNativeBiometrics(args, callback)
            "authenticateNativeBiometrics"    -> authenticateNativeBiometrics(args, callback)
            "unregisterNativeBiometrics"      -> unregisterNativeBiometrics(args, callback)
            "approvalNativeBiometrics"        -> approvalNativeBiometrics(args, callback)
            "getNativeBiometricsStatus"       -> getNativeBiometricsStatus(callback)
            // pin code
            "registerPinCode"                 -> registerPinCode(args, callback)
            "commitPinRegistration"           -> commitPinRegistration(args, callback)
            "authenticatePinCode"             -> authenticatePinCode(args, callback)
            "unregisterPinCode"               -> unregisterPinCode(args, callback)
            "commitPinUnregistration"         -> commitPinUnregistration(args, callback)
            // totp
            "registerTOTP"                    -> registerTOTP(args, callback)
            "generateTOTPCode"                -> generateTOTPCode(args, callback)
            "generateTOTPCodeWithChallenge"   -> generateTOTPCodeWithChallenge(args, callback)
            // device
            "getDeviceInfo"                   -> getDeviceInfo(callback)
            "signWithDeviceKey"               -> signWithDeviceKey(args, callback)
            else                              -> return false
        }
        return true
    }

    // region Lifecycle

    private fun initializeSDK(callback: CallbackContext) {
        // The JS `configurationFile` argument is iOS-only (plist name); Android
        // always reads the transmit_security_* string resources.
        cordova.activity.runOnUiThread {
            try {
                TSAuthentication.initializeSDK(appContext)
                callback.ok()
            } catch (e: Exception) {
                callback.fail("initializationError", e.message ?: e.toString())
            }
        }
    }

    private fun initialize(args: JSONArray, callback: CallbackContext) {
        val opts = args.optJSONObject(0) ?: return callback.missingArgs()
        val clientId = opts.stringOrNull("clientId")
            ?: return callback.fail("invalidArgs", "clientId is required")

        val options = opts.optJSONObject("options")
        val baseUrl = options?.stringOrNull("baseUrl") ?: DEFAULT_BASE_URL
        val domain = options?.stringOrNull("domain")

        val paths = options?.optJSONObject("webAuthnApiPaths")
        val startRegistration = paths?.stringOrNull("startRegistration")
        val startAuthentication = paths?.stringOrNull("startAuthentication")
        val initOptions = if (startRegistration != null && startAuthentication != null) {
            TSAuthenticationInitOptions(
                TSWebAuthnApiPaths(startRegistration, startAuthentication)
            )
        } else {
            null
        }

        cordova.activity.runOnUiThread {
            try {
                TSAuthentication.initialize(appContext, clientId, baseUrl, domain, initOptions)
                callback.ok()
            } catch (e: Exception) {
                callback.fail("initializationError", e.message ?: e.toString())
            }
        }
    }

    private fun setLoggingEnabled(args: JSONArray, callback: CallbackContext) {
        val opts = args.optJSONObject(0)
        if (opts == null || !opts.has("enabled")) {
            return callback.fail("invalidArgs", "enabled must be true or false")
        }
        TSAuthentication.setLoggingEnabled(opts.optBoolean("enabled", false))
        callback.ok()
    }

    // endregion

    // region WebAuthn / passkeys

    private fun registerWebAuthn(args: JSONArray, callback: CallbackContext) {
        val opts = args.optJSONObject(0) ?: return callback.missingArgs()
        val username = opts.stringOrNull("username")
            ?: return callback.fail("invalidArgs", "username is required")
        val displayName = opts.stringOrNull("displayName") ?: username

        cordova.activity.runOnUiThread {
            TSAuthentication.registerWebAuthn(
                appContext, username, displayName,
                authCallback(callback) { r: RegistrationResult ->
                    JSONObject().put("result", r.result())
                }
            )
        }
    }

    private fun registerWebAuthnWithData(args: JSONArray, callback: CallbackContext) {
        val opts = args.optJSONObject(0) ?: return callback.missingArgs()
        val json = opts.jsonStringOrNull("registrationData")
            ?: return callback.fail("invalidArgs", "registrationData is required")

        cordova.activity.runOnUiThread {
            // createFromJsonString returns null (rather than throwing) on
            // malformed input, so a try/catch alone is not enough.
            val data = try {
                TSWebAuthnRegistrationData.createFromJsonString(json)
            } catch (e: Exception) {
                null
            } ?: return@runOnUiThread callback.fail(
                "invalidArgs", "Malformed registrationData"
            )
            TSAuthentication.registerWebAuthn(
                appContext, data,
                authCallback(callback) { r: RegistrationResult ->
                    JSONObject().put("result", r.result())
                }
            )
        }
    }

    private fun authenticateWebAuthn(args: JSONArray, callback: CallbackContext) {
        val opts = args.optJSONObject(0) ?: return callback.missingArgs()
        // An empty username is valid: it lets the platform offer any local passkey.
        val username = opts.optString("username", "")

        cordova.activity.runOnUiThread {
            TSAuthentication.authenticateWebAuthn(
                appContext, username,
                authCallback(callback) { r: AuthenticationResult ->
                    JSONObject().put("result", r.result())
                }
            )
        }
    }

    private fun authenticateWebAuthnWithData(args: JSONArray, callback: CallbackContext) {
        withAuthenticationData(args, callback) { data ->
            TSAuthentication.authenticateWebAuthn(
                appContext, data,
                authCallback(callback) { r: AuthenticationResult ->
                    JSONObject().put("result", r.result())
                }
            )
        }
    }

    private fun signWebAuthnTransaction(args: JSONArray, callback: CallbackContext) {
        val opts = args.optJSONObject(0) ?: return callback.missingArgs()
        val username = opts.stringOrNull("username")
            ?: return callback.fail("invalidArgs", "username is required")

        cordova.activity.runOnUiThread {
            TSAuthentication.signTransactionWebAuthn(
                appContext, username,
                authCallback(callback) { r: AuthenticationResult ->
                    JSONObject().put("result", r.result())
                }
            )
        }
    }

    private fun signWebAuthnTransactionWithData(args: JSONArray, callback: CallbackContext) {
        withAuthenticationData(args, callback) { data ->
            TSAuthentication.signTransactionWebAuthn(
                appContext, data,
                authCallback(callback) { r: AuthenticationResult ->
                    JSONObject().put("result", r.result())
                }
            )
        }
    }

    private fun approvalWebAuthn(args: JSONArray, callback: CallbackContext) {
        val opts = args.optJSONObject(0) ?: return callback.missingArgs()
        val approvalData = opts.optJSONObject("approvalData")?.toStringValueMap().orEmpty()
        if (approvalData.isEmpty()) {
            return callback.fail("invalidArgs", "approvalData is required")
        }
        val username = opts.stringOrNull("username") ?: ""

        cordova.activity.runOnUiThread {
            TSAuthentication.approvalWebAuthn(
                appContext, username, approvalData,
                authCallback(callback) { r: TSWebAuthnApprovalResult ->
                    JSONObject().put("result", r.result())
                }
            )
        }
    }

    private fun approvalWebAuthnWithData(args: JSONArray, callback: CallbackContext) {
        withAuthenticationData(args, callback) { data ->
            TSAuthentication.approvalWebAuthn(
                appContext, data,
                authCallback(callback) { r: TSWebAuthnApprovalResult ->
                    JSONObject().put("result", r.result())
                }
            )
        }
    }

    private fun isWebAuthnSupported(callback: CallbackContext) {
        callback.ok(TSAuthentication.isWebAuthnSupported())
    }

    // endregion

    // region Native biometrics

    private fun registerNativeBiometrics(args: JSONArray, callback: CallbackContext) {
        val username = args.optJSONObject(0)?.stringOrNull("username")
            ?: return callback.fail("invalidArgs", "username is required")

        cordova.activity.runOnUiThread {
            TSAuthentication.registerNativeBiometrics(
                appContext, username,
                authCallback(callback) { r: TSBiometricsRegistrationResult ->
                    JSONObject().apply {
                        put("publicKeyId", r.keyId())
                        put("publicKey", r.publicKey())
                        put("keyType", r.keyType())
                        // iOS reports attestation as a string; base64 keeps the
                        // JS-facing type identical across platforms.
                        put("attestation", r.attestationData()?.let {
                            Base64.encodeToString(it, Base64.NO_WRAP)
                        } ?: JSONObject.NULL)
                        put("os", "android")
                    }
                }
            )
        }
    }

    private fun authenticateNativeBiometrics(args: JSONArray, callback: CallbackContext) {
        val opts = args.optJSONObject(0) ?: return callback.missingArgs()
        val username = opts.stringOrNull("username")
            ?: return callback.fail("invalidArgs", "username is required")
        val challenge = opts.stringOrNull("challenge")
            ?: return callback.fail("invalidArgs", "challenge is required")

        cordova.activity.runOnUiThread {
            TSAuthentication.authenticateNativeBiometrics(
                fragmentActivity, username, challenge, promptTexts(opts.optJSONObject("promptTexts")),
                authCallback(callback) { r: TSBiometricsAuthResult ->
                    JSONObject().put("publicKeyId", r.keyId()).put("signature", r.signature())
                }
            )
        }
    }

    private fun approvalNativeBiometrics(args: JSONArray, callback: CallbackContext) {
        val opts = args.optJSONObject(0) ?: return callback.missingArgs()
        val username = opts.stringOrNull("username")
            ?: return callback.fail("invalidArgs", "username is required")
        val challenge = opts.stringOrNull("challenge")
            ?: return callback.fail("invalidArgs", "challenge is required")

        cordova.activity.runOnUiThread {
            TSAuthentication.approvalNativeBiometrics(
                fragmentActivity, username, challenge, promptTexts(opts.optJSONObject("promptTexts")),
                authCallback(callback) { r: TSNativeBiometricsApprovalResult ->
                    JSONObject().put("publicKeyId", r.keyId()).put("signature", r.signature())
                }
            )
        }
    }

    private fun unregisterNativeBiometrics(args: JSONArray, callback: CallbackContext) {
        val username = args.optJSONObject(0)?.stringOrNull("username")
            ?: return callback.fail("invalidArgs", "username is required")

        cordova.activity.runOnUiThread {
            TSAuthentication.unregisterNativeBiometrics(
                appContext, username,
                authCallback(callback) { r: TSBiometricsUnregistrationResult ->
                    JSONObject().put("publicKeyId", r.keyId())
                }
            )
        }
    }

    private fun getNativeBiometricsStatus(callback: CallbackContext) {
        cordova.activity.runOnUiThread {
            val status = TSAuthentication.getNativeBiometricsStatus(appContext)
            val normalized = when (status) {
                TSNativeBiometricsStatus.CanAuthenticate -> "available"
                TSNativeBiometricsStatus.NonEnrolled -> "notEnrolled"
                TSNativeBiometricsStatus.NoHarddware,
                TSNativeBiometricsStatus.HardwareNotAvailable,
                TSNativeBiometricsStatus.SecurityUpdateRequired,
                TSNativeBiometricsStatus.Unsupported -> "notAvailable"
                else -> "unknown"
            }
            callback.success(JSONObject().apply {
                put("status", normalized)
                put("statusRaw", status.name)
                put("enrolled", status == TSNativeBiometricsStatus.CanAuthenticate)
                // Android's BiometricManager does not expose which sensor is used.
                put("type", if (normalized == "available") "biometric" else "none")
            })
        }
    }

    // endregion

    // region PIN code

    private fun registerPinCode(args: JSONArray, callback: CallbackContext) {
        val opts = args.optJSONObject(0) ?: return callback.missingArgs()
        val username = opts.stringOrNull("username")
            ?: return callback.fail("invalidArgs", "username is required")
        val pinCode = opts.stringOrNull("pinCode")
            ?: return callback.fail("invalidArgs", "pinCode is required")

        cordova.activity.runOnUiThread {
            TSAuthentication.registerPinCode(
                username, pinCode,
                authCallback(callback) { r: TSPinCodeRegistrationResult ->
                    val identifier = UUID.randomUUID().toString()
                    pinRegistrationContexts[identifier] = r.registrationContext()
                    JSONObject().apply {
                        put("publicKeyId", r.keyId())
                        put("publicKey", r.publicKey())
                        put("keyType", r.keyType())
                        put("aliasDeviceName", r.aliasDeviceName())
                        put("contextIdentifier", identifier)
                    }
                }
            )
        }
    }

    private fun commitPinRegistration(args: JSONArray, callback: CallbackContext) {
        val identifier = args.optJSONObject(0)?.stringOrNull("contextIdentifier")
            ?: return callback.fail("invalidArgs", "contextIdentifier is required")
        // Looked up on the UI thread, as iOS does on main, so concurrent commits
        // for one context are serialized; removed only after commit() succeeds,
        // so a failed commit can be retried.
        cordova.activity.runOnUiThread {
            val context = pinRegistrationContexts[identifier]
            if (context == null) {
                callback.fail(
                    "invalidArgs",
                    "Unknown contextIdentifier — already committed, or the app restarted"
                )
                return@runOnUiThread
            }
            try {
                context.commit()
                pinRegistrationContexts.remove(identifier)
                callback.ok()
            } catch (e: Exception) {
                callback.fail("internalError", e.message ?: e.toString())
            }
        }
    }

    private fun authenticatePinCode(args: JSONArray, callback: CallbackContext) {
        val opts = args.optJSONObject(0) ?: return callback.missingArgs()
        val username = opts.stringOrNull("username")
            ?: return callback.fail("invalidArgs", "username is required")
        val pinCode = opts.stringOrNull("pinCode")
            ?: return callback.fail("invalidArgs", "pinCode is required")
        val challenge = opts.stringOrNull("challenge")
            ?: return callback.fail("invalidArgs", "challenge is required")

        cordova.activity.runOnUiThread {
            TSAuthentication.authenticatePinCode(
                username, pinCode, challenge,
                authCallback(callback) { r: TSPinCodeAuthenticationResult ->
                    JSONObject().apply {
                        put("publicKeyId", r.keyId())
                        put("signature", r.signature())
                        put("challenge", r.challenge())
                    }
                }
            )
        }
    }

    private fun unregisterPinCode(args: JSONArray, callback: CallbackContext) {
        val username = args.optJSONObject(0)?.stringOrNull("username")
            ?: return callback.fail("invalidArgs", "username is required")

        cordova.activity.runOnUiThread {
            TSAuthentication.unregisterPinCode(
                username,
                authCallback(callback) { r: TSPinCodeUnregistrationResult ->
                    val identifier = UUID.randomUUID().toString()
                    pinUnregistrationContexts[identifier] = r.unregistrationContext()
                    JSONObject()
                        .put("publicKeyId", r.keyId())
                        .put("contextIdentifier", identifier)
                }
            )
        }
    }

    private fun commitPinUnregistration(args: JSONArray, callback: CallbackContext) {
        val identifier = args.optJSONObject(0)?.stringOrNull("contextIdentifier")
            ?: return callback.fail("invalidArgs", "contextIdentifier is required")
        // Looked up on the UI thread, as iOS does on main, so concurrent commits
        // for one context are serialized; removed only after commit() succeeds,
        // so a failed commit can be retried.
        cordova.activity.runOnUiThread {
            val context = pinUnregistrationContexts[identifier]
            if (context == null) {
                callback.fail(
                    "invalidArgs",
                    "Unknown contextIdentifier — already committed, or the app restarted"
                )
                return@runOnUiThread
            }
            try {
                context.commit()
                pinUnregistrationContexts.remove(identifier)
                callback.ok()
            } catch (e: Exception) {
                callback.fail("internalError", e.message ?: e.toString())
            }
        }
    }

    // endregion

    // region TOTP

    private fun registerTOTP(args: JSONArray, callback: CallbackContext) {
        val opts = args.optJSONObject(0) ?: return callback.missingArgs()
        val uri = opts.stringOrNull("uri")
            ?: return callback.fail("invalidArgs", "uri is required")
        val securityType = when (opts.stringOrNull("securityType")) {
            "biometric" -> TSTOTPSecurityType.Biometric
            "devicePin" -> TSTOTPSecurityType.DevicePin
            "devicePinOrBiometric" -> TSTOTPSecurityType.DevicePinOrBiometric
            else -> TSTOTPSecurityType.None
        }

        cordova.activity.runOnUiThread {
            TSAuthentication.registerTOTP(
                appContext, uri, securityType,
                object : ITSRegisterTOTPCallback {
                    override fun onSuccess(registrationResult: TSTOTPRegistrationResult) {
                        callback.success(JSONObject().apply {
                            put("issuer", registrationResult.issuer ?: JSONObject.NULL)
                            put("label", registrationResult.label ?: JSONObject.NULL)
                            put("uuid", registrationResult.uuid)
                        })
                    }

                    override fun onFailed(error: TSTOTPError) = callback.failWith(error)
                }
            )
        }
    }

    private fun generateTOTPCode(args: JSONArray, callback: CallbackContext) {
        val uuid = args.optJSONObject(0)?.stringOrNull("uuid")
            ?: return callback.fail("invalidArgs", "uuid is required")
        cordova.activity.runOnUiThread {
            TSAuthentication.generateTOTP(appContext, uuid, totpCodeCallback(callback))
        }
    }

    private fun generateTOTPCodeWithChallenge(args: JSONArray, callback: CallbackContext) {
        val opts = args.optJSONObject(0) ?: return callback.missingArgs()
        val uuid = opts.stringOrNull("uuid")
            ?: return callback.fail("invalidArgs", "uuid is required")
        val challenge = opts.stringOrNull("challenge")
            ?: return callback.fail("invalidArgs", "challenge is required")
        cordova.activity.runOnUiThread {
            TSAuthentication.generateTOTPWithChallenge(
                appContext, uuid, challenge, totpCodeCallback(callback)
            )
        }
    }

    private fun totpCodeCallback(callback: CallbackContext) =
        object : ITSTOTPGenerateTOTPCallback {
            override fun onSuccess(totpCode: String) {
                callback.success(JSONObject().put("code", totpCode))
            }

            override fun onFailed(error: TSTOTPError) = callback.failWith(error)
        }

    // endregion

    // region Device

    private fun getDeviceInfo(callback: CallbackContext) {
        cordova.activity.runOnUiThread {
            TSAuthentication.getDeviceInfo(
                appContext,
                authCallback(callback) { info: DeviceInfo ->
                    JSONObject().apply {
                        put("publicKeyId", info.publicKeyId)
                        put("publicKey", info.publicKey)
                        put("keyType", info.keyType)
                    }
                }
            )
        }
    }

    private fun signWithDeviceKey(args: JSONArray, callback: CallbackContext) {
        val challenge = args.optJSONObject(0)?.stringOrNull("challenge")
            ?: return callback.fail("invalidArgs", "challenge is required")
        cordova.activity.runOnUiThread {
            TSAuthentication.signWithDeviceKey(
                appContext, challenge,
                authCallback(callback) { r: TSSignResult ->
                    JSONObject().put("signature", r.signedData)
                }
            )
        }
    }

    // endregion

    // region Shared plumbing

    /** Bridges the SDK's generic success/error callback onto a Cordova callback. */
    private fun <T, E : Any> authCallback(
        callback: CallbackContext,
        transform: (T) -> JSONObject
    ) = object : TSAuthCallback<T, E> {
        override fun success(result: T) {
            try {
                callback.success(transform(result))
            } catch (e: Exception) {
                callback.fail("internalError", e.message ?: e.toString())
            }
        }

        override fun error(error: E) = callback.failWith(error)
    }

    /** The three *WithData entry points differ only in which SDK call they make. */
    private inline fun withAuthenticationData(
        args: JSONArray,
        callback: CallbackContext,
        crossinline body: (TSWebAuthnAuthenticationData) -> Unit
    ) {
        val json = args.optJSONObject(0)?.jsonStringOrNull("authenticationData")
            ?: return callback.fail("invalidArgs", "authenticationData is required")

        cordova.activity.runOnUiThread {
            // createFromJsonString returns null (rather than throwing) on
            // malformed input, so a try/catch alone is not enough.
            val data = try {
                TSWebAuthnAuthenticationData.createFromJsonString(json)
            } catch (e: Exception) {
                null
            } ?: return@runOnUiThread callback.fail(
                "invalidArgs", "Malformed authenticationData"
            )
            body(data)
        }
    }

    private fun promptTexts(json: JSONObject?) = BiometricPromptTexts(
        json?.stringOrNull("title") ?: DEFAULT_PROMPT_TITLE,
        json?.stringOrNull("subtitle") ?: DEFAULT_PROMPT_SUBTITLE,
        json?.stringOrNull("negativeButton") ?: DEFAULT_PROMPT_NEGATIVE
    )

    // endregion

    // region Callback + JSON helpers

    // A real boolean, as iOS sends — success(1) would reach JS as the number 1.
    private fun CallbackContext.ok(value: Boolean = true) =
        sendPluginResult(PluginResult(PluginResult.Status.OK, value))

    private fun CallbackContext.missingArgs() = fail("invalidArgs", "args required")

    private fun CallbackContext.fail(platformCode: String, message: String?) {
        error(JSONObject().put("platformCode", platformCode).put("message", message ?: ""))
    }

    /**
     * The SDK's error hierarchies are sealed classes, one per domain, and they do
     * not share a base type or a common accessor — some expose getErrorMessage(),
     * others getErrorMsg(), some neither. The subclass name is the error kind, so
     * that becomes platformCode (lib/errors.js maps it to the stable `code`) and
     * the message is fished out reflectively.
     */
    private fun CallbackContext.failWith(error: Any?) {
        fail(error?.javaClass?.simpleName ?: "internalError", errorMessageOf(error))
    }

    private fun errorMessageOf(error: Any?): String {
        if (error == null) return ""
        for (name in arrayOf("getErrorMessage", "getErrorMsg", "getMessage")) {
            try {
                val value = error.javaClass.getMethod(name).invoke(error) as? String
                if (!value.isNullOrEmpty()) return value
            } catch (_: Exception) {
                // Accessor absent on this error type — try the next one.
            }
        }
        return error.toString()
    }

    private fun JSONObject.stringOrNull(key: String): String? =
        if (isNull(key)) null else optString(key, "").trim().takeIf { it.isNotEmpty() }

    /** Accepts either a JSON object or an already-serialized JSON string. */
    private fun JSONObject.jsonStringOrNull(key: String): String? {
        if (isNull(key)) return null
        optJSONObject(key)?.let { return it.toString() }
        return stringOrNull(key)
    }

    private fun JSONObject.toStringValueMap(): Map<String, String> = buildMap {
        keys().forEach { key ->
            val value = opt(key)
            if (value != null && value != JSONObject.NULL) {
                put(key, if (value is String) value else value.toString())
            }
        }
    }

    // endregion
}
