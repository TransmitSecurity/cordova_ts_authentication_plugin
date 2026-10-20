import Foundation
import UIKit
import Cordova
import TSAuthenticationSDK

@objc(TSAuthPlugin)
public class TSAuthPlugin: CDVPlugin {

    /// PIN registration/unregistration is a two-phase commit: the SDK hands back a
    /// context object that must be retained until the app confirms its backend
    /// accepted the key. JS cannot hold a Swift object, so contexts are parked
    /// here under an opaque identifier that crosses the bridge instead.
    private var pinRegistrationContexts: [String: TSPinCodeRegistrationContext] = [:]
    private var pinUnregistrationContexts: [String: TSPinCodeUnregistrationContext] = [:]

    public override func dispose() {
        pinRegistrationContexts.removeAll()
        pinUnregistrationContexts.removeAll()
        super.dispose()
    }

    // MARK: - Lifecycle

    @objc func initializeSDK(_ command: CDVInvokedUrlCommand) {
        let args = command.arguments.first as? [String: Any]
        let configurationFile = Self.trimmed(args?["configurationFile"])

        DispatchQueue.main.async {
            do {
                if let configurationFile {
                    try TSAuthentication.shared.initializeSDK(
                        configuration: TSAuthenticationConfiguration(
                            configurationFileName: configurationFile
                        )
                    )
                } else {
                    try TSAuthentication.shared.initializeSDK()
                }
                self.sendOk(command, true)
            } catch {
                self.sendError(command, error)
            }
        }
    }

    @objc func initialize(_ command: CDVInvokedUrlCommand) {
        guard let args = command.arguments.first as? [String: Any],
              let clientId = Self.trimmed(args["clientId"]) else {
            sendError(command, code: "invalidArgs", message: "clientId is required")
            return
        }

        let options = args["options"] as? [String: Any]
        let baseUrl = Self.trimmed(options?["baseUrl"]) ?? "https://api.transmitsecurity.io/"
        let domain = Self.trimmed(options?["domain"])

        var initOptions: TSAuthenticationInitOptions?
        if let paths = options?["webAuthnApiPaths"] as? [String: Any],
           let startRegistration = Self.trimmed(paths["startRegistration"]),
           let startAuthentication = Self.trimmed(paths["startAuthentication"]) {
            initOptions = TSAuthenticationInitOptions(
                webAuthnApiPaths: WebAuthnApis(
                    startAuthentication: startAuthentication,
                    startRegistration: startRegistration
                )
            )
        }

        DispatchQueue.main.async {
            TSAuthentication.shared.initialize(
                baseUrl: baseUrl,
                clientId: clientId,
                domain: domain,
                initOptions: initOptions
            )
            self.sendOk(command, true)
        }
    }

    @objc func setLoggingEnabled(_ command: CDVInvokedUrlCommand) {
        guard let args = command.arguments.first as? [String: Any],
              let enabled = Self.boolValue(args["enabled"]) else {
            sendError(command, code: "invalidArgs", message: "enabled must be true or false")
            return
        }
        DispatchQueue.main.async {
            TSAuthentication.setLogLevel(enabled ? .debug : .off)
            self.sendOk(command, true)
        }
    }

    // MARK: - WebAuthn / passkeys

    @objc func registerWebAuthn(_ command: CDVInvokedUrlCommand) {
        guard let args = command.arguments.first as? [String: Any],
              let username = Self.trimmed(args["username"]) else {
            sendError(command, code: "invalidArgs", message: "username is required")
            return
        }
        let displayName = Self.trimmed(args["displayName"])

        DispatchQueue.main.async {
            TSAuthentication.shared.registerWebAuthn(
                username: username,
                displayName: displayName
            ) { result in
                self.completeResult(command, result) { ["result": $0.result] }
            }
        }
    }

    @objc func registerWebAuthnWithData(_ command: CDVInvokedUrlCommand) {
        guard let args = command.arguments.first as? [String: Any] else {
            sendError(command, code: "invalidArgs", message: "registrationData is required")
            return
        }
        guard let data = Self.jsonData(args["registrationData"]) else {
            sendError(command, code: "invalidArgs",
                      message: "registrationData must be a JSON object or string")
            return
        }

        DispatchQueue.main.async {
            do {
                let registrationData = try TSWebAuthnRegistrationData(data)
                TSAuthentication.shared.registerWebAuthn(registrationData) { result in
                    self.completeResult(command, result) { ["result": $0.result] }
                }
            } catch {
                self.sendError(command, code: "invalidArgs",
                               message: "Malformed registrationData: \(error.localizedDescription)")
            }
        }
    }

