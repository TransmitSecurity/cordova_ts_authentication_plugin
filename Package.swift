// swift-tools-version:5.9
import PackageDescription

// Transmit Security Authentication (A+) iOS SDK via Swift Package Manager.
// TSAuthenticationSDK pulls TSCoreSDK transitively from the SDK package manifest.
let package = Package(
    name: "cordova-ts-authentication",
    platforms: [
        .iOS(.v13)
    ],
    products: [
        .library(name: "cordova-ts-authentication", targets: ["TSAuthPlugin"])
    ],
    dependencies: [
        .package(name: "cordova-ios", path: "../cordova-ios"),
        .package(url: "https://github.com/TransmitSecurity/authentication-ios-sdk.git", exact: "1.2.2")
    ],
    targets: [
        .target(
            name: "TSAuthPlugin",
            dependencies: [
                .product(name: "Cordova", package: "cordova-ios"),
                .product(name: "TSAuthenticationSDK", package: "authentication-ios-sdk")
            ],
            path: "src/ios"
        )
    ]
)
