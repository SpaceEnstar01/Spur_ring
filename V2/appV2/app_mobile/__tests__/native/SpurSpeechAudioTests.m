#import <Foundation/Foundation.h>
#import <AVFoundation/AVFoundation.h>
#import "../../native-sdk/ios/SpurSpeechAudio.h"

static NSURL *fixture(NSURL *root, NSString *name, double seconds, BOOL silent) {
    NSURL *url = [root URLByAppendingPathComponent:name];
    AVAudioFormat *format = [[AVAudioFormat alloc] initWithCommonFormat:AVAudioPCMFormatFloat32
        sampleRate:44100 channels:2 interleaved:NO];
    NSError *error = nil;
    AVAudioFile *file = [[AVAudioFile alloc] initForWriting:url settings:format.settings error:&error];
    NSCAssert(file && !error, @"Create synthetic audio");
    AVAudioFrameCount frames = seconds * 44100;
    AVAudioPCMBuffer *buffer = [[AVAudioPCMBuffer alloc] initWithPCMFormat:format frameCapacity:frames];
    buffer.frameLength = frames;
    for (AVAudioFrameCount n = 0; n < frames; n++) {
        float sample = silent ? 0 : 0.1 * sin(2 * M_PI * 440 * n / 44100);
        buffer.floatChannelData[0][n] = sample; buffer.floatChannelData[1][n] = sample;
    }
    NSCAssert([file writeFromBuffer:buffer error:&error], @"Write fixture");
    return url;
}
int main(void) {
    @autoreleasepool {
        NSFileManager *fm = NSFileManager.defaultManager;
        NSURL *root = [NSURL fileURLWithPath:[NSTemporaryDirectory() stringByAppendingPathComponent:NSUUID.UUID.UUIDString]];
        [fm createDirectoryAtURL:root withIntermediateDirectories:YES attributes:nil error:nil];
        NSURL *source = fixture(root, @"stereo.caf", 47, NO);
        NSData *original = [NSData dataWithContentsOfURL:source];
        NSURL *chunks = [root URLByAppendingPathComponent:@"chunks"];
        NSError *error = nil;
        NSArray<NSURL *> *urls = SpurPrepareSpeechAudio(source, chunks, ^BOOL{ return NO; }, &error);
        NSCAssert(urls.count == 2 && !error, @"Long input splits into bounded chunks");
        double duration = 0;
        for (NSURL *url in urls) {
            AVAudioFile *file = [[AVAudioFile alloc] initForReading:url error:&error];
            NSCAssert(file.processingFormat.channelCount == 1 && file.processingFormat.sampleRate == 16000,
                @"Normalize stereo 44.1k into mono 16k");
            double seconds = (double)file.length / file.processingFormat.sampleRate;
            NSCAssert(seconds <= 45.01, @"Do not exceed a recognition chunk");
            duration += seconds;
        }
        NSCAssert(fabs(duration - 47) < 0.1, @"Do not truncate decoded speech");
        NSCAssert([original isEqual:[NSData dataWithContentsOfURL:source]], @"Source is unchanged");
        NSURL *cancelled = [root URLByAppendingPathComponent:@"cancelled"];
        NSCAssert(SpurPrepareSpeechAudio(source, cancelled, ^BOOL{ return YES; }, &error) == nil,
            @"Cancelled preparation stops");
        NSCAssert(![fm fileExistsAtPath:cancelled.path], @"Cancelled temp files removed");
        NSURL *silence = fixture(root, @"silence.caf", 1, YES);
        NSCAssert(SpurPrepareSpeechAudio(silence, [root URLByAppendingPathComponent:@"silent"], nil, &error) == nil,
            @"Do not submit digital silence");
        NSCAssert(error.code == 5, @"Distinguish silent audio");
        NSURL *aac = [root URLByAppendingPathComponent:@"phone.m4a"];
        NSDictionary *aacSettings = @{AVFormatIDKey:@(kAudioFormatMPEG4AAC), AVSampleRateKey:@16000,
            AVNumberOfChannelsKey:@1, AVEncoderBitRateKey:@32000};
        AVAudioFile *aacFile = [[AVAudioFile alloc] initForWriting:aac settings:aacSettings
            commonFormat:AVAudioPCMFormatFloat32 interleaved:NO error:&error];
        AVAudioPCMBuffer *voice = [[AVAudioPCMBuffer alloc] initWithPCMFormat:aacFile.processingFormat frameCapacity:48000];
        voice.frameLength = 48000;
        for (AVAudioFrameCount n = 0; n < 48000; n++)
            voice.floatChannelData[0][n] = 0.1 * sin(2 * M_PI * 440 * n / 16000);
        NSCAssert([aacFile writeFromBuffer:voice error:&error], @"Write same codec as phone recording");
        aacFile = nil; error = nil;
        urls = SpurPrepareSpeechAudio(aac, [root URLByAppendingPathComponent:@"aac"], nil, &error);
        NSCAssert(urls.count == 1 && !error, @"AAC phone recording decodes for local speech");
        [fm removeItemAtURL:root error:nil];
        puts("Local speech normalization, duration, silence, cancellation and source preservation passed");
    }
}