    @objc func authenticateWebAuthn(_ command: CDVInvokedUrlCommand) {
        guard let args = command.arguments.first as? [String: Any] else {
            sendError(command, code: "invalidArgs", message: "args required")
            return
        }
        // An empty username is valid: it lets the platform offer any local passkey.
        let username = (args["username"] as? String) ?? ""
        let options = Self.webAuthnOptions(args["options"])

        DispatchQueue.main.async {
            TSAuthentication.shared.authenticateWebAuthn(
                username: username,
                options: options
            ) { result in
                self.completeResult(command, result) { ["result": $0.result] }
            }
        }
    }

    @objc func authenticateWebAuthnWithData(_ command: CDVInvokedUrlCommand) {
        withAuthenticationData(command) { data, options in
            TSAuthentication.shared.authenticateWebAuthn(data, options: options) { result in
                self.completeResult(command, result) { ["result": $0.result] }
            }
        }
    }

    @objc func signWebAuthnTransaction(_ command: CDVInvokedUrlCommand) {
        guard let args = command.arguments.first as? [String: Any],
              let username = Self.trimmed(args["username"]) else {
            sendError(command, code: "invalidArgs", message: "username is required")
            return
        }
        let options = Self.webAuthnOptions(args["options"])

        DispatchQueue.main.async {
            TSAuthentication.shared.signWebauthnTransaction(
                username: username,
                options: options
            ) { result in
                self.completeResult(command, result) { ["result": $0.result] }
            }
        }
    }

    @objc func signWebAuthnTransactionWithData(_ command: CDVInvokedUrlCommand) {
        withAuthenticationData(command) { data, options in
            TSAuthentication.shared.signWebauthnTransaction(data, options: options) { result in
                self.completeResult(command, result) { ["result": $0.result] }
            }
        }
    }

    @objc func approvalWebAuthn(_ command: CDVInvokedUrlCommand) {
        guard let args = command.arguments.first as? [String: Any] else {
            sendError(command, code: "invalidArgs", message: "args required")
            return
        }
        // The SDK takes [String: String]; stringify so a caller passing numbers or
        // booleans in the approval payload does not silently lose them.
        let approvalData = Self.stringMap(args["approvalData"])
        guard !approvalData.isEmpty else {
            sendError(command, code: "invalidArgs", message: "approvalData is required")
            return
        }
        let username = Self.trimmed(args["username"])
        let options = Self.webAuthnOptions(args["options"])

        DispatchQueue.main.async {
            TSAuthentication.shared.approvalWebAuthn(
                approvalData: approvalData,
                username: username,
                options: options
            ) { result in
                self.completeResult(command, result) { ["result": $0.result] }
            }
        }
    }

    @objc func approvalWebAuthnWithData(_ command: CDVInvokedUrlCommand) {
        withAuthenticationData(command) { data, options in
            TSAuthentication.shared.approvalWebAuthn(data, options: options) { result in
                self.completeResult(command, result) { ["result": $0.result] }
            }
        }
    }

    @objc func isWebAuthnSupported(_ command: CDVInvokedUrlCommand) {
        DispatchQueue.main.async {
            self.sendOk(command, TSAuthentication.isWebAuthnSupported())
        }
    }

    // MARK: - Native biometrics

    @objc func registerNativeBiometrics(_ command: CDVInvokedUrlCommand) {
        guard let args = command.arguments.first as? [String: Any],
              let username = Self.trimmed(args["username"]) else {
            sendError(command, code: "invalidArgs", message: "username is required")
            return
        }
        DispatchQueue.main.async {
            TSAuthentication.shared.registerNativeBiometrics(username: username) { result in
                self.completeResult(command, result) {
                    [
                        "publicKey": $0.publicKey,
                        "publicKeyId": $0.publicKeyId,
                        "keyType": $0.keyType,
                        "attestation": $0.attestation as Any,
                        "os": "ios",
                    ]
                }
            }
        }
    }

    @objc func authenticateNativeBiometrics(_ command: CDVInvokedUrlCommand) {
        guard let (username, challenge) = usernameAndChallenge(command) else { return }
        DispatchQueue.main.async {
            TSAuthentication.shared.authenticateNativeBiometrics(
                username: username,
                challenge: challenge
            ) { result in
                self.completeResult(command, result) {
                    ["publicKeyId": $0.publicKeyId, "signature": $0.signature]
                }
            }
        }
    }

