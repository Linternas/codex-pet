#include <unistd.h>
#import <Cocoa/Cocoa.h>
#import <Sparkle/Sparkle.h>

static void emit(NSDictionary *event) {
  NSData *data = [NSJSONSerialization dataWithJSONObject:event options:0 error:nil];
  if (data) {
    [[NSFileHandle fileHandleWithStandardOutput] writeData:data];
    [[NSFileHandle fileHandleWithStandardOutput] writeData:[@"\n" dataUsingEncoding:NSUTF8StringEncoding]];
  }
}

@interface UpdateDriver : NSObject <SPUUserDriver>
@property(copy) void (^choice)(SPUUserUpdateChoice);
@property(copy) NSString *version;
@property uint64_t expected;
@property uint64_t received;
@property BOOL installing;
- (void)command:(NSString *)command;
@end

@implementation UpdateDriver
- (void)status:(NSString *)kind {
  NSMutableDictionary *value = [@{@"kind": kind} mutableCopy];
  if (self.version) value[@"version"] = self.version;
  emit(value);
}
- (void)command:(NSString *)command {
  if (self.choice && ([command isEqual:@"download"] || [command isEqual:@"install"])) {
    void (^reply)(SPUUserUpdateChoice) = self.choice;
    self.choice = nil;
    reply(SPUUserUpdateChoiceInstall);
  }
}
- (void)showUpdatePermissionRequest:(SPUUpdatePermissionRequest *)request reply:(void (^)(SUUpdatePermissionResponse *))reply {
  reply([[SUUpdatePermissionResponse alloc] initWithAutomaticUpdateChecks:NO sendSystemProfile:NO]);
}
- (void)showUserInitiatedUpdateCheckWithCancellation:(void (^)(void))cancellation { [self status:@"checking"]; }
- (void)showUpdateFoundWithAppcastItem:(SUAppcastItem *)item state:(SPUUserUpdateState *)state reply:(void (^)(SPUUserUpdateChoice))reply {
  self.version = item.displayVersionString;
  if (item.informationOnlyUpdate) {
    emit(@{@"kind": @"error", @"message": @"이 버전은 수동 설치가 필요합니다. GitHub 릴리스를 확인하세요."});
    reply(SPUUserUpdateChoiceDismiss);
    return;
  }
  self.choice = reply;
  [self status:state.stage == SPUUserUpdateStageInstalling ? @"ready" : @"available"];
}
- (void)showUpdateReleaseNotesWithDownloadData:(SPUDownloadData *)data {}
- (void)showUpdateReleaseNotesFailedToDownloadWithError:(NSError *)error {}
- (void)showUpdateNotFoundWithError:(NSError *)error acknowledgement:(void (^)(void))acknowledgement {
  SUAppcastItem *item = error.userInfo[SPULatestAppcastItemFoundKey];
  if (item) self.version = item.displayVersionString;
  NSNumber *reason = error.userInfo[SPUNoUpdateFoundReasonKey];
  if (reason.integerValue == SPUNoUpdateFoundReasonOnLatestVersion || reason.integerValue == SPUNoUpdateFoundReasonOnNewerThanLatestVersion) [self status:@"current"];
  else emit(@{@"kind": @"error", @"message": error.localizedDescription ?: @"호환되는 업데이트가 없습니다."});
  acknowledgement();
}
- (void)showUpdaterError:(NSError *)error acknowledgement:(void (^)(void))acknowledgement {
  self.choice = nil;
  emit(@{@"kind": @"error", @"message": error.localizedDescription ?: @"업데이트를 완료하지 못했습니다."});
  acknowledgement();
}
- (void)showDownloadInitiatedWithCancellation:(void (^)(void))cancellation {
  self.expected = 0; self.received = 0;
  [self status:@"downloading"];
}
- (void)showDownloadDidReceiveExpectedContentLength:(uint64_t)length { self.expected = length; }
- (void)showDownloadDidReceiveDataOfLength:(uint64_t)length {
  self.received += length;
  NSMutableDictionary *value = [@{@"kind": @"downloading", @"version": self.version ?: @""} mutableCopy];
  if (self.expected > 0) value[@"progress"] = @(MIN(100, 100.0 * self.received / self.expected));
  emit(value);
}
- (void)showDownloadDidStartExtractingUpdate { [self status:@"verifying"]; }
- (void)showExtractionReceivedProgress:(double)progress {}
- (void)showReadyToInstallAndRelaunch:(void (^)(SPUUserUpdateChoice))reply {
  self.choice = reply;
  [self status:@"ready"];
}
- (void)showInstallingUpdateWithApplicationTerminated:(BOOL)terminated retryTerminatingApplication:(void (^)(void))retry {
  self.installing = YES;
  [self status:@"installing"];
}
- (void)showUpdateInstalledAndRelaunched:(BOOL)relaunched acknowledgement:(void (^)(void))acknowledgement {
  [self status:@"installed"];
  acknowledgement();
  [NSApp terminate:nil];
}
- (void)dismissUpdateInstallation { self.choice = nil; }
@end

int main(int argc, const char *argv[]) {
  @autoreleasepool {
    if (argc != 2) return 2;
    NSBundle *host = [NSBundle bundleWithPath:[NSString stringWithUTF8String:argv[1]]];
    if (!host || ![host objectForInfoDictionaryKey:@"SUPublicEDKey"]) return 2;
    [NSApplication sharedApplication];
    [NSApp setActivationPolicy:NSApplicationActivationPolicyProhibited];
    UpdateDriver *driver = [UpdateDriver new];
    SPUUpdater *updater = [[SPUUpdater alloc] initWithHostBundle:host applicationBundle:host userDriver:driver delegate:nil];
    NSError *error = nil;
    if (![updater startUpdater:&error]) {
      emit(@{@"kind": @"error", @"message": error.localizedDescription ?: @"업데이트를 시작하지 못했습니다."});
      return 1;
    }
    dispatch_async(dispatch_get_global_queue(QOS_CLASS_UTILITY, 0), ^{
      // Avoid stdio's stdin lock: Foundation's XPath parser also accesses stdin.
      char bytes[256];
      ssize_t count;
      NSMutableString *pending = [NSMutableString new];
      while ((count = read(STDIN_FILENO, bytes, sizeof(bytes))) > 0) {
        NSString *chunk = [[NSString alloc] initWithBytes:bytes length:(NSUInteger)count encoding:NSUTF8StringEncoding];
        if (!chunk) continue;
        [pending appendString:chunk];
        if (pending.length > 1024) break;
        NSRange newline;
        while ((newline = [pending rangeOfString:@"\n"]).location != NSNotFound) {
          NSString *command = [pending substringToIndex:newline.location];
          [pending deleteCharactersInRange:NSMakeRange(0, newline.location + 1)];
          dispatch_async(dispatch_get_main_queue(), ^{
            if ([command isEqual:@"check"] && updater.canCheckForUpdates) [updater checkForUpdates];
            else [driver command:command];
          });
        }
      }
      dispatch_async(dispatch_get_main_queue(), ^{ if (!driver.installing) [NSApp terminate:nil]; });
    });
    [NSApp run];
  }
  return 0;
}
