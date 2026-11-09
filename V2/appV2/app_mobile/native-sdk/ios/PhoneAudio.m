#import <React/RCTBridgeModule.h>
#import <AVFoundation/AVFoundation.h>
#import <UIKit/UIKit.h>
#import <Speech/Speech.h>
#import <CoreBluetooth/CoreBluetooth.h>
#import "SpurRecordingPaths.h"
#import "SpurSpeechAudio.h"
#import "YanqiangRingSDK-Swift.h"

@interface PhoneAudio : NSObject <RCTBridgeModule, AVAudioRecorderDelegate, CBCentralManagerDelegate>
@property(nonatomic, strong) AVAudioRecorder *recorder;
@property(nonatomic, strong) AVAudioPlayer *player;
@property(nonatomic, strong) NSURL *pending;
@property(nonatomic) NSTimeInterval started;
@property(nonatomic, copy) NSString *failure;
@property(nonatomic, strong) SFSpeechRecognitionTask *speechTask;
@property(nonatomic, strong) SFSpeechRecognizer *speechRecognizer;
@property(nonatomic, copy) NSString *speechRequestId;
@property(nonatomic, copy) RCTPromiseRejectBlock speechReject;
@property(nonatomic, copy) RCTPromiseResolveBlock speechResolve;
@property(nonatomic, strong) NSProgress *speechProgress;
@property(nonatomic, strong) NSURL *speechDirectory;
@property(nonatomic, strong) NSArray<NSURL *> *speechChunks;
@property(nonatomic, strong) NSMutableArray<NSString *> *speechTexts;
@property(nonatomic) NSUInteger speechChunkIndex;
@property(nonatomic, copy) NSString *speechChunkToken;
@property(nonatomic, strong) NSTimer *speechTimer;
@property(nonatomic, strong) SpurFileSpeech *fileSpeech;
@property(nonatomic, strong) CBCentralManager *permissionCentral;
@property(nonatomic, strong) NSTimer *bluetoothPermissionTimer;
@property(nonatomic, copy) RCTPromiseResolveBlock bluetoothPermissionResolve;
@property(nonatomic, copy) RCTPromiseRejectBlock bluetoothPermissionReject;
@end

