#pragma once
#import <Foundation/Foundation.h>

// Never access the old sandbox. Accept only our managed audio directory (or a
// historic iPhone container path), then resolve the file into this installation.
static inline NSURL *SpurResolveRecordingURL(NSString *uri, NSURL *directory) {
    NSURL *input = [NSURL URLWithString:uri];
    if (!input.isFileURL || input.host.length || input.query.length || input.fragment.length) return nil;
    if ([input.path.pathComponents containsObject:@".."] || [input.path.pathComponents containsObject:@"."]) return nil;
    NSURL *root = directory.URLByStandardizingPath.URLByResolvingSymlinksInPath;
    NSURL *original = input.URLByStandardizingPath.URLByResolvingSymlinksInPath;
    if (![original.URLByDeletingLastPathComponent.path isEqualToString:root.path]) {
        NSString *pattern = @"^/(private/)?var/mobile/Containers/Data/Application/[0-9A-Fa-f-]{36}/Documents/voice-recordings/[^/]+$";
        if ([[NSRegularExpression regularExpressionWithPattern:pattern options:0 error:nil] numberOfMatchesInString:input.path options:0 range:NSMakeRange(0, input.path.length)] != 1) return nil;
        NSString *containerID = input.URLByDeletingLastPathComponent.URLByDeletingLastPathComponent.URLByDeletingLastPathComponent.lastPathComponent;
        if (![[NSUUID alloc] initWithUUIDString:containerID]) return nil;
    }
    NSString *name = input.lastPathComponent;
    if (![@[@"m4a", @"ogg", @"wav", @"aac", @"mp3"] containsObject:name.pathExtension.lowercaseString]) return nil;
    NSURL *target = [root URLByAppendingPathComponent:name].URLByStandardizingPath.URLByResolvingSymlinksInPath;
    if (![target.URLByDeletingLastPathComponent.path isEqualToString:root.path]) return nil;
    return target;
}