    @objc func approvalNativeBiometrics(_ command: CDVInvokedUrlCommand) {
        guard let (username, challenge) = usernameAndChallenge(command) else { return }
        DispatchQueue.main.async {
            TSAuthentication.shared.approvalNativeBiometrics(
                username: username,
                challenge: challenge
            ) { result in
                self.completeResult(command, result) {
                    ["publicKeyId": $0.publicKeyId, "signature": $0.signature]
                }
            }
        }
    }

    @objc func unregisterNativeBiometrics(_ command: CDVInvokedUrlCommand) {
        guard let args = command.arguments.first as? [String: Any],
              let username = Self.trimmed(args["username"]) else {
            sendError(command, code: "invalidArgs", message: "username is required")
            return
        }
        DispatchQueue.main.async {
            TSAuthentication.shared.unregistersNativeBiometrics(username: username) { result in
                self.completeResult(command, result) { ["publicKeyId": $0.publicKeyId] }
            }
        }
    }

    @objc func getNativeBiometricsStatus(_ command: CDVInvokedUrlCommand) {
        DispatchQueue.main.async {
            let status = TSAuthentication.nativeBiometricsStatus()
            self.sendOk(command, [
                "status": Self.biometricsStatusName(status),
                "statusRaw": String(describing: status),
                "enrolled": TSAuthentication.isNativeBiometricsEnrolled(),
                "type": Self.biometricsTypeName(TSAuthentication.nativeBiometricsType()),
            ])
        }
    }

    // MARK: - PIN code

    @objc func registerPinCode(_ command: CDVInvokedUrlCommand) {
        guard let args = command.arguments.first as? [String: Any],
              let username = Self.trimmed(args["username"]),
              let pinCode = Self.trimmed(args["pinCode"]) else {
            sendError(command, code: "invalidArgs", message: "username and pinCode are required")
            return
        }
        DispatchQueue.main.async {
            TSAuthentication.shared.registerPinCode(username: username, pinCode: pinCode) { result in
                switch result {
                case .success(let value):
                    let identifier = UUID().uuidString
                    self.pinRegistrationContexts[identifier] = value.registrationContext
                    self.sendOk(command, [
                        "publicKey": value.publicKey,
                        "publicKeyId": value.publicKeyId,
                        "keyType": value.keyType,
                        "aliasDeviceName": value.aliasDeviceName,
                        "contextIdentifier": identifier,
                    ])
                case .failure(let error):
                    self.sendError(command, error)
                }
            }
        }
    }

    @objc func commitPinRegistration(_ command: CDVInvokedUrlCommand) {
        guard let args = command.arguments.first as? [String: Any],
              let identifier = Self.trimmed(args["contextIdentifier"]) else {
            sendError(command, code: "invalidArgs", message: "contextIdentifier is required")
            return
        }
        DispatchQueue.main.async {
            guard let context = self.pinRegistrationContexts[identifier] else {
                self.sendError(command, code: "invalidArgs",
                               message: "Unknown contextIdentifier — already committed, or the app restarted")
                return
            }
            do {
                try context.commit()
                self.pinRegistrationContexts.removeValue(forKey: identifier)
                self.sendOk(command, true)
            } catch {
                self.sendError(command, error)
            }
        }
    }

    @objc func authenticatePinCode(_ command: CDVInvokedUrlCommand) {
        guard let args = command.arguments.first as? [String: Any],
              let username = Self.trimmed(args["username"]),
              let pinCode = Self.trimmed(args["pinCode"]),
              let challenge = Self.trimmed(args["challenge"]) else {
            sendError(command, code: "invalidArgs",
                      message: "username, pinCode and challenge are required")
            return
        }
        DispatchQueue.main.async {
            TSAuthentication.shared.authenticatePinCode(
                username: username,
                pinCode: pinCode,
                challenge: challenge
            ) { result in
                self.completeResult(command, result) {
                    [
                        "publicKeyId": $0.publicKeyId,
                        "signature": $0.signature,
                        "challenge": $0.challenge,
                    ]
                }
            }
        }
    }

