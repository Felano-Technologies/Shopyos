// plugins/withVoipPushKit.js
//
// Injects the native iOS glue that react-native-voip-push-notification +
// react-native-callkeep require and that has no JS-only equivalent:
// PKPushRegistryDelegate methods MUST live on the actual AppDelegate class
// (react-native-voip-push-notification's voipRegistration() sets the
// PKPushRegistry's delegate to `RCTSharedApplication().delegate`, i.e.
// AppDelegate itself — see RNVoipPushNotificationManager.m), and Apple
// requires didReceiveIncomingPushWithPayload: to report to CallKit
// SYNCHRONOUSLY inside that native callback or iOS kills the app — there is
// no way to satisfy that from JS in time.
//
// There is no checked-in ios/ project in this repo (EAS/prebuild-generated
// fresh each build), so this can't be a one-time manual AppDelegate edit —
// it has to be a config plugin that re-applies on every prebuild.
//
// Handles BOTH AppDelegate flavors Expo can generate (SDK 57 can produce
// either depending on template/version) so a prebuild never crashes no
// matter which one comes out: 'objc'/'objcpp' (AppDelegate.m/.mm) and
// 'swift' (AppDelegate.swift). CONFIRMED against a real EAS build: this
// project generates AppDelegate.swift, and the import/voipRegistration()/
// delegate-extension injection below all landed exactly where intended.
// The one thing that failed on that build: `import RNVoipPushNotification`
// / `import RNCallKeep` from Swift need each pod built with CocoaPods'
// modular headers, which isn't the default — without it there's no
// Swift-importable module and the build fails with "no such module
// 'RNVoipPushNotification'". Fixed via the Podfile mod below (marking just
// these two pods `:modular_headers => true`) rather than rewriting the
// AppDelegate injection to use a bridging header instead — modular headers
// needed no changes to the AppDelegate logic itself, which was already
// correct. If a future build still fails on these imports, the fallback is
// a bridging header (`<Name>-Bridging-Header.h` with
// `#import "RNVoipPushNotificationManager.h"` / `#import <RNCallKeep/RNCallKeep.h>`,
// wired via the `SWIFT_OBJC_BRIDGING_HEADER` build setting) instead.
// For either AppDelegate language, if this plugin can't find its expected
// insertion points it logs a warning and leaves the file untouched rather
// than guessing further — a missed injection point never blocks anything
// (build still succeeds), it just quietly means calls won't ring while the
// app is backgrounded/killed until this is fixed.

const { withAppDelegate, withPodfile } = require('expo/config-plugins');

const MARKER = 'withVoipPushKit';

// Gives react-native-callkeep / react-native-voip-push-notification a
// proper Clang module map so Swift's `import RNCallKeep` / `import
// RNVoipPushNotification` (used by the AppDelegate.swift injection below)
// actually resolves — CocoaPods doesn't generate one for a pod by default.
// Scoped to just these two pods (not a project-wide `use_modular_headers!`)
// to avoid any side effects on other pods' own build settings.
//
// MUST include an explicit :path to the same node_modules podspec autolinking
// already uses — confirmed via a real EAS build log that autolinking resolves
// these to ../node_modules/react-native-callkeep (podspec name `RNCallKeep`)
// and ../node_modules/react-native-voip-push-notification (podspec name
// `RNVoipPushNotification`). Without :path, this line reads as a second,
// unrelated dependency on the *same pod name* to be fetched from the CocoaPods
// trunk spec repo — which fails immediately with "Unable to find a
// specification for `RNCallKeep`" since neither pod is published there; it's
// a local-only, autolinked pod.
const PODFILE_MODULAR_HEADERS = `  pod 'RNCallKeep', :path => '../node_modules/react-native-callkeep', :modular_headers => true
  pod 'RNVoipPushNotification', :path => '../node_modules/react-native-voip-push-notification', :modular_headers => true
`;

