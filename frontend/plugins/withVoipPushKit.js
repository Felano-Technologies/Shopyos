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
// CAVEAT: this targets an Objective-C/Objective-C++ AppDelegate (SDK 57's
// common default: AppDelegate.mm). It has NOT been verified against a real
// `expo prebuild`/EAS build output in this environment (no native build
// tooling available here) — if your project generates a Swift AppDelegate
// instead, `modResults.language` below will be 'swift', this plugin will
// warn and skip modification rather than risk corrupting a file it can't
// correctly patch, and someone will need to add the Swift equivalent (a
// `PKPushRegistryDelegate` extension on AppDelegate). Verify by running a
// build and checking the build log for the warning below, or by opening
// the generated ios/<name>/AppDelegate.* file after `expo prebuild`.

const { withAppDelegate } = require('expo/config-plugins');

const IMPORTS = `#import <PushKit/PushKit.h>
#import "RNVoipPushNotificationManager.h"
#import <RNCallKeep/RNCallKeep.h>
`;

const VOIP_REGISTRATION_CALL = '  [RNVoipPushNotificationManager voipRegistration];\n';

const DELEGATE_METHODS = `
// ===== Injected by plugins/withVoipPushKit.js — do not hand-edit, it is =====
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

module.exports = function withVoipPushKit(config) {
  return withAppDelegate(config, (config) => {
    const { language, contents } = config.modResults;

    if (language !== 'objc' && language !== 'objcpp') {
      console.warn(
        `[withVoipPushKit] AppDelegate is '${language}', not objc/objcpp — this plugin only ` +
        'knows how to patch Objective-C(++). Skipping VoIP push/CallKeep native wiring; ' +
        'incoming calls will not ring while the app is backgrounded/killed on iOS until a ' +
        'Swift equivalent is added. See the comment at the top of plugins/withVoipPushKit.js.'
      );
      return config;
    }

    if (contents.includes('withVoipPushKit')) {
      // Already injected (re-running prebuild without a clean) — don't duplicate.
      return config;
    }

    let next = contents;

    // Imports: right after the first #import line, whatever it is.
    next = next.replace(/#import .*\n/, (match) => match + IMPORTS);

    // voipRegistration(): first line inside didFinishLaunchingWithOptions's body.
    next = next.replace(
      /(didFinishLaunchingWithOptions:\([^)]*\)[^\{]*\{\n)/,
      (match) => match + VOIP_REGISTRATION_CALL
    );

    // Delegate methods: just before the final @end of the file.
    const lastEnd = next.lastIndexOf('@end');
    if (lastEnd !== -1) {
      next = next.slice(0, lastEnd) + DELEGATE_METHODS + '\n' + next.slice(lastEnd);
    } else {
      console.warn('[withVoipPushKit] Could not find "@end" in AppDelegate — native VoIP wiring not injected.');
    }

    config.modResults.contents = next;
    return config;
  });
};