    @objc func unregisterPinCode(_ command: CDVInvokedUrlCommand) {
        guard let args = command.arguments.first as? [String: Any],
              let username = Self.trimmed(args["username"]) else {
            sendError(command, code: "invalidArgs", message: "username is required")
            return
        }
        DispatchQueue.main.async {
            TSAuthentication.shared.unregisterPinCode(username: username) { result in
                switch result {
                case .success(let value):
                    let identifier = UUID().uuidString
                    self.pinUnregistrationContexts[identifier] = value.unregistrationContext
                    self.sendOk(command, [
                        "publicKeyId": value.publicKeyId,
                        "contextIdentifier": identifier,
                    ])
                case .failure(let error):
                    self.sendError(command, error)
                }
            }
        }
    }

    @objc func commitPinUnregistration(_ command: CDVInvokedUrlCommand) {
        guard let args = command.arguments.first as? [String: Any],
              let identifier = Self.trimmed(args["contextIdentifier"]) else {
            sendError(command, code: "invalidArgs", message: "contextIdentifier is required")
            return
        }
        DispatchQueue.main.async {
            guard let context = self.pinUnregistrationContexts[identifier] else {
                self.sendError(command, code: "invalidArgs",
                               message: "Unknown contextIdentifier — already committed, or the app restarted")
                return
            }
            do {
                try context.commit()
                self.pinUnregistrationContexts.removeValue(forKey: identifier)
                self.sendOk(command, true)
            } catch {
                self.sendError(command, error)
            }
        }
    }

    // MARK: - TOTP

    @objc func registerTOTP(_ command: CDVInvokedUrlCommand) {
        guard let args = command.arguments.first as? [String: Any],
              let uri = Self.trimmed(args["uri"]) else {
            sendError(command, code: "invalidArgs", message: "uri is required")
            return
        }
        let securityType = Self.totpSecurityType(args["securityType"])

        DispatchQueue.main.async {
            TSAuthentication.shared.registerTOTP(URI: uri, securityType: securityType) { result in
                self.completeResult(command, result) {
                    [
                        "issuer": $0.issuer as Any,
                        "label": $0.label as Any,
                        "uuid": $0.uuid,
                    ]
                }
            }
        }
    }

    @objc func generateTOTPCode(_ command: CDVInvokedUrlCommand) {
        guard let args = command.arguments.first as? [String: Any],
              let uuid = Self.trimmed(args["uuid"]) else {
            sendError(command, code: "invalidArgs", message: "uuid is required")
            return
        }
        DispatchQueue.main.async {
            TSAuthentication.shared.generateTOTPCode(UUID: uuid) { result in
                self.completeResult(command, result) { ["code": $0.code] }
            }
        }
    }

    @objc func generateTOTPCodeWithChallenge(_ command: CDVInvokedUrlCommand) {
        guard let args = command.arguments.first as? [String: Any],
              let uuid = Self.trimmed(args["uuid"]),
              let challenge = Self.trimmed(args["challenge"]) else {
            sendError(command, code: "invalidArgs", message: "uuid and challenge are required")
            return
        }
        DispatchQueue.main.async {
            TSAuthentication.shared.generateTOTPCodeWithChallenge(
                UUID: uuid,
                challenge: challenge
            ) { result in
                self.completeResult(command, result) { ["code": $0.code] }
            }
        }
    }

    // MARK: - Device

    @objc func getDeviceInfo(_ command: CDVInvokedUrlCommand) {
        DispatchQueue.main.async {
            TSAuthentication.shared.getDeviceInfo { result in
                self.completeResult(command, result) {
                    ["publicKeyId": $0.publicKeyId, "publicKey": $0.publicKey]
                }
            }
        }
    }

    @objc func signWithDeviceKey(_ command: CDVInvokedUrlCommand) {
        guard let args = command.arguments.first as? [String: Any],
              let challenge = Self.trimmed(args["challenge"]) else {
            sendError(command, code: "invalidArgs", message: "challenge is required")
            return
        }
        DispatchQueue.main.async {
            TSAuthentication.shared.signWithDeviceKey(challenge: challenge) { result in
                self.completeResult(command, result) { ["signature": $0.signature] }
            }
        }
    }

    // MARK: - Shared plumbing

    /// The three *WithData entry points differ only in which SDK call they make.
    private func withAuthenticationData(
        _ command: CDVInvokedUrlCommand,
        _ body: @escaping (TSWebAuthnAuthenticationData,
                           TSAuthentication.WebAuthnAuthenticationOptions) -> Void
    ) {
        guard let args = command.arguments.first as? [String: Any],
              let data = Self.jsonData(args["authenticationData"]) else {
            sendError(command, code: "invalidArgs",
                      message: "authenticationData must be a JSON object or string")
            return
        }
        let options = Self.webAuthnOptions(args["options"])

        DispatchQueue.main.async {
            do {
                body(try TSWebAuthnAuthenticationData(data), options)
            } catch {
                self.sendError(command, code: "invalidArgs",
                               message: "Malformed authenticationData: \(error.localizedDescription)")
            }
        }
    }