function injectPodfileModularHeaders(contents) {
  if (contents.includes(MARKER)) return contents; // already injected
  const targetLineMatch = contents.match(/^target ['"][^'"]+['"] do[ \t]*\n/m);
  if (!targetLineMatch) {
    console.warn(`[${MARKER}] Could not find "target '<name>' do" in the Podfile — modular_headers not injected for RNCallKeep/RNVoipPushNotification.`);
    return contents;
  }
  const marker = `  # ===== Injected by plugins/${MARKER}.js — do not hand-edit =====\n`;
  return contents.replace(targetLineMatch[0], targetLineMatch[0] + marker + PODFILE_MODULAR_HEADERS);
}

const OBJC_IMPORTS = `#import <PushKit/PushKit.h>
#import "RNVoipPushNotificationManager.h"
#import <RNCallKeep/RNCallKeep.h>
`;

const OBJC_VOIP_REGISTRATION_CALL = '  [RNVoipPushNotificationManager voipRegistration];\n';

const OBJC_DELEGATE_METHODS = `
// ===== Injected by plugins/${MARKER}.js — do not hand-edit, it is =====
// ===== regenerated on every prebuild. See that file for why this exists. =====
- (void)pushRegistry:(PKPushRegistry *)registry didUpdatePushCredentials:(PKPushCredentials *)credentials forType:(PKPushType)type {
  [RNVoipPushNotificationManager didUpdatePushCredentials:credentials forType:(NSString *)type];
}

- (void)pushRegistry:(PKPushRegistry *)registry didInvalidatePushTokenForType:(PKPushType)type {
}

- (void)pushRegistry:(PKPushRegistry *)registry didReceiveIncomingPushWithPayload:(PKPushPayload *)payload forType:(PKPushType)type withCompletionHandler:(void (^)(void))completion {
  NSDictionary *info = payload.dictionaryPayload;
  NSString *uuid = info[@"callId"];
  NSString *callerName = info[@"callerName"] ?: @"Unknown caller";

  [RNVoipPushNotificationManager addCompletionHandler:uuid completionHandler:completion];
  [RNVoipPushNotificationManager didReceiveIncomingPushWithPayload:payload forType:(NSString *)type];

  [RNCallKeep reportNewIncomingCall:uuid
                             handle:uuid
                         handleType:@"generic"
                           hasVideo:NO
                localizedCallerName:callerName
                    supportsHolding:NO
                       supportsDTMF:NO
                   supportsGrouping:NO
                 supportsUngrouping:NO
                        fromPushKit:YES
                            payload:info
              withCompletionHandler:^{}];

  completion();
}
// ===== End injected block =====
`;

