#!/usr/bin/env node
/**
 * remove-unused-ios-cocoapods.js — Cordova after_prepare hook
 *
 * cordova-ios always scaffolds Podfile / Pods / pods.json even when every
 * plugin uses Swift Package Manager only. This hook removes that unused
 * CocoaPods surface from platforms/ios after prepare so the example app tree
 * stays SPM-only.
 *
 * Skipped when pods.json lists any library, source, or declaration (a plugin
 * actually declared a CocoaPods dependency).
 */
'use strict';

const fs = require('fs');
const path = require('path');

function isEmptyPodsJson(contents) {
    if (!contents || typeof contents !== 'object') return false;
    for (const key of ['declarations', 'sources', 'libraries']) {
        const section = contents[key];
        if (section && typeof section === 'object' && Object.keys(section).length > 0) {
            return false;
        }
    }
    return true;
}

function stripPodIncludesFromXcconfig(filePath) {
    if (!fs.existsSync(filePath)) return;
    const lines = fs.readFileSync(filePath, 'utf8').split('\n');
    const filtered = lines.filter((line) =>
        !line.includes('pods-debug.xcconfig') &&
        !line.includes('pods-release.xcconfig') &&
        !line.includes('@COCOAPODS_SILENCE_WARNINGS@')
    );
    fs.writeFileSync(filePath, filtered.join('\n'), 'utf8');
}

function removePodsFromWorkspace(workspacePath) {
    if (!fs.existsSync(workspacePath)) return;
    const xml = fs.readFileSync(workspacePath, 'utf8');
    const cleaned = xml.replace(
        /\s*<FileRef\s+location = "group:Pods\/Pods\.xcodeproj">\s*<\/FileRef>\s*/g,
        '\n'
    );
    if (cleaned !== xml) {
        fs.writeFileSync(workspacePath, cleaned, 'utf8');
    }
}

function stripCocoaPodsFromPbxproj(pbxPath) {
    if (!fs.existsSync(pbxPath)) return;

    let text = fs.readFileSync(pbxPath, 'utf8');

    // Multi-line blocks first — do not line-filter [CP] before this runs.
    text = text.replace(/\t\t[A-F0-9]+ \/\* \[CP\][^*]*\*\/ = \{\n[\s\S]*?\n\t\t\};\n/g, '');
    text = text.replace(/\t\t\t\t[A-F0-9]+ \/\* \[CP\][^*]*\*\/,\n/g, '');
    text = text.replace(/\t\t[A-F0-9]+ \/\* Pods \*\/ = \{\n[\s\S]*?\n\t\t\};\n/g, '');
    text = text.replace(/\t\t\t\t[A-F0-9]+ \/\* Pods \*\/,\n/g, '');

    const emptyFrameworksGroup = text.match(
        /\t\t([A-F0-9]+) \/\* Frameworks \*\/ = \{\n\t\t\tisa = PBXGroup;\n\t\t\tchildren = \(\n\t\t\t\);\n\t\t\tname = Frameworks;\n\t\t\tsourceTree = "<group>";\n\t\t\};\n/
    );
    if (emptyFrameworksGroup) {
        const groupId = emptyFrameworksGroup[1];
        text = text.replace(emptyFrameworksGroup[0], '');
        text = text.replace(new RegExp(`\\t\\t\\t\\t${groupId} \\/\\* Frameworks \\*\\/,\n`, 'g'), '');
    }

    text = text
        .split('\n')
        .filter((line) =>
            !line.includes('libPods-App') &&
            !line.includes('Pods-App.') &&
            !line.includes('PODS_PODFILE_DIR_PATH') &&
            !line.includes('PODS_ROOT') &&
            !line.includes('Pods-App-checkManifestLock')
        )
        .join('\n');

    // Drop an empty PBXShellScriptBuildPhase section left after [CP] removal.
    text = text.replace(
        /\/\* Begin PBXShellScriptBuildPhase section \*\/\n(?:\t[^\n]*\n)*?\/\* End PBXShellScriptBuildPhase section \*\/\n\n/g,
        (section) => (section.includes(' = {') ? section : '')
    );

    fs.writeFileSync(pbxPath, text, 'utf8');
}

module.exports = function (context) {
    const platforms = (context.opts && context.opts.platforms) || [];
    if (!platforms.includes('ios')) return;

    const iosRoot = path.join(context.opts.projectRoot, 'platforms', 'ios');
    if (!fs.existsSync(iosRoot)) return;

    const podsJsonPath = path.join(iosRoot, 'pods.json');
    if (fs.existsSync(podsJsonPath)) {
        try {
            const podsJson = JSON.parse(fs.readFileSync(podsJsonPath, 'utf8'));
            if (!isEmptyPodsJson(podsJson)) {
                return;
            }
        } catch (e) {
            return;
        }
    }

    for (const name of ['Podfile', 'Podfile.lock', 'pods.json', 'pods-debug.xcconfig', 'pods-release.xcconfig']) {
        const filePath = path.join(iosRoot, name);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    }

    fs.rmSync(path.join(iosRoot, 'Pods'), { recursive: true, force: true });

    stripPodIncludesFromXcconfig(path.join(iosRoot, 'cordova', 'build-debug.xcconfig'));
    stripPodIncludesFromXcconfig(path.join(iosRoot, 'cordova', 'build-release.xcconfig'));
    removePodsFromWorkspace(path.join(iosRoot, 'App.xcworkspace', 'contents.xcworkspacedata'));
    stripCocoaPodsFromPbxproj(path.join(iosRoot, 'App.xcodeproj', 'project.pbxproj'));

    console.log('[TSAuth hook] Removed unused CocoaPods scaffolding from platforms/ios (SPM-only project)');
};