    private func usernameAndChallenge(
        _ command: CDVInvokedUrlCommand
    ) -> (String, String)? {
        guard let args = command.arguments.first as? [String: Any],
              let username = Self.trimmed(args["username"]),
              let challenge = Self.trimmed(args["challenge"]) else {
            sendError(command, code: "invalidArgs",
                      message: "username and challenge are required")
            return nil
        }
        return (username, challenge)
    }

    private func completeResult<T, E: Error>(
        _ command: CDVInvokedUrlCommand,
        _ result: Result<T, E>,
        _ transform: @escaping (T) -> [String: Any]
    ) {
        DispatchQueue.main.async {
            switch result {
            case .success(let value):
                self.sendOk(command, transform(value))
            case .failure(let error):
                self.sendError(command, error)
            }
        }
    }

    // MARK: - Argument conversion

    private static func trimmed(_ value: Any?) -> String? {
        // Numbers are accepted as on Android (optString), e.g. a numeric pinCode.
        let number = value as? NSNumber
        guard let string = (value as? String) ?? number.map({ $0.stringValue }) else { return nil }
        let result = string.trimmingCharacters(in: .whitespacesAndNewlines)
        return result.isEmpty ? nil : result
    }

    private static func boolValue(_ value: Any?) -> Bool? {
        if let value = value as? Bool { return value }
        if let value = value as? NSNumber { return value.boolValue }
        return nil
    }

    /// Accepts either a JSON object or a pre-serialized JSON string, since server
    /// payloads reach JS both ways.
    private static func jsonData(_ value: Any?) -> Data? {
        if let string = value as? String {
            return string.data(using: .utf8)
        }
        if let dict = value as? [String: Any] {
            return try? JSONSerialization.data(withJSONObject: dict)
        }
        return nil
    }

    private static func stringMap(_ value: Any?) -> [String: String] {
        guard let dict = value as? [String: Any] else { return [:] }
        var result: [String: String] = [:]
        for (key, val) in dict {
            if let val = val as? String {
                result[key] = val
            } else if !(val is NSNull) {
                result[key] = String(describing: val)
            }
        }
        return result
    }

    private static func webAuthnOptions(
        _ value: Any?
    ) -> TSAuthentication.WebAuthnAuthenticationOptions {
        guard let dict = value as? [String: Any],
              boolValue(dict["preferLocalCredentials"]) == true else { return [] }
        // The SDK's own spelling of this option contains a typo.
        return [.preferLocalCredantials]
    }

    private static func totpSecurityType(_ value: Any?) -> TSTOTPSecurityType {
        switch (value as? String) ?? "none" {
        case "biometric": return .biometric
        case "devicePin": return .devicePin
        case "devicePinOrBiometric": return .devicePinOrBiometric
        default: return .none
        }
    }

    private static func biometricsStatusName(_ status: TSBiometricStatus) -> String {
        switch status {
        case .available: return "available"
        case .notEnrolled: return "notEnrolled"
        case .notAvailable: return "notAvailable"
        case .permissionDenied: return "permissionDenied"
        case .lockedOut: return "lockedOut"
        @unknown default: return "unknown"
        }
    }

    private static func biometricsTypeName(_ type: TSBiometricType) -> String {
        switch type {
        case .faceID: return "faceID"
        case .touchID: return "touchID"
        case .opticID: return "opticID"
        case .none: return "none"
        @unknown default: return "unknown"
        }
    }

    // MARK: - Error mapping

    /// Reports the SDK's own case name. lib/errors.js maps this onto the stable
    /// cross-platform `code`; keeping the raw name means nothing is lost when the
    /// two platforms disagree (and Android's taxonomy is far finer-grained).
    private static func platformCode(_ error: Error) -> String {
        guard let authError = error as? TSAuthenticationError else {
            return String(describing: type(of: error))
        }
        switch authError {
        case .notInitialized: return "notInitialized"
        case .unsupportedOSVersion: return "unsupportedOSVersion"
        case .requestIsRunning: return "requestIsRunning"
        case .networkError: return "networkError"
        case .initializationError: return "initializationError"
        case .internal: return "internal"
        case .webAuthnError(let inner): return webAuthnCode(inner)
        case .totpError(let inner): return totpCode(inner)
        case .nativeBiometricsError(let inner): return biometricsCode(inner)
        case .pinCodeError(let inner): return pinCodeCode(inner)
        @unknown default: return "internal"
        }
    }