@implementation PhoneAudio
RCT_EXPORT_MODULE(PhoneAudio)
+ (BOOL)requiresMainQueueSetup { return YES; }
- (dispatch_queue_t)methodQueue { return dispatch_get_main_queue(); }
- (NSDictionary *)permissionSnapshot {
    SFSpeechRecognizer *recognizer = [[SFSpeechRecognizer alloc] initWithLocale:[NSLocale localeWithLocaleIdentifier:@"zh-CN"]];
    NSString *bluetooth = @"undetermined";
    switch (CBManager.authorization) {
        case CBManagerAuthorizationAllowedAlways: bluetooth = @"granted"; break;
        case CBManagerAuthorizationDenied: bluetooth = @"denied"; break;
        case CBManagerAuthorizationRestricted: bluetooth = @"restricted"; break;
        default: break;
    }
    if (self.permissionCentral && self.permissionCentral.state == CBManagerStateUnsupported) bluetooth = @"unsupported";
    return @{@"microphone": @([AVAudioSession sharedInstance].recordPermission == AVAudioSessionRecordPermissionGranted), @"speech": @([SFSpeechRecognizer authorizationStatus] == SFSpeechRecognizerAuthorizationStatusAuthorized), @"onDeviceAvailable": @(recognizer.supportsOnDeviceRecognition), @"bluetooth": bluetooth};
}
RCT_REMAP_METHOD(requestBluetoothPermissions, requestBluetoothPermissionsWithResolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
    if (self.bluetoothPermissionResolve) { reject(@"BLUETOOTH_BUSY", @"正在等待蓝牙权限确认", nil); return; }
    if (CBManager.authorization != CBManagerAuthorizationNotDetermined) { resolve([self permissionSnapshot]); return; }
    self.bluetoothPermissionResolve = resolve;
    self.bluetoothPermissionReject = reject;
    __weak PhoneAudio *weakSelf = self;
    self.bluetoothPermissionTimer = [NSTimer scheduledTimerWithTimeInterval:60 repeats:NO block:^(NSTimer *timer) {
        PhoneAudio *strongSelf = weakSelf;
        RCTPromiseRejectBlock pending = strongSelf.bluetoothPermissionReject;
        strongSelf.bluetoothPermissionResolve = nil; strongSelf.bluetoothPermissionReject = nil;
        strongSelf.bluetoothPermissionTimer = nil;
        if (pending) pending(@"BLUETOOTH_TIMEOUT", @"蓝牙权限确认尚未完成，可稍后重试或前往系统设置", nil);
    }];
    self.permissionCentral = [[CBCentralManager alloc] initWithDelegate:self queue:dispatch_get_main_queue() options:@{CBCentralManagerOptionShowPowerAlertKey: @NO}];
}
- (void)centralManagerDidUpdateState:(CBCentralManager *)central {
    if (central != self.permissionCentral || !self.bluetoothPermissionResolve || central.state == CBManagerStateUnknown || central.state == CBManagerStateResetting) return;
    RCTPromiseResolveBlock resolve = self.bluetoothPermissionResolve;
    self.bluetoothPermissionResolve = nil; self.bluetoothPermissionReject = nil;
    [self.bluetoothPermissionTimer invalidate]; self.bluetoothPermissionTimer = nil;
    resolve([self permissionSnapshot]);
}
RCT_REMAP_METHOD(requestPermissions, requestPermissionsWithResolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
    [[AVAudioSession sharedInstance] requestRecordPermission:^(BOOL granted) {
        [SFSpeechRecognizer requestAuthorization:^(SFSpeechRecognizerAuthorizationStatus status) {
            dispatch_async(dispatch_get_main_queue(), ^{ resolve([self permissionSnapshot]); });
        }];
    }];
}
RCT_REMAP_METHOD(getPermissions, getPermissionsWithResolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) { resolve([self permissionSnapshot]); }
RCT_REMAP_METHOD(transcribeRecording, transcribeRecordingURI:(NSString *)uri requestId:(NSString *)requestId resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
    if (self.speechRequestId) { reject(@"SPEECH_BUSY", @"正在识别另一条录音，请稍候", nil); return; }
    if ([SFSpeechRecognizer authorizationStatus] != SFSpeechRecognizerAuthorizationStatusAuthorized) { reject(@"SPEECH_PERMISSION", @"请在设置中允许 Spur 使用语音识别，再重试", nil); return; }
    NSURL *url = SpurResolveRecordingURL(uri, [self folder]);
    if (!url) { reject(@"SPEECH_FILE", @"无效的本机录音", nil); return; }
    SFSpeechRecognizer *recognizer = [[SFSpeechRecognizer alloc] initWithLocale:[NSLocale localeWithLocaleIdentifier:@"zh-CN"]];
    if (!recognizer.supportsOnDeviceRecognition) { reject(@"SPEECH_UNAVAILABLE", @"此设备的中文本地识别尚不可用，请在系统设置中启用中文听写、准备语言资源后重试。录音不会上传云端。", nil); return; }
    if (!recognizer.isAvailable) { reject(@"SPEECH_SERVICE", @"系统中文听写服务暂时不可用，请稍后重试；原录音仍保留。", nil); return; }
    [self.player stop];
    self.speechRecognizer = recognizer;
    self.speechRequestId = requestId; self.speechReject = reject; self.speechResolve = resolve;
    self.speechTexts = [NSMutableArray new]; self.speechChunkIndex = 0;
    NSProgress *progress = [NSProgress progressWithTotalUnitCount:1];
    self.speechProgress = progress;
    NSURL *directory = [NSURL fileURLWithPath:[NSTemporaryDirectory() stringByAppendingPathComponent:
        [@"spur-speech-" stringByAppendingString:NSUUID.UUID.UUIDString]] isDirectory:YES];
    self.speechDirectory = directory;
    dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
        NSError *error = nil;
        NSArray<NSURL *> *chunks = SpurPrepareSpeechAudio(url, directory, ^BOOL{ return progress.cancelled; }, &error);
        dispatch_async(dispatch_get_main_queue(), ^{
            if (![self.speechRequestId isEqualToString:requestId] || progress.cancelled) {
                [NSFileManager.defaultManager removeItemAtURL:directory error:nil]; return;
            }
            if (!chunks) {
                [self finishSpeech:nil code:@"SPEECH_AUDIO" message:error.localizedDescription]; return;
            }
            self.speechChunks = chunks;
            [self recognizeSpeechChunk:requestId];
        });
    });
}
- (void)finishSpeech:(NSString *)text code:(NSString *)code message:(NSString *)message {
    RCTPromiseResolveBlock resolve = self.speechResolve;
    RCTPromiseRejectBlock reject = self.speechReject;
    self.speechRequestId = nil; self.speechChunkToken = nil;
    self.speechResolve = nil; self.speechReject = nil;
    [self.speechTimer invalidate]; self.speechTimer = nil;
    [self.fileSpeech cancel]; self.fileSpeech = nil;
    [self.speechProgress cancel]; self.speechProgress = nil;
    [self.speechTask cancel]; self.speechTask = nil; self.speechRecognizer = nil;
    if (self.speechDirectory) [NSFileManager.defaultManager removeItemAtURL:self.speechDirectory error:nil];
    self.speechDirectory = nil; self.speechChunks = nil; self.speechTexts = nil;
    if (text.length && resolve) resolve(text);
    else if (reject) reject(code ?: @"SPEECH_FAILED", message ?: @"本机识别未完成，原录音仍保留。", nil);
}
- (void)recognizeSpeechChunk:(NSString *)requestId {
    if (![self.speechRequestId isEqualToString:requestId]) return;
    if (self.speechChunkIndex >= self.speechChunks.count) {
        [self finishSpeech:[self.speechTexts componentsJoinedByString:@"\n"] code:nil message:nil]; return;
    }
    NSString *token = NSUUID.UUID.UUIDString;
    self.speechChunkToken = token;
    SFSpeechURLRecognitionRequest *request = [[SFSpeechURLRecognitionRequest alloc]
        initWithURL:self.speechChunks[self.speechChunkIndex]];
    request.requiresOnDeviceRecognition = YES;
    request.shouldReportPartialResults = NO;
    request.taskHint = SFSpeechRecognitionTaskHintDictation;
    if (@available(iOS 16.0, *)) { request.addsPunctuation = YES; }
    __weak PhoneAudio *weakSelf = self;
    self.speechTimer = [NSTimer scheduledTimerWithTimeInterval:65 repeats:NO block:^(NSTimer *timer) {
        PhoneAudio *strongSelf = weakSelf;
        if ([strongSelf.speechChunkToken isEqualToString:token])
            [strongSelf finishSpeech:nil code:@"SPEECH_TIMEOUT" message:@"系统听写长时间未返回结果，已停止本次识别；原录音仍保留。"];
    }];
    self.speechTask = [self.speechRecognizer recognitionTaskWithRequest:request resultHandler:^(SFSpeechRecognitionResult *result, NSError *error) {
        dispatch_async(dispatch_get_main_queue(), ^{
            if (![self.speechRequestId isEqualToString:requestId] || ![self.speechChunkToken isEqualToString:token]) return;
            if (!error && !result.isFinal) return;
            NSString *text = [result.bestTranscription.formattedString stringByTrimmingCharactersInSet:NSCharacterSet.whitespaceAndNewlineCharacterSet];
            if (result.isFinal && text.length) {
                [self completeSpeechChunk:text requestId:requestId];
            } else if (error) {
                if ([error.domain isEqualToString:@"kLSRErrorDomain"] && error.code == 201) {
                    [self recognizeCompatibleSpeechChunk:requestId]; return;
                }
                NSString *domain = [@[@"kAFAssistantErrorDomain", @"kLSRErrorDomain", @"SFSpeechErrorDomain",
                    NSURLErrorDomain] containsObject:error.domain] ? error.domain : @"system";
                NSString *message = [NSString stringWithFormat:
                    @"系统听写未完成（%@/%ld，第%lu段）。请重试本机识别；原录音仍保留。",
                    domain, (long)error.code, (unsigned long)self.speechChunkIndex + 1];
                [self finishSpeech:nil code:@"SPEECH_SERVICE" message:message];
            } else [self finishSpeech:nil code:@"SPEECH_EMPTY"
                message:@"音频可以解码，但系统未识别出清晰语音；请核对说话音量、语言和背景噪声，原录音仍保留。"];
        });
    }];
}
- (void)completeSpeechChunk:(NSString *)text requestId:(NSString *)requestId {
    [self.speechTimer invalidate]; self.speechTimer = nil;
    [self.fileSpeech cancel]; self.fileSpeech = nil;
    self.speechChunkToken = nil; self.speechTask = nil;
    [self.speechTexts addObject:text];
    [NSFileManager.defaultManager removeItemAtURL:self.speechChunks[self.speechChunkIndex] error:nil];
    self.speechChunkIndex++;
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, 150 * NSEC_PER_MSEC), dispatch_get_main_queue(),
        ^{ [self recognizeSpeechChunk:requestId]; });
}
- (void)recognizeCompatibleSpeechChunk:(NSString *)requestId {
    // Invalidate the legacy callback before cancelling it. The new path gets one
    // attempt per chunk, shares the existing job cancellation, and stays offline.
    NSString *token = NSUUID.UUID.UUIDString;
    self.speechChunkToken = token;
    [self.speechTask cancel]; self.speechTask = nil;
    [self.speechTimer invalidate];
    __weak PhoneAudio *weakSelf = self;
    self.speechTimer = [NSTimer scheduledTimerWithTimeInterval:65 repeats:NO block:^(NSTimer *timer) {
        PhoneAudio *strongSelf = weakSelf;
        if ([strongSelf.speechChunkToken isEqualToString:token])
            [strongSelf finishSpeech:nil code:@"SPEECH_TIMEOUT" message:@"本机文件转写超时，原录音仍保留。"];
    }];
    self.fileSpeech = [SpurFileSpeech new];
    [self.fileSpeech recognizeURL:self.speechChunks[self.speechChunkIndex] completion:^(NSString *text, NSError *error) {
        PhoneAudio *strongSelf = weakSelf;
        if (![strongSelf.speechRequestId isEqualToString:requestId] || ![strongSelf.speechChunkToken isEqualToString:token]) return;
        if (!error && text.length) { [strongSelf completeSpeechChunk:text requestId:requestId]; return; }
        if (!error) {
            [strongSelf finishSpeech:nil code:@"SPEECH_EMPTY" message:@"本机文件转写未识别到文字，原录音仍保留。"];
            return;
        }
        // 201 describes a legacy service refusal, not proof the user disabled Siri.
        NSString *domain = [@[@"kAFAssistantErrorDomain", @"kLSRErrorDomain", @"SFSpeechErrorDomain"]
            containsObject:error.domain] ? error.domain : @"system";
        NSString *detail = [error.domain isEqualToString:@"SpurFileSpeech"] ? @"兼容识别资源尚不可用" :
            [NSString stringWithFormat:@"兼容识别未完成（%@/%ld）", domain, (long)error.code];
        [strongSelf finishSpeech:nil code:@"SPEECH_COMPATIBILITY" message:[NSString stringWithFormat:
            @"系统文件转写被拒绝（LSR/201），%@。即使键盘听写正常也可能出现此问题；原录音仍保留，请向我们反馈手机型号和 iOS 版本。", detail]];
    }];
}
RCT_EXPORT_METHOD(cancelTranscription:(NSString *)requestId) {
    if (![self.speechRequestId isEqualToString:requestId]) return;
    [self finishSpeech:nil code:@"SPEECH_CANCELLED" message:@"本机识别已取消"];
}
- (instancetype)init {
    if ((self = [super init])) {
        [[NSNotificationCenter defaultCenter] addObserver:self selector:@selector(finishCapture) name:UIApplicationDidEnterBackgroundNotification object:nil];
        [[NSNotificationCenter defaultCenter] addObserver:self selector:@selector(interruption:) name:AVAudioSessionInterruptionNotification object:nil];
    }
    return self;
}
- (NSURL *)folder {
    NSURL *url = [[[NSFileManager defaultManager] URLsForDirectory:NSDocumentDirectory inDomains:NSUserDomainMask].firstObject URLByAppendingPathComponent:@"voice-recordings" isDirectory:YES];
    [[NSFileManager defaultManager] createDirectoryAtURL:url withIntermediateDirectories:YES attributes:nil error:nil];
    return url;
}
- (void)finishCapture {
    [self.recorder stop];
    [self.player stop];
    [[AVAudioSession sharedInstance] setActive:NO withOptions:AVAudioSessionSetActiveOptionNotifyOthersOnDeactivation error:nil];
}
- (void)interruption:(NSNotification *)notification {
    if ([notification.userInfo[AVAudioSessionInterruptionTypeKey] unsignedIntegerValue] == AVAudioSessionInterruptionTypeBegan) [self finishCapture];
}
RCT_REMAP_METHOD(start, startWithResolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
    if (self.pending) { reject(@"BUSY", @"请先结束当前录音", nil); return; }
    if ([AVAudioSession sharedInstance].recordPermission != AVAudioSessionRecordPermissionGranted) {
        [[AVAudioSession sharedInstance] requestRecordPermission:^(BOOL granted) {
            dispatch_async(dispatch_get_main_queue(), ^{ if (granted) [self startWithResolver:resolve rejecter:reject]; else reject(@"PERMISSION", @"请在系统设置中允许麦克风权限", nil); });
        }];
        return;
    }
    [self.player stop];
    NSError *error = nil;
    AVAudioSession *session = [AVAudioSession sharedInstance];
    if (![session setCategory:AVAudioSessionCategoryPlayAndRecord mode:AVAudioSessionModeDefault options:AVAudioSessionCategoryOptionDefaultToSpeaker error:&error] || ![session setActive:YES error:&error]) {
        reject(@"RECORD", @"麦克风暂不可用", error); return;
    }
    self.started = NSDate.date.timeIntervalSince1970 * 1000;
    self.failure = nil;
    self.pending = [[self folder] URLByAppendingPathComponent:[NSString stringWithFormat:@"phone-%.0f.m4a", self.started]];
    self.recorder = [[AVAudioRecorder alloc] initWithURL:self.pending settings:@{AVFormatIDKey:@(kAudioFormatMPEG4AAC), AVSampleRateKey:@16000, AVNumberOfChannelsKey:@1, AVEncoderBitRateKey:@32000} error:&error];
    self.recorder.delegate = self;
    if (!self.recorder || ![self.recorder recordForDuration:600]) {
        [self discard]; reject(@"RECORD", @"无法启动录音，请检查麦克风是否被占用", error); return;
    }
    resolve(nil);
}
- (void)audioRecorderEncodeErrorDidOccur:(AVAudioRecorder *)recorder error:(NSError *)error { self.failure = @"录音被中断，请重新录制"; [self finishCapture]; }
- (void)audioRecorderDidFinishRecording:(AVAudioRecorder *)recorder successfully:(BOOL)flag { if (!flag) self.failure = @"录音未成功保存，请重新录制"; }
RCT_REMAP_METHOD(stop, stopWithResolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
    [self finishCapture];
    NSDictionary *attributes = self.pending ? [[NSFileManager defaultManager] attributesOfItemAtPath:self.pending.path error:nil] : nil;
    if (!self.pending || self.failure || [attributes fileSize] < 100) {
        NSString *message = self.failure ?: @"没有有效录音，请重新录制";
        [self discard]; reject(@"RECORD", message, nil); return;
    }
    NSDictionary *result = @{@"name":self.pending.lastPathComponent, @"uri":self.pending.absoluteString, @"size":@([attributes fileSize]), @"timestamp":@(self.started), @"source":@"phone"};
    self.pending = nil; self.recorder = nil; resolve(result);
}
- (void)discard {
    [self finishCapture];
    if (self.pending) [[NSFileManager defaultManager] removeItemAtURL:self.pending error:nil];
    self.pending = nil; self.recorder = nil; self.failure = nil;
}
RCT_REMAP_METHOD(cancel, cancelWithResolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) { [self discard]; resolve(nil); }
RCT_REMAP_METHOD(play, playURI:(NSString *)uri resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
    if (self.pending) { reject(@"BUSY", @"请先结束录音", nil); return; }
    NSURL *url = SpurResolveRecordingURL(uri, [self folder]);
    if (!url) { reject(@"PLAY", @"无效的本地录音", nil); return; }
    [self.player stop];
    NSError *error = nil;
    [[AVAudioSession sharedInstance] setCategory:AVAudioSessionCategoryPlayback error:&error];
    [[AVAudioSession sharedInstance] setActive:YES error:&error];
    self.player = [[AVAudioPlayer alloc] initWithContentsOfURL:url error:&error];
    if (!self.player || ![self.player play]) { reject(@"PLAY", @"无法播放本地录音", error); return; }
    resolve(nil);
}
RCT_EXPORT_METHOD(stopPlayback) { [self.player stop]; }
RCT_REMAP_METHOD(deleteRecording, deleteRecordingURI:(NSString *)uri resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
    NSURL *url = SpurResolveRecordingURL(uri, [self folder]);
    NSURL *pending = self.pending.URLByStandardizingPath.URLByResolvingSymlinksInPath;
    if (!url || [url.path isEqualToString:pending.path]) {
        reject(@"DELETE", @"录音位置无效，或录音尚未结束，请稍后重试", nil); return;
    }
    NSFileManager *manager = NSFileManager.defaultManager;
    BOOL directory = NO;
    if (![manager fileExistsAtPath:url.path isDirectory:&directory]) { resolve(nil); return; }
    if (directory) { reject(@"DELETE", @"不能删除录音目录", nil); return; }
    [self.player stop]; self.player = nil;
    NSError *error = nil;
    if (![manager removeItemAtURL:url error:&error]) { reject(@"DELETE", @"录音删除失败，请重试", error); return; }
    resolve(nil);
}
- (void)invalidate { [self cancelTranscription:self.speechRequestId]; [self discard]; [[NSNotificationCenter defaultCenter] removeObserver:self]; }
- (void)dealloc { [[NSNotificationCenter defaultCenter] removeObserver:self]; }
@end