function injectObjc(contents) {
  let next = contents;

  // Imports: right after the first #import line, whatever it is.
  next = next.replace(/#import .*\n/, (match) => match + OBJC_IMPORTS);

  // voipRegistration(): first line inside didFinishLaunchingWithOptions's body.
  const hadRegistrationTarget = /didFinishLaunchingWithOptions:\([^)]*\)[^{]*\{\n/.test(next);
  next = next.replace(
    /(didFinishLaunchingWithOptions:\([^)]*\)[^{]*\{\n)/,
    (match) => match + OBJC_VOIP_REGISTRATION_CALL
  );

  // Delegate methods: just before the final @end of the file.
  const lastEnd = next.lastIndexOf('@end');
  if (lastEnd === -1) {
    console.warn(`[${MARKER}] Could not find "@end" in AppDelegate.m(m) — native VoIP wiring not injected.`);
    return contents;
  }
  if (!hadRegistrationTarget) {
    console.warn(`[${MARKER}] Could not find didFinishLaunchingWithOptions: in AppDelegate.m(m) — voipRegistration() not called; PushKit registration won't happen.`);
  }
  next = next.slice(0, lastEnd) + OBJC_DELEGATE_METHODS + '\n' + next.slice(lastEnd);
  return next;
}

const SWIFT_IMPORTS = `import PushKit
import RNVoipPushNotification
import RNCallKeep
`;

const SWIFT_VOIP_REGISTRATION_CALL = '    RNVoipPushNotificationManager.voipRegistration()\n';

const SWIFT_DELEGATE_EXTENSION = `
// ===== Injected by plugins/${MARKER}.js — do not hand-edit, it is =====
// ===== regenerated on every prebuild. See that file for why this exists. =====
extension AppDelegate: PKPushRegistryDelegate {
  func pushRegistry(_ registry: PKPushRegistry, didUpdate credentials: PKPushCredentials, for type: PKPushType) {
    // Swift's ObjC importer applies "omit needless words" to
    // RNVoipPushNotificationManager's ObjC selector
    // \`didUpdatePushCredentials:forType:\` (its label textually contains the
    // param type name \`PushCredentials\`), so the Swift-visible name is
    // \`didUpdate(_:forType:)\`, not the naive selector-shaped spelling.
    // Confirmed via a real Xcode build error: "'didUpdatePushCredentials(_:forType:)'
    // has been renamed to 'didUpdate(_:forType:)'".
    RNVoipPushNotificationManager.didUpdate(credentials, forType: type.rawValue)
  }

  func pushRegistry(_ registry: PKPushRegistry, didInvalidatePushTokenFor type: PKPushType) {
  }

  func pushRegistry(_ registry: PKPushRegistry, didReceiveIncomingPushWith payload: PKPushPayload, for type: PKPushType, completion: @escaping () -> Void) {
    let info = payload.dictionaryPayload
    let uuid = (info["callId"] as? String) ?? UUID().uuidString
    let callerName = (info["callerName"] as? String) ?? "Unknown caller"

    RNVoipPushNotificationManager.addCompletionHandler(uuid, completionHandler: completion)
    RNVoipPushNotificationManager.didReceiveIncomingPush(with: payload, forType: type.rawValue)

    RNCallKeep.reportNewIncomingCall(
      uuid,
      handle: uuid,
      handleType: "generic",
      hasVideo: false,
      localizedCallerName: callerName,
      supportsHolding: false,
      supportsDTMF: false,
      supportsGrouping: false,
      supportsUngrouping: false,
      fromPushKit: true,
      payload: info,
      withCompletionHandler: {}
    )

    completion()
  }
}
// ===== End injected block =====
`;

function injectSwift(contents) {
  let next = contents;

  // Imports: right after the first import line, whatever it is.
  next = next.replace(/import .*\n/, (match) => match + SWIFT_IMPORTS);

  // voipRegistration(): first line inside didFinishLaunchingWithOptions's body.
  // Matches Expo's standard Swift AppDelegate signature:
  //   func application(_ application: UIApplication, didFinishLaunchingWithOptions ...) -> Bool {
  const hadRegistrationTarget = /didFinishLaunchingWithOptions[^{]*\{\n/.test(next);
  next = next.replace(
    /(didFinishLaunchingWithOptions[^{]*\{\n)/,
    (match) => match + SWIFT_VOIP_REGISTRATION_CALL
  );
  if (!hadRegistrationTarget) {
    console.warn(`[${MARKER}] Could not find didFinishLaunchingWithOptions in AppDelegate.swift — voipRegistration() not called; PushKit registration won't happen.`);
  }

  // Delegate conformance: a plain top-level extension appended at file end —
  // Swift files have no closing "@end" marker to insert before.
  return next + '\n' + SWIFT_DELEGATE_EXTENSION;
}

function withVoipAppDelegate(config) {
  return withAppDelegate(config, (config) => {
    const { language, contents } = config.modResults;

    if (contents.includes(MARKER)) {
      // Already injected (re-running prebuild without a clean) — don't duplicate.
      return config;
    }

    if (language === 'objc' || language === 'objcpp') {
      config.modResults.contents = injectObjc(contents);
    } else if (language === 'swift') {
      config.modResults.contents = injectSwift(contents);
    } else {
      console.warn(
        `[${MARKER}] AppDelegate language '${language}' is not objc/objcpp/swift — this plugin ` +
        "doesn't know how to patch it. Skipping VoIP push/CallKeep native wiring; incoming calls " +
        'will not ring while the app is backgrounded/killed on iOS until this is handled.'
      );
    }

    return config;
  });
}

function withVoipPodfile(config) {
  return withPodfile(config, (config) => {
    config.modResults.contents = injectPodfileModularHeaders(config.modResults.contents);
    return config;
  });
}

module.exports = function withVoipPushKit(config) {
  config = withVoipAppDelegate(config);
  config = withVoipPodfile(config);
  return config;
};
