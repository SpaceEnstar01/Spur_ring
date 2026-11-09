#import <Foundation/Foundation.h>
#import "../../native-sdk/ios/SpurRecordingPaths.h"

int main(void) {
    @autoreleasepool {
        NSFileManager *fm = NSFileManager.defaultManager;
        NSURL *base = [NSURL fileURLWithPath:[NSTemporaryDirectory() stringByAppendingPathComponent:NSUUID.UUID.UUIDString] isDirectory:YES];
        NSURL *root = [base URLByAppendingPathComponent:@"voice-recordings" isDirectory:YES];
        [fm createDirectoryAtURL:root withIntermediateDirectories:YES attributes:nil error:nil];
        NSURL *file = [root URLByAppendingPathComponent:@"ring.m4a"];
        [@"synthetic test fixture" writeToURL:file atomically:YES encoding:NSUTF8StringEncoding error:nil];
        NSString *old = @"file:///var/mobile/Containers/Data/Application/8549FDFF-2C95-4C9D-BCBA-E7525F7168B9/Documents/voice-recordings/ring.m4a";
        NSCAssert([SpurResolveRecordingURL(old, root).path isEqualToString:file.URLByResolvingSymlinksInPath.path], @"Relocate old ring audio");
        NSCAssert(SpurResolveRecordingURL(file.absoluteString, root) != nil, @"Current phone recording");
        NSCAssert(SpurResolveRecordingURL([old stringByReplacingOccurrencesOfString:@"ring.m4a" withString:@"phone-123.m4a"], root) != nil, @"Relocate phone audio");
        for (NSString *invalid in @[@"https://example.com/ring.m4a", @"file://remote/voice-recordings/ring.m4a", @"file:///etc/ring.m4a", @"file:///var/mobile/Containers/Data/Application/8549FDFF-2C95-4C9D-BCBA-E7525F7168B9/Documents/voice-recordings/../private.m4a", @"file:///var/mobile/Containers/Data/Application/8549FDFF-2C95-4C9D-BCBA-E7525F7168B9/Documents/voice-recordings/private.json"]) {
            NSCAssert(SpurResolveRecordingURL(invalid, root) == nil, @"Reject unsafe path: %@", invalid);
        }
        NSURL *outside = [base URLByAppendingPathComponent:@"outside.m4a"];
        [@"must not be removed" writeToURL:outside atomically:YES encoding:NSUTF8StringEncoding error:nil];
        NSURL *link = [root URLByAppendingPathComponent:@"link.m4a"];
        [fm createSymbolicLinkAtPath:link.path withDestinationPath:outside.path error:nil];
        NSCAssert(SpurResolveRecordingURL(link.absoluteString, root) == nil, @"Block symlink escape");
        NSCAssert(SpurResolveRecordingURL([old stringByReplacingOccurrencesOfString:@"ring.m4a" withString:@"link.m4a"], root) == nil, @"Block rebased symlink escape");
        [fm removeItemAtURL:SpurResolveRecordingURL(old, root) error:nil];
        NSCAssert(![fm fileExistsAtPath:file.path] && [fm fileExistsAtPath:outside.path], @"Delete only resolved fixture");
        NSCAssert(SpurResolveRecordingURL(old, root) != nil, @"Missing managed file can remove stale metadata");
        [fm removeItemAtURL:base error:nil];
        puts("Recording path relocation and safety tests passed");
    }
}
