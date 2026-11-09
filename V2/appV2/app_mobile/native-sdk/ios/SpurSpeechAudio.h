#pragma once
#import <Foundation/Foundation.h>
#import <AVFoundation/AVFoundation.h>
#include <math.h>

// Decode on the device into bounded, mono PCM chunks. Never modify the source.
static inline NSArray<NSURL *> *SpurPrepareSpeechAudio(NSURL *source, NSURL *directory,
        BOOL (^cancelled)(void), NSError **error) {
    NSFileManager *fm = NSFileManager.defaultManager;
    NSError *failure = nil;
    AVAudioFile *input = [[AVAudioFile alloc] initForReading:source error:&failure];
    if (!input || input.length <= 0 || input.processingFormat.sampleRate <= 0) {
        if (error) *error = [NSError errorWithDomain:@"SpurSpeechAudio" code:1
            userInfo:@{NSLocalizedDescriptionKey: @"录音无法解码或没有有效音频帧；原录音仍保留。"}];
        return nil;
    }
    if ((double)input.length / input.processingFormat.sampleRate > 3600) {
        if (error) *error = [NSError errorWithDomain:@"SpurSpeechAudio" code:2
            userInfo:@{NSLocalizedDescriptionKey: @"录音超过一小时，请分段后识别；原录音仍保留。"}];
        return nil;
    }
    AVAudioFormat *format = [[AVAudioFormat alloc] initWithCommonFormat:AVAudioPCMFormatFloat32
        sampleRate:16000 channels:1 interleaved:NO];
    AVAudioConverter *converter = [[AVAudioConverter alloc] initFromFormat:input.processingFormat toFormat:format];
    if (!converter || ![fm createDirectoryAtURL:directory withIntermediateDirectories:YES attributes:nil error:&failure]) {
        if (error) *error = [NSError errorWithDomain:@"SpurSpeechAudio" code:3
            userInfo:@{NSLocalizedDescriptionKey: @"无法准备本机识别音频，请检查可用存储空间。"}];
        return nil;
    }
    NSDictionary *settings = @{AVFormatIDKey:@(kAudioFormatLinearPCM), AVSampleRateKey:@16000,
        AVNumberOfChannelsKey:@1, AVLinearPCMBitDepthKey:@16, AVLinearPCMIsFloatKey:@NO,
        AVLinearPCMIsBigEndianKey:@NO, AVLinearPCMIsNonInterleaved:@NO};
    NSMutableArray<NSURL *> *chunks = [NSMutableArray new];
    AVAudioFile *output = nil;
    NSURL *chunkURL = nil;
    AVAudioFrameCount chunkFrames = 0;
    const AVAudioFrameCount chunkLimit = 45 * 16000;
    BOOL chunkHasSignal = NO;
    NSUInteger index = 0, stalled = 0;
    __block BOOL ended = NO;
    __block NSError *readFailure = nil;
    while (!failure) {
        @autoreleasepool {
            if (cancelled && cancelled()) {
                failure = [NSError errorWithDomain:@"SpurSpeechAudio" code:4
                    userInfo:@{NSLocalizedDescriptionKey:@"本机识别已取消"}]; break;
            }
            AVAudioFramePosition before = input.framePosition;
            AVAudioPCMBuffer *buffer = [[AVAudioPCMBuffer alloc] initWithPCMFormat:format frameCapacity:4096];
            AVAudioConverterOutputStatus status = [converter convertToBuffer:buffer error:&failure
                withInputFromBlock:^AVAudioBuffer *(AVAudioPacketCount packets, AVAudioConverterInputStatus *state) {
                    if (ended || input.framePosition >= input.length) {
                        ended = YES; *state = AVAudioConverterInputStatus_EndOfStream; return nil;
                    }
                    AVAudioPCMBuffer *part = [[AVAudioPCMBuffer alloc] initWithPCMFormat:input.processingFormat
                        frameCapacity:(AVAudioFrameCount)MIN(input.length - input.framePosition, MAX(1, MIN(packets, 4096)))];
                    if (!part || ![input readIntoBuffer:part error:&readFailure] || part.frameLength == 0) {
                        ended = YES; *state = AVAudioConverterInputStatus_EndOfStream; return nil;
                    }
                    *state = AVAudioConverterInputStatus_HaveData; return part;
                }];
            if (failure || readFailure || status == AVAudioConverterOutputStatus_Error) {
                failure = failure ?: readFailure ?: [NSError errorWithDomain:@"SpurSpeechAudio" code:3 userInfo:nil]; break;
            }
            AVAudioFrameCount offset = 0;
            while (offset < buffer.frameLength && !failure) {
                if (!output) {
                    chunkURL = [directory URLByAppendingPathComponent:[NSString stringWithFormat:@"chunk-%lu.caf", (unsigned long)index++]];
                    output = [[AVAudioFile alloc] initForWriting:chunkURL settings:settings
                        commonFormat:AVAudioPCMFormatFloat32 interleaved:NO error:&failure];
                    if (!output) break;
                    chunkFrames = 0; chunkHasSignal = NO;
                }
                AVAudioFrameCount count = MIN(buffer.frameLength - offset, chunkLimit - chunkFrames);
                AVAudioPCMBuffer *slice = [[AVAudioPCMBuffer alloc] initWithPCMFormat:format frameCapacity:count];
                if (!slice) { failure = [NSError errorWithDomain:@"SpurSpeechAudio" code:3 userInfo:nil]; break; }
                slice.frameLength = count;
                memcpy(slice.floatChannelData[0], buffer.floatChannelData[0] + offset, count * sizeof(float));
                for (AVAudioFrameCount n = 0; n < count; n++)
                    if (fabsf(slice.floatChannelData[0][n]) > 0.0000001f) chunkHasSignal = YES;
                if (![output writeFromBuffer:slice error:&failure]) break;
                offset += count; chunkFrames += count;
                if (chunkFrames == chunkLimit) {
                    output = nil; // Close the CAF before Speech opens it.
                    if (chunkHasSignal) [chunks addObject:chunkURL];
                    else [fm removeItemAtURL:chunkURL error:nil]; // Only exact digital silence.
                }
            }
            if (status == AVAudioConverterOutputStatus_EndOfStream) break;
            stalled = buffer.frameLength == 0 && input.framePosition == before ? stalled + 1 : 0;
            if (stalled > 4) failure = [NSError errorWithDomain:@"SpurSpeechAudio" code:3 userInfo:nil];
        }
    }
    if (output) {
        output = nil;
        if (chunkHasSignal) [chunks addObject:chunkURL];
        else [fm removeItemAtURL:chunkURL error:nil];
    }
    if (!failure && chunks.count == 0) failure = [NSError errorWithDomain:@"SpurSpeechAudio" code:5
        userInfo:@{NSLocalizedDescriptionKey:@"录音解码后是空音频或数字静音，未交给听写引擎；原录音仍保留。"}];
    if (failure) {
        [fm removeItemAtURL:directory error:nil];
        if (error) *error = [NSError errorWithDomain:@"SpurSpeechAudio" code:failure.code
            userInfo:@{NSLocalizedDescriptionKey: [failure.domain isEqualToString:@"SpurSpeechAudio"] && failure.localizedDescription.length
                ? failure.localizedDescription : @"录音解码失败，原录音仍保留；请尝试重新录制或检查录音格式。"}];
        return nil;
    }
    return chunks;
}
