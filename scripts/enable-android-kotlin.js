#!/usr/bin/env node
/**
 * enable-android-kotlin.js  —  Cordova after_prepare hook
 *
 * Cordova regenerates platforms/android/cdv-gradle-config.json on every
 * `cordova prepare` and defaults IS_GRADLE_PLUGIN_KOTLIN_ENABLED to false.
 * This hook patches it to true so the app module compiles the plugin's .kt
 * source files (TSAuthPlugin.kt).
 *
 * Without this flag, Gradle silently ignores .kt files in the app module and
 * Android Studio's error-free indexing gives a false sense of correctness.
 */
'use strict';

const path = require('path');
const fs   = require('fs');

module.exports = function (context) {
    const platforms = (context.opts && context.opts.platforms) || [];
    if (!platforms.includes('android')) return;

    const cfgPath = path.join(
        context.opts.projectRoot,
        'platforms', 'android', 'cdv-gradle-config.json'
    );
    if (!fs.existsSync(cfgPath)) return;

    const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    if (!cfg.IS_GRADLE_PLUGIN_KOTLIN_ENABLED) {
        cfg.IS_GRADLE_PLUGIN_KOTLIN_ENABLED = true;
        fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2), 'utf8');
        console.log('[TSAuth hook] IS_GRADLE_PLUGIN_KOTLIN_ENABLED set to true');
    }
};