    private static func webAuthnCode(_ error: TSWebAuthnError) -> String {
        switch error {
        case .canceled: return "canceled"
        case .invalidResponse: return "invalidResponse"
        case .notHandled: return "notHandled"
        case .failed: return "failed"
        case .notInteractive: return "notInteractive"
        case .invalidDomain: return "invalidDomain"
        case .invalidWebAuthnSession: return "invalidWebAuthnSession"
        case .userNotFound: return "userNotFound"
        case .internal: return "internal"
        @unknown default: return "internal"
        }
    }

    private static func totpCode(_ error: TSTOTPError) -> String {
        switch error {
        case .nativeBiometricsNotAvailable: return "nativeBiometricsNotAvailable"
        case .incorrectURIFormat: return "incorrectURIFormat"
        case .notRegistered: return "notRegistered"
        case .invalidSecret: return "invalidSecret"
        case .invalidAlgorithm: return "invalidAlgorithm"
        case .invalidPeriod: return "invalidPeriod"
        case .invalidDigits: return "invalidDigits"
        case .devicePinNotAvailable: return "devicePinNotAvailable"
        case .devicePinOrBiometricNotAvailable: return "devicePinOrBiometricNotAvailable"
        case .userCanceled: return "userCanceled"
        case .authenticationFailed: return "authenticationFailed"
        case .internal: return "internal"
        @unknown default: return "internal"
        }
    }

    private static func biometricsCode(_ error: TSNativeBiometricsError) -> String {
        switch error {
        case .nativeBiometricsNotAvailable: return "nativeBiometricsNotAvailable"
        case .nativeBiometricsNotEnrolled: return "nativeBiometricsNotEnrolled"
        case .notRegistered: return "notRegistered"
        case .canceled: return "canceled"
        case .userCanceled: return "userCanceled"
        case .failure: return "failure"
        case .lockedOut: return "lockedOut"
        case .permissionDenied: return "permissionDenied"
        case .internal: return "internal"
        @unknown default: return "internal"
        }
    }

    private static func pinCodeCode(_ error: TSPinCodeError) -> String {
        switch error {
        case .notRegistered: return "notRegistered"
        case .duplicateCommitRegistration: return "duplicateCommitRegistration"
        case .internal: return "internal"
        @unknown default: return "internal"
        }
    }

    // MARK: - Cordova plugin result helpers

    private static func pluginDictionary(_ dict: [String: Any]) -> [AnyHashable: Any] {
        Dictionary(uniqueKeysWithValues: dict.map { (AnyHashable($0.key), jsonSafe($0.value)) })
    }

    /// Keeps only what the Cordova JSON bridge can serialize. The explicit
    /// Optional unwrap matters: `attestation`/`issuer`/`label` are `String?`
    /// boxed into `Any`, and a nil in that form is not `is NSNull`.
    private static func jsonSafe(_ value: Any) -> Any {
        guard case Optional<Any>.some(let unwrapped) = value else { return NSNull() }
        switch unwrapped {
        case is NSNull: return NSNull()
        case let string as String: return string
        case let number as NSNumber: return number
        case let dict as [String: Any]: return dict.mapValues { jsonSafe($0) }
        case let array as [Any]: return array.map { jsonSafe($0) }
        default: return String(describing: unwrapped)
        }
    }

    private func sendOk(_ command: CDVInvokedUrlCommand, _ message: Bool) {
        commandDelegate.send(
            CDVPluginResult(status: .ok, messageAs: message),
            callbackId: command.callbackId
        )
    }

    private func sendOk(_ command: CDVInvokedUrlCommand, _ message: [String: Any]) {
        commandDelegate.send(
            CDVPluginResult(status: .ok, messageAs: Self.pluginDictionary(message)),
            callbackId: command.callbackId
        )
    }

    private func sendError(_ command: CDVInvokedUrlCommand, _ error: Error) {
        sendError(
            command,
            code: Self.platformCode(error),
            message: error.localizedDescription
        )
    }

    private func sendError(_ command: CDVInvokedUrlCommand, code: String, message: String) {
        commandDelegate.send(
            CDVPluginResult(
                status: .error,
                messageAs: Self.pluginDictionary(["platformCode": code, "message": message])
            ),
            callbackId: command.callbackId
        )
    }
}
