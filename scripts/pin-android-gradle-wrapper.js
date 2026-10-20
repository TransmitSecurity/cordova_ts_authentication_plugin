#!/usr/bin/env node
/**
 * pin-android-gradle-wrapper.js — Cordova after_prepare hook
 *
 * Android Studio sometimes upgrades platforms/android/gradle/wrapper to Gradle 9.x.
 * cordova-android 14 pins GRADLE_VERSION in cdv-gradle-config.json (currently 8.13)
 * and AGP 8.7.x is not compatible with Gradle 9 — sync then fails with:
 *   Cannot select root node 'debugRuntimeClasspathCopy' as a variant
 *
 * This hook rewrites gradle-wrapper.properties to match cdv-gradle-config.json after
 * every prepare so Gradle sync and CLI builds stay aligned.
 */
'use strict';

const fs = require('fs');
const path = require('path');

module.exports = function (context) {
    const platforms = (context.opts && context.opts.platforms) || [];
    if (!platforms.includes('android')) return;

    const androidRoot = path.join(context.opts.projectRoot, 'platforms', 'android');
    const cfgPath = path.join(androidRoot, 'cdv-gradle-config.json');
    const wrapperPath = path.join(androidRoot, 'gradle', 'wrapper', 'gradle-wrapper.properties');

    if (!fs.existsSync(cfgPath) || !fs.existsSync(wrapperPath)) return;

    const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    const gradleVersion = cfg.GRADLE_VERSION;
    if (!gradleVersion) return;

    const distributionUrl = `https\\://services.gradle.org/distributions/gradle-${gradleVersion}-bin.zip`;
    let wrapper = fs.readFileSync(wrapperPath, 'utf8');
    const next = wrapper.replace(
        /^distributionUrl=.*$/m,
        `distributionUrl=${distributionUrl}`
    );

    if (next === wrapper) return;

    fs.writeFileSync(wrapperPath, next, 'utf8');
    console.log(`[TSAuth hook] Pinned Gradle wrapper to ${gradleVersion} (cordova-android cdv-gradle-config.json)`);
};
