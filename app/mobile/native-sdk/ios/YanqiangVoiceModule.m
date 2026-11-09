#import "YanqiangVoiceModule.h"

#import <RingSDK/RingSDK.h>
#import <AVFoundation/AVFoundation.h>
#import <UIKit/UIKit.h>

#if DEBUG && __has_include("SpurVoiceAgentSecrets.h")
#import "SpurVoiceAgentSecrets.h"
#endif
#ifndef SPUR_SILICONFLOW_API_KEY
#define SPUR_SILICONFLOW_API_KEY @""
#endif
#ifndef SPUR_AMAP_WEB_API_KEY
#define SPUR_AMAP_WEB_API_KEY @""
#endif

#if __has_include(<YanqiangRingSDK/YanqiangRingSDK-Swift.h>)
#import <YanqiangRingSDK/YanqiangRingSDK-Swift.h>
#elif __has_include("YanqiangRingSDK-Swift.h")
#import "YanqiangRingSDK-Swift.h"
#endif

static const NSInteger kVoiceFileFunction = 1;
static const NSTimeInterval kRecordingSyncTimeoutSec = 180.0;
static const NSTimeInterval kStaleSyncLockSec = 15.0;
static const NSTimeInterval kConnectAfterScanDelaySec = 0.8;
static const NSTimeInterval kConnectionTimeoutSec = 20.0;
static NSString *const kRecordingDirName = @"voice-recordings";

@interface YanqiangVoiceModule ()
@property (nonatomic, strong) BTService *service;
@property (nonatomic, strong) BTAudioManager *audioManager;
@property (nonatomic, assign) BOOL configured;
@property (nonatomic, assign) BOOL hasListeners;
@property (nonatomic, assign) BOOL bleConnected;
@property (nonatomic, assign) BOOL authSucceeded;
@property (nonatomic, assign) BOOL connectionInProgress;
@property (nonatomic, assign) NSInteger connectionAttempt;
@property (nonatomic, assign) NSTimeInterval connectionStartedAt;
@property (nonatomic, assign) BOOL touchReportingEnabled;
@property (nonatomic, assign) NSInteger currentWorkingState;
@property (nonatomic, assign) BOOL syncInProgress;
@property (nonatomic, assign) NSTimeInterval syncLastActivityAt;
@property (nonatomic, assign) NSInteger syncGeneration;
@property (nonatomic, assign) NSInteger pendingConversions;
@property (nonatomic, assign) BOOL syncFinishSeen;
@property (nonatomic, assign) BOOL syncResolved;
@property (nonatomic, copy) RCTPromiseResolveBlock syncResolve;
@property (nonatomic, copy) RCTPromiseRejectBlock syncReject;
@property (nonatomic, strong) dispatch_block_t syncTimeoutBlock;
@property (nonatomic, strong) NSMutableSet<NSNumber *> *processedPackedTimes;
@property (nonatomic, strong) NSMutableSet<NSString *> *processedOpusPaths;
@property (nonatomic, strong) NSMutableSet<NSNumber *> *convertingPackedTimes;
@property (nonatomic, copy) NSString *activeMacAddress;
@property (nonatomic, strong) dispatch_block_t pendingScanEnd;
@property (nonatomic, strong) dispatch_block_t pendingConnectBlock;
@property (nonatomic, strong) dispatch_block_t connectionTimeoutBlock;
@property (nonatomic, strong) NSMutableDictionary<NSString *, CBPeripheral *> *knownPeripherals;
@end

@implementation YanqiangVoiceModule

RCT_EXPORT_MODULE(YanqiangVoiceModule)

+ (BOOL)requiresMainQueueSetup
{
  return YES;
}

- (instancetype)init
{
  self = [super init];
  if (self) {
    _service = [BTService shared];
    _audioManager = [BTAudioManager sharedInstance];
    _knownPeripherals = [NSMutableDictionary dictionary];
    _processedPackedTimes = [NSMutableSet set];
    _processedOpusPaths = [NSMutableSet set];
    _convertingPackedTimes = [NSMutableSet set];
    _currentWorkingState = -1;
  }
  return self;
}

- (dispatch_queue_t)methodQueue
{
  return dispatch_get_main_queue();
}

- (NSArray<NSString *> *)supportedEvents
{
  return @[
    @"yanqiangVoiceScanEvent",
    @"yanqiangVoiceConnectionChanged",
    @"yanqiangVoiceStatusUpdate",
    @"yanqiangVoiceSyncState",
    @"yanqiangVoiceSyncProgress",
    @"yanqiangVoiceFileReady",
    @"yanqiangVoiceError",
    @"yanqiangSmartTouchEvent"
  ];
}

- (void)startObserving
{
  self.hasListeners = YES;
}

- (void)stopObserving
{
  self.hasListeners = NO;
}

- (void)emit:(NSString *)name body:(NSDictionary *)body
{
  // fileReady must reach JS even if listener count briefly drops (matches Android).
  if (self.hasListeners || [name isEqualToString:@"yanqiangVoiceFileReady"]) {
    [self sendEventWithName:name body:body ?: @{}];
  }
}

- (NSString *)stableAppIdentifier
{
  NSString *key = @"YanqiangRingSDKUniqueAppIdentifier";
  NSString *identifier = [[NSUserDefaults standardUserDefaults] stringForKey:key];
  if (identifier.length == 0) {
    identifier = [NSUUID UUID].UUIDString;
    [[NSUserDefaults standardUserDefaults] setObject:identifier forKey:key];
  }
  return identifier;
}

- (void)configureIfNeeded
{
  if (self.configured) {
    return;
  }
  self.configured = YES;
  [self.service setUniqueAppIDKey:[self stableAppIdentifier]];
  [self.service setLogEnable:YES];
  [self.service setAutoReconnectionEnabled:YES];
  [self configureAudioCallbacks];

  __weak typeof(self) touchSelf = self;
  [self.service.touchReq listeningTouchEvent:^(NSMutableArray<BTTouchEventModel *> *touchList) {
    dispatch_async(dispatch_get_main_queue(), ^{
      __strong typeof(touchSelf) owner = touchSelf;
      if (!owner || !owner.touchReportingEnabled || !owner.authSucceeded) return;
      for (BTTouchEventModel *item in touchList) {
        if (item.touchEvent != 0x0103) continue;
        [owner emit:@"yanqiangSmartTouchEvent" body:@{
          @"event": @(item.touchEvent),
          @"timestamp": @((double)item.touchTime * 1000.0)
        }];
      }
    });
  }];

  __weak typeof(self) weakSelf = self;
  [self.service bleStatusUpdated:^(CBManagerState state) {
    __strong typeof(weakSelf) self = weakSelf;
    if (!self) return;
    if (state == CBManagerStatePoweredOff) {
      [self emit:@"yanqiangVoiceError" body:@{
        @"code": @"YANQIANG_BLUETOOTH_OFF",
        @"message": @"Bluetooth is turned off"
      }];
    }
  }];

  [self.service scanningDeviceUpdated:^(NSArray<Ring *> *rings) {
    __strong typeof(weakSelf) self = weakSelf;
    if (!self) return;
    for (Ring *ring in rings) {
      NSString *address = ring.macAddress.length > 0 ? ring.macAddress : ring.uuidString;
      if (address.length == 0) continue;
      NSLog(@"[YanqiangVoice] scan device name=%@ mac=%@ uuid=%@ rssi=%d",
            ring.name ?: @"",
            ring.macAddress ?: @"",
            ring.uuidString ?: @"",
            ring.rssi);
      [self emit:@"yanqiangVoiceScanEvent" body:@{
        @"type": @"device",
        @"name": ring.name ?: @"Ring",
        @"macAddress": address,
        @"address": ring.uuidString ?: address,
        @"rssi": @(ring.rssi),
        @"hasMac": @(ring.macAddress.length > 0)
      }];
    }
  }];

  [self.service ringStatusUpdated:^(BTDeviceStatus status) {
    __strong typeof(weakSelf) self = weakSelf;
    if (!self) return;
    [self handleRingStatus:status];
  }];
}

- (void)configureAudioCallbacks
{
  __weak typeof(self) weakSelf = self;
  self.audioManager.audioRecordStatusBlock = ^(AudioRecordStatus status, NSInteger time) {
    dispatch_async(dispatch_get_main_queue(), ^{
      __strong typeof(weakSelf) self = weakSelf;
      if (!self) return;
      self.currentWorkingState = (NSInteger)status;
      NSLog(@"[YanqiangVoice] workingState=%ld remaining=%ld", (long)status, (long)time);
      [self emit:@"yanqiangVoiceStatusUpdate" body:@{
        @"function": @(kVoiceFileFunction),
        @"state": @(status),
        @"remainingTime": @(time),
        @"status": [self mapWorkingStatus:status]
      }];
    });
  };

  self.audioManager.logHandler = ^(NSString *message) {
    NSLog(@"[YanqiangVoice][BTAudio] %@", message ?: @"");
  };
}

- (NSString *)mapWorkingStatus:(AudioRecordStatus)status
{
  switch (status) {
    case AudioRecordStatusIdle: return @"idle";
    case AudioRecordStatusRecording: return @"recording";
    case AudioRecordStatusPaused: return @"paused";
    case AudioRecordStatusDataPending: return @"ready_to_sync";
    case AudioRecordStatusUploading: return @"syncing";
    default: return @"unknown";
  }
}

- (void)emitSystemConnectedDevices
{
  NSArray<CBPeripheral *> *peripherals = [self.service getSystemConnectedDevices];
  for (CBPeripheral *peripheral in peripherals) {
    NSString *identifier = peripheral.identifier.UUIDString;
    if (identifier.length == 0) continue;
    self.knownPeripherals[identifier] = peripheral;
    [self emit:@"yanqiangVoiceScanEvent" body:@{
      @"type": @"device",
      @"name": peripheral.name ?: @"Connected Ring",
      @"macAddress": identifier,
      @"address": identifier,
      @"rssi": @0,
      @"systemConnected": @YES
    }];
  }
}

- (NSString *)statusLabel:(BTDeviceStatus)status
{
  switch (status) {
    case BTDeviceStatusAuthCmdSendFail: return @"AuthCmdSendFail";
    case BTDeviceStatusDisconnected: return @"Disconnected";
    case BTDeviceStatusPairingRemoved: return @"PairingRemoved";
    case BTDeviceStatusOff: return @"Off";
    case BTDeviceStatusNoPair: return @"NoPair";
    case BTDeviceStatusConnecting: return @"Connecting";
    case BTDeviceStatusConnected: return @"BLEConnected";
    case BTDeviceStatusConnectFailed: return @"ConnectFailed";
    case BTDeviceStatusAuthRefused: return @"AuthRefused";
    case BTDeviceStatusAuthSuccess: return @"AuthSuccess";
    case BTDeviceStatusAuthBound: return @"AuthBound";
    case BTDeviceStatusAuthIllegal: return @"AuthIllegal";
    case BTDeviceStatusBoundOtherCharging: return @"BoundOtherCharging";
    case BTDeviceStatusBoundOtherNotCharging: return @"BoundOtherNotCharging";
    default: return @"Unknown";
  }
}

- (NSTimeInterval)connectionElapsed
{
  if (self.connectionStartedAt <= 0) return 0;
  return MAX(0, [NSDate date].timeIntervalSince1970 - self.connectionStartedAt);
}

- (void)logConnectionPhase:(NSString *)phase details:(NSString *)details
{
  NSLog(@"[YanqiangVoice][connect#%ld][+%.3fs] %@%@%@",
        (long)self.connectionAttempt,
        [self connectionElapsed],
        phase ?: @"unknown",
        details.length > 0 ? @" " : @"",
        details ?: @"");
}

- (void)finishConnectionAttempt:(NSString *)phase
{
  [self logConnectionPhase:phase details:self.activeMacAddress ?: @""];
  self.connectionInProgress = NO;
  if (self.pendingConnectBlock) {
    dispatch_block_cancel(self.pendingConnectBlock);
    self.pendingConnectBlock = nil;
  }
  if (self.connectionTimeoutBlock) {
    dispatch_block_cancel(self.connectionTimeoutBlock);
    self.connectionTimeoutBlock = nil;
  }
}

- (void)handleRingStatus:(BTDeviceStatus)status
{
  // Align with DreameRing iOS: RingSDK performs auth internally after bindDevice.
  // Do NOT call baseReq.authorize here — early authorize can hang at BLEConnected(-2).
  // Do NOT emit BLE status on yanqiangVoiceStatusUpdate — JS autoSync treats that as workingState.
  NSLog(@"[YanqiangVoice] ringStatus state=%ld (%@) mac=%@ ble=%d auth=%d",
        (long)status,
        [self statusLabel:status],
        self.activeMacAddress ?: @"",
        self.bleConnected,
        self.authSucceeded);
  [self logConnectionPhase:@"status"
                   details:[NSString stringWithFormat:@"state=%ld label=%@ ble=%d auth=%d",
                            (long)status,
                            [self statusLabel:status],
                            self.bleConnected,
                            self.authSucceeded]];

  if (status == BTDeviceStatusConnected) {
    self.bleConnected = YES;
    [self emit:@"yanqiangVoiceConnectionChanged" body:@{
      @"status": @"connecting",
      @"phase": @"ble_connected",
      @"state": @(status),
      @"label": [self statusLabel:status],
      @"macAddress": self.activeMacAddress ?: @""
    }];
    [self emitConnectedIfReady];
    return;
  }
  if (status == BTDeviceStatusAuthSuccess) {
    self.bleConnected = YES;
    self.authSucceeded = YES;
    [self emit:@"yanqiangVoiceConnectionChanged" body:@{
      @"status": @"connecting",
      @"phase": @"auth_success",
      @"state": @(status),
      @"label": [self statusLabel:status],
      @"macAddress": self.activeMacAddress ?: @""
    }];
    [self finishConnectionAttempt:@"auth_success"];
    [self emitConnectedIfReady];
    return;
  }

  if (status == BTDeviceStatusConnecting) {
    self.bleConnected = NO;
    self.authSucceeded = NO;
    [self emit:@"yanqiangVoiceConnectionChanged" body:@{
      @"status": @"connecting",
      @"phase": @"connecting",
      @"state": @(status),
      @"label": [self statusLabel:status],
      @"macAddress": self.activeMacAddress ?: @""
    }];
    return;
  }

  self.bleConnected = NO;
  self.authSucceeded = NO;
  [self finishConnectionAttempt:@"terminal_status"];
  if (status == BTDeviceStatusDisconnected || status == BTDeviceStatusPairingRemoved || status == BTDeviceStatusOff) {
    [self emit:@"yanqiangVoiceConnectionChanged" body:@{
      @"status": @"disconnected",
      @"state": @(status),
      @"label": [self statusLabel:status],
      @"macAddress": self.activeMacAddress ?: @""
    }];
  } else {
    [self emit:@"yanqiangVoiceConnectionChanged" body:@{
      @"status": @"error",
      @"state": @(status),
      @"label": [self statusLabel:status],
      @"message": [NSString stringWithFormat:@"Ring connection failed (state=%ld %@)", (long)status, [self statusLabel:status]],
      @"macAddress": self.activeMacAddress ?: @""
    }];
  }
}

- (void)emitConnectedIfReady
{
  if (!self.bleConnected || !self.authSucceeded) {
    NSLog(@"[YanqiangVoice] not ready yet ble=%d auth=%d mac=%@",
          self.bleConnected, self.authSucceeded, self.activeMacAddress ?: @"");
    return;
  }
  BTDevice *device = [self.service getPairedDevice];
  NSString *mac = device.macAddress.length > 0 ? device.macAddress : self.activeMacAddress;
  self.activeMacAddress = mac;
  NSLog(@"[YanqiangVoice] vendorReady=YES name=%@ mac=%@", device.name ?: @"Ring", mac ?: @"");
  [self emit:@"yanqiangVoiceConnectionChanged" body:@{
    @"status": @"connected",
    @"vendorReady": @YES,
    @"name": device.name ?: @"Ring",
    @"macAddress": mac ?: @""
  }];
}

#pragma mark - Recording helpers

- (NSString *)recordingDir
{
  NSString *docs = NSSearchPathForDirectoriesInDomains(NSDocumentDirectory, NSUserDomainMask, YES).firstObject;
  NSString *dir = [docs stringByAppendingPathComponent:kRecordingDirName];
  [[NSFileManager defaultManager] createDirectoryAtPath:dir
                            withIntermediateDirectories:YES
                                             attributes:nil
                                                  error:nil];
  return dir;
}

- (NSArray *)listLocalRecordingFiles
{
  NSFileManager *fm = [NSFileManager defaultManager];
  NSString *dir = [self recordingDir];
  NSArray<NSString *> *names = [fm contentsOfDirectoryAtPath:dir error:nil] ?: @[];
  NSMutableArray *files = [NSMutableArray array];
  NSMutableArray<NSDictionary *> *items = [NSMutableArray array];
  for (NSString *name in names) {
    NSString *lower = name.lowercaseString;
    if (![lower hasSuffix:@".ogg"] && ![lower hasSuffix:@".m4a"]) continue;
    NSString *path = [dir stringByAppendingPathComponent:name];
    NSDictionary *attrs = [fm attributesOfItemAtPath:path error:nil];
    NSDate *modified = attrs[NSFileModificationDate] ?: [NSDate date];
    NSNumber *size = attrs[NSFileSize] ?: @0;
    [items addObject:@{
      @"name": name,
      @"uri": [NSURL fileURLWithPath:path].absoluteString ?: [@"file://" stringByAppendingString:path],
      @"timestamp": @((long long)(modified.timeIntervalSince1970 * 1000.0)),
      @"size": size,
      @"_sort": modified
    }];
  }
  [items sortUsingComparator:^NSComparisonResult(NSDictionary *a, NSDictionary *b) {
    return [b[@"_sort"] compare:a[@"_sort"]];
  }];
  for (NSDictionary *item in items) {
    NSMutableDictionary *copy = [item mutableCopy];
    [copy removeObjectForKey:@"_sort"];
    [files addObject:copy];
  }
  return files;
}

- (NSString *)sanitizeFileName:(NSString *)name
{
  if (name.length == 0) return @"voice";
  NSCharacterSet *allowed = [NSCharacterSet characterSetWithCharactersInString:
                             @"abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789._-"];
  NSMutableString *out = [NSMutableString string];
  for (NSUInteger i = 0; i < name.length; i++) {
    unichar c = [name characterAtIndex:i];
    if ([allowed characterIsMember:c]) {
      [out appendFormat:@"%C", c];
    } else {
      [out appendString:@"_"];
    }
  }
  return out.length > 0 ? out : @"voice";
}

- (long long)normalizeFileTimestamp:(long long)rawFileTime
{
  if (rawFileTime >= 946684800000LL) return rawFileTime;
  if (rawFileTime >= 946684800LL && rawFileTime <= 4102444800LL) return rawFileTime * 1000LL;
  return (long long)([[NSDate date] timeIntervalSince1970] * 1000.0);
}

- (NSDictionary *)copyOggToRecordings:(NSString *)oggPath packet:(BTAudioPacketModel *)packet
{
  NSFileManager *fm = [NSFileManager defaultManager];
  if (oggPath.length == 0 || ![fm fileExistsAtPath:oggPath]) {
    return nil;
  }
  long long rawTime = 0;
  if (packet != nil) {
    if (packet.utcTimestamp > 0) {
      rawTime = (long long)packet.utcTimestamp;
    } else if (packet.packedTime > 0) {
      rawTime = (long long)packet.packedTime;
    }
  }
  if (rawTime <= 0) {
    NSDictionary *srcAttrs = [fm attributesOfItemAtPath:oggPath error:nil];
    NSDate *modified = srcAttrs[NSFileModificationDate];
    if (modified != nil) {
      rawTime = (long long)(modified.timeIntervalSince1970 * 1000.0);
    }
  }
  long long timestamp = [self normalizeFileTimestamp:rawTime > 1000000000LL ? rawTime : (rawTime > 0 ? rawTime : 0)];
  if (rawTime <= 0) {
    timestamp = (long long)([[NSDate date] timeIntervalSince1970] * 1000.0);
  }

  NSString *baseName = oggPath.lastPathComponent.length > 0
    ? oggPath.lastPathComponent
    : [NSString stringWithFormat:@"voice-%lld", rawTime > 0 ? rawTime : timestamp];
  baseName = [self sanitizeFileName:baseName];
  if (![baseName.lowercaseString hasSuffix:@".ogg"]) {
    baseName = [baseName stringByAppendingString:@".ogg"];
  }

  NSString *dest = [[self recordingDir] stringByAppendingPathComponent:baseName];
  NSError *error = nil;
  if ([fm fileExistsAtPath:dest]) {
    [fm removeItemAtPath:dest error:nil];
  }
  if (![fm copyItemAtPath:oggPath toPath:dest error:&error]) {
    NSLog(@"[YanqiangVoice] copy ogg failed: %@", error);
    return nil;
  }
  NSDictionary *attrs = @{ NSFileModificationDate: [NSDate dateWithTimeIntervalSince1970:timestamp / 1000.0] };
  [fm setAttributes:attrs ofItemAtPath:dest error:nil];
  NSDictionary *fileAttrs = [fm attributesOfItemAtPath:dest error:nil];
  return @{
    @"name": baseName,
    @"uri": [NSURL fileURLWithPath:dest].absoluteString ?: [@"file://" stringByAppendingString:dest],
    @"timestamp": @(timestamp),
    @"size": fileAttrs[NSFileSize] ?: @0,
    @"rawFileTime": @(rawTime)
  };
}

- (void)touchSyncActivity
{
  self.syncLastActivityAt = [NSDate date].timeIntervalSince1970;
}

- (void)clearSyncTimeout
{
  if (self.syncTimeoutBlock) {
    dispatch_block_cancel(self.syncTimeoutBlock);
    self.syncTimeoutBlock = nil;
  }
}

- (void)finishSyncIfReadyForGeneration:(NSInteger)generation
{
  if (generation != self.syncGeneration) return;
  if (!self.syncFinishSeen || self.pendingConversions != 0 || self.syncResolved) return;
  self.syncResolved = YES;
  [self clearSyncTimeout];
  self.syncInProgress = NO;
  self.syncLastActivityAt = 0;
  RCTPromiseResolveBlock resolve = self.syncResolve;
  self.syncResolve = nil;
  self.syncReject = nil;
  if (resolve) {
    resolve(@{ @"files": [self listLocalRecordingFiles] });
  }
}

- (void)failSyncWithCode:(NSString *)code message:(NSString *)message generation:(NSInteger)generation
{
  if (generation != self.syncGeneration || self.syncResolved) return;
  self.syncResolved = YES;
  [self clearSyncTimeout];
  self.syncInProgress = NO;
  self.syncLastActivityAt = 0;
  RCTPromiseRejectBlock reject = self.syncReject;
  self.syncResolve = nil;
  self.syncReject = nil;
  if (reject) {
    reject(code, message, nil);
  }
}

/// DreameRing path: scan Documents/Audio/*.opus → VoiceRecordingTranscoder → voice-recordings/*.m4a
- (NSString *)sdkAudioDirectory
{
  NSString *docs = NSSearchPathForDirectoriesInDomains(NSDocumentDirectory, NSUserDomainMask, YES).firstObject;
  return [docs stringByAppendingPathComponent:@"Audio"];
}

- (NSArray<NSString *> *)convertedRecordingBaseNames
{
  NSFileManager *fm = [NSFileManager defaultManager];
  NSString *dir = [self recordingDir];
  NSArray<NSString *> *names = [fm contentsOfDirectoryAtPath:dir error:nil] ?: @[];
  NSMutableArray<NSString *> *bases = [NSMutableArray array];
  for (NSString *name in names) {
    NSString *lower = name.lowercaseString;
    if (![lower hasSuffix:@".m4a"] && ![lower hasSuffix:@".ogg"]) continue;
    [bases addObject:name.stringByDeletingPathExtension];
  }
  return bases;
}

- (NSDictionary *)filePayloadForPath:(NSString *)path
{
  NSFileManager *fm = [NSFileManager defaultManager];
  NSDictionary *attrs = [fm attributesOfItemAtPath:path error:nil];
  NSDate *modified = attrs[NSFileModificationDate] ?: [NSDate date];
  return @{
    @"name": path.lastPathComponent ?: @"recording.m4a",
    @"uri": [NSURL fileURLWithPath:path].absoluteString ?: [@"file://" stringByAppendingString:path],
    @"timestamp": @((long long)(modified.timeIntervalSince1970 * 1000.0)),
    @"size": attrs[NSFileSize] ?: @0
  };
}

/// After BLE transfer finishes: convert pending Documents/Audio/*.opus → playable M4A (DreameRing).
- (void)finalizeReceivedFilesForGeneration:(NSInteger)generation reason:(NSString *)reason
{
  if (generation != self.syncGeneration) return;
  NSLog(@"[YanqiangVoice] finalizeReceivedFiles reason=%@", reason ?: @"");

  NSString *audioDir = [self sdkAudioDirectory];
  NSArray<NSString *> *convertedBases = [self convertedRecordingBaseNames];
  NSArray<NSString *> *pendingOpusPaths = [YanqiangVoiceOpusBridge pendingOpusPathsInAudioDirectory:audioDir
                                                                                convertedBaseNames:convertedBases];
  NSLog(@"[YanqiangVoice] pending Opus count=%lu audioDir=%@",
        (unsigned long)pendingOpusPaths.count, audioDir);

  if (pendingOpusPaths.count == 0) {
    return;
  }

  NSString *recordingDir = [self recordingDir];
  self.pendingConversions += (NSInteger)pendingOpusPaths.count;
  NSInteger generationCapture = generation;
  __weak typeof(self) weakSelf = self;
  dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
    for (NSString *opusPath in pendingOpusPaths) {
      NSString *base = opusPath.lastPathComponent.stringByDeletingPathExtension;
      NSString *m4aPath = [[recordingDir stringByAppendingPathComponent:base]
                           stringByAppendingPathExtension:@"m4a"];
      NSError *error = nil;
      BOOL ok = [YanqiangVoiceOpusBridge transcodeOpusFileAtPath:opusPath toM4APath:m4aPath error:&error];
      NSDictionary *attrs = [[NSFileManager defaultManager] attributesOfItemAtPath:opusPath error:nil];
      NSDate *mtime = attrs[NSFileModificationDate];
      if (ok && mtime != nil) {
        [[NSFileManager defaultManager] setAttributes:@{ NSFileModificationDate: mtime }
                                         ofItemAtPath:m4aPath
                                                error:nil];
      }
      dispatch_async(dispatch_get_main_queue(), ^{
        __strong typeof(weakSelf) self = weakSelf;
        if (!self || generationCapture != self.syncGeneration) return;
        [self touchSyncActivity];
        if (ok) {
          NSDictionary *file = [self filePayloadForPath:m4aPath];
          NSLog(@"[YanqiangVoice] fileReady %@", file[@"name"]);
          [self emit:@"yanqiangVoiceFileReady" body:file];
        } else {
          NSLog(@"[YanqiangVoice] M4A transcode failed %@ err=%@",
                opusPath.lastPathComponent, error.localizedDescription ?: @"");
          [self emit:@"yanqiangVoiceError" body:@{
            @"message": error.localizedDescription ?: @"Opus to M4A failed",
            @"fileName": opusPath.lastPathComponent ?: @""
          }];
        }
        self.pendingConversions = MAX(0, self.pendingConversions - 1);
        [self finishSyncIfReadyForGeneration:generationCapture];
      });
    }
  });
}

- (void)handleSingleFileReceivedForGeneration:(NSInteger)generation
{
  // DreameRing does not convert on SingleSuccess; finalize after AllSuccess/Empty.
  if (generation != self.syncGeneration) return;
  NSLog(@"[YanqiangVoice] SingleSuccess noted — convert on transfer finish");
}

- (void)handleReceiveStatus:(BLEReceiveStatus)status generation:(NSInteger)generation
{
  if (generation != self.syncGeneration) return;
  [self touchSyncActivity];
  NSLog(@"[YanqiangVoice] receiveStatus=%ld %@", (long)status, [BTAudioManager descriptionForReceiveStatus:status]);

  if (status == BLEReceiveStatusStart || status == BLEReceiveStatusUploading) {
    [self emit:@"yanqiangVoiceSyncState" body:@{
      @"phase": @"start",
      @"code": @1,
      @"message": [BTAudioManager descriptionForReceiveStatus:status] ?: @"start"
    }];
    return;
  }

  if (status == BLEReceiveStatusSingleSuccess) {
    [self handleSingleFileReceivedForGeneration:generation];
    return;
  }

  // DreameRing: status 4/5 → scan Audio/*.opus → M4A
  if (status == BLEReceiveStatusAllSuccess || status == BLEReceiveStatusEnpty) {
    [self emit:@"yanqiangVoiceSyncState" body:@{
      @"phase": @"finish",
      @"code": @1,
      @"message": [BTAudioManager descriptionForReceiveStatus:status] ?: @"finish"
    }];
    [self finalizeReceivedFilesForGeneration:generation
                                      reason:(status == BLEReceiveStatusAllSuccess ? @"AllSuccess" : @"Empty")];
    self.syncFinishSeen = YES;
    [self finishSyncIfReadyForGeneration:generation];
    return;
  }

  if (status == BLEReceiveStatusFailed) {
    [self failSyncWithCode:@"YANQIANG_SYNC_RECORDING_FAILED"
                   message:@"Vendor voice file transfer failed"
                generation:generation];
  }
}

#pragma mark - RCT methods

RCT_REMAP_METHOD(initSdk,
                 initSdkWithResolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
  @try {
    [self configureIfNeeded];
    resolve(@YES);
  } @catch (NSException *exception) {
    reject(@"YANQIANG_INIT_FAILED", exception.reason ?: @"RingSDK initialization failed", nil);
  }
}

RCT_REMAP_METHOD(startScan,
                 startScanWithResolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
  [self configureIfNeeded];
  if (self.service.isPermissionDenied) {
    reject(@"YANQIANG_BLUETOOTH_PERMISSION", @"Bluetooth permission is denied", nil);
    return;
  }

  [self emit:@"yanqiangVoiceScanEvent" body:@{ @"type": @"start" }];
  [self emitSystemConnectedDevices];
  [self.service startScan];
  resolve(@YES);

  if (self.pendingScanEnd) {
    dispatch_block_cancel(self.pendingScanEnd);
  }
  __weak typeof(self) weakSelf = self;
  dispatch_block_t endBlock = dispatch_block_create(0, ^{
    __strong typeof(weakSelf) self = weakSelf;
    if (!self) return;
    [self.service stopScan];
    [self emit:@"yanqiangVoiceScanEvent" body:@{ @"type": @"end" }];
  });
  self.pendingScanEnd = endBlock;
  dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(15 * NSEC_PER_SEC)), dispatch_get_main_queue(), endBlock);
}

RCT_EXPORT_METHOD(stopScan)
{
  if (self.pendingScanEnd) {
    dispatch_block_cancel(self.pendingScanEnd);
    self.pendingScanEnd = nil;
  }
  [self.service stopScan];
  [self emit:@"yanqiangVoiceScanEvent" body:@{ @"type": @"end" }];
}

RCT_REMAP_METHOD(connect,
                 connect:(NSString *)macAddress
                 resolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
  [self configureIfNeeded];
  if (macAddress.length == 0) {
    reject(@"YANQIANG_CONNECT_FAILED", @"Device address is empty", nil);
    return;
  }
  if (self.connectionInProgress) {
    [self logConnectionPhase:@"duplicate_rejected" details:macAddress];
    reject(@"YANQIANG_CONNECT_IN_PROGRESS", @"A ring connection attempt is already running", nil);
    return;
  }

  self.connectionAttempt += 1;
  NSInteger attempt = self.connectionAttempt;
  self.connectionInProgress = YES;
  self.connectionStartedAt = [NSDate date].timeIntervalSince1970;
  self.activeMacAddress = macAddress;
  self.bleConnected = NO;
  self.authSucceeded = NO;

  if (self.pendingScanEnd) {
    dispatch_block_cancel(self.pendingScanEnd);
    self.pendingScanEnd = nil;
  }
  [self.service stopScan];
  [self emit:@"yanqiangVoiceScanEvent" body:@{ @"type": @"end" }];
  [self logConnectionPhase:@"scan_stop_requested"
                   details:[NSString stringWithFormat:@"mac=%@ waitMs=800", macAddress]];

  CBPeripheral *peripheral = self.knownPeripherals[macAddress];
  __weak typeof(self) weakSelf = self;
  dispatch_block_t connectBlock = dispatch_block_create(0, ^{
    __strong typeof(weakSelf) self = weakSelf;
    if (!self || !self.connectionInProgress || self.connectionAttempt != attempt) return;
    self.pendingConnectBlock = nil;
    if (peripheral != nil) {
      [self logConnectionPhase:@"bind_started" details:[NSString stringWithFormat:@"peripheral=%@", macAddress]];
      [self.service bindDeviceWithPeripheral:peripheral];
    } else {
      [self logConnectionPhase:@"bind_started" details:[NSString stringWithFormat:@"address=%@", macAddress]];
      [self.service bindDevice:macAddress];
    }
    [self.service setAutoReconnectionEnabled:YES];
  });
  self.pendingConnectBlock = connectBlock;
  dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(kConnectAfterScanDelaySec * NSEC_PER_SEC)),
                 dispatch_get_main_queue(),
                 connectBlock);

  dispatch_block_t timeoutBlock = dispatch_block_create(0, ^{
    __strong typeof(weakSelf) self = weakSelf;
    if (!self || !self.connectionInProgress || self.connectionAttempt != attempt) return;
    self.connectionTimeoutBlock = nil;
    [self finishConnectionAttempt:@"timeout"];
    [self emit:@"yanqiangVoiceConnectionChanged" body:@{
      @"status": @"error",
      @"phase": @"timeout",
      @"attempt": @(attempt),
      @"message": @"Ring authentication timed out",
      @"macAddress": macAddress
    }];
  });
  self.connectionTimeoutBlock = timeoutBlock;
  dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(kConnectionTimeoutSec * NSEC_PER_SEC)),
                 dispatch_get_main_queue(),
                 timeoutBlock);
  resolve(@YES);
}

RCT_REMAP_METHOD(disconnect,
                 disconnectWithResolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
  [self finishConnectionAttempt:@"manual_disconnect"];
  [self.service setAutoReconnectionEnabled:NO];
  self.bleConnected = NO;
  self.authSucceeded = NO;
  if ([self.service respondsToSelector:@selector(disConnectDevice)]) {
    [self.service disConnectDevice];
  }
  [self emit:@"yanqiangVoiceConnectionChanged" body:@{
    @"status": @"disconnected",
    @"macAddress": self.activeMacAddress ?: @""
  }];
  resolve(@YES);
}

RCT_REMAP_METHOD(setTouchEventReporting,
                 setTouchEventReporting:(BOOL)enabled
                 resolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
  self.touchReportingEnabled = enabled;
  resolve(@{ @"enabled": @(enabled), @"result": @(self.authSucceeded ? 1 : 0) });
}

RCT_REMAP_METHOD(voiceAgentDebugConfig,
                 voiceAgentDebugConfigWithResolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
#if DEBUG
  NSString *siliconKey = SPUR_SILICONFLOW_API_KEY;
  NSString *amapKey = SPUR_AMAP_WEB_API_KEY;
  resolve(@{ @"enabled": @(siliconKey.length > 0 && amapKey.length > 0), @"siliconFlowApiKey": siliconKey, @"amapWebApiKey": amapKey });
#else
  resolve(@{ @"enabled": @NO, @"siliconFlowApiKey": @"", @"amapWebApiKey": @"" });
#endif
}

RCT_REMAP_METHOD(openAMapTaxiURI,
                 openAMapTaxiURI:(NSString *)uri
                 resolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
#if DEBUG
  if (uri.length == 0 || uri.length > 2048 || [uri rangeOfCharacterFromSet:NSCharacterSet.controlCharacterSet].location != NSNotFound) {
    reject(@"AMAP_INVALID_URI", @"Invalid taxi URI", nil); return;
  }
  NSURLComponents *parts = [NSURLComponents componentsWithString:uri];
  if (![parts.scheme.lowercaseString isEqualToString:@"amapuri"] ||
      ![parts.host.lowercaseString isEqualToString:@"drive"] ||
      ![parts.path isEqualToString:@"/takeTaxi"] ||
      parts.user || parts.password || parts.port || parts.fragment) {
    reject(@"AMAP_INVALID_URI", @"Invalid taxi URI", nil); return;
  }
  NSMutableDictionary<NSString *, NSString *> *values = [NSMutableDictionary dictionary];
  for (NSURLQueryItem *item in parts.queryItems ?: @[]) {
    if (values[item.name] != nil) { reject(@"AMAP_INVALID_URI", @"Duplicate taxi parameter", nil); return; }
    values[item.name] = item.value ?: @"";
  }
  NSString *lon = values[@"dlon"];
  NSString *lat = values[@"dlat"];
  NSString *destination = values[@"dname"];
  NSScanner *lonScanner = [NSScanner scannerWithString:lon ?: @""];
  NSScanner *latScanner = [NSScanner scannerWithString:lat ?: @""];
  double lonValue = 0, latValue = 0;
  if (!lon.length || !lat.length || !destination.length ||
      ![lonScanner scanDouble:&lonValue] || !lonScanner.isAtEnd ||
      ![latScanner scanDouble:&latValue] || !latScanner.isAtEnd ||
      lonValue < -180 || lonValue > 180 || latValue < -90 || latValue > 90 || !parts.URL) {
    reject(@"AMAP_INVALID_URI", @"Taxi destination is missing or invalid", nil); return;
  }
  [[UIApplication sharedApplication] openURL:parts.URL options:@{} completionHandler:^(BOOL success) {
    if (success) resolve(nil);
    else reject(@"AMAP_OPEN_FAILED", @"AMap could not open the taxi page", nil);
  }];
#else
  reject(@"AMAP_DEBUG_ONLY", @"Debug-only feature", nil);
#endif
}

RCT_REMAP_METHOD(queryVoiceRecordingSummary,
                 queryVoiceRecordingSummaryWithResolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
  [self configureIfNeeded];
  if (!self.authSucceeded) {
    reject(@"YANQIANG_QUERY_RECORDING_FAILED", @"Ring is not authenticated (vendorReady required)", nil);
    return;
  }
  __weak typeof(self) weakSelf = self;
  [self.audioManager queryDeviceStorageStatus:BLEFilesTypeRecord
                                   completion:^(BLEFilesType type, uint16_t fileCount, uint32_t totalSize) {
    dispatch_async(dispatch_get_main_queue(), ^{
      __strong typeof(weakSelf) self = weakSelf;
      if (!self) return;
      NSLog(@"[YanqiangVoice] storage type=%ld count=%u bytes=%u", (long)type, fileCount, totalSize);
      resolve(@{
        @"code": @1,
        @"message": @"ok",
        @"supported": @YES,
        @"function": @(type),
        @"fileCount": @(fileCount),
        @"totalBytes": @(totalSize),
        @"files": [self listLocalRecordingFiles]
      });
    });
  }];
}

RCT_REMAP_METHOD(syncVoiceRecordings,
                 syncVoiceRecordingsWithResolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
  [self configureIfNeeded];
  if (!self.authSucceeded) {
    reject(@"YANQIANG_SYNC_RECORDING_FAILED", @"Ring is not authenticated (vendorReady required)", nil);
    return;
  }

  if (self.syncInProgress) {
    NSTimeInterval inactive = [NSDate date].timeIntervalSince1970 - self.syncLastActivityAt;
    if (self.syncLastActivityAt > 0 && inactive >= kStaleSyncLockSec) {
      NSLog(@"[YanqiangVoice] recovering stale sync lock inactive=%.0fs", inactive);
      [self failSyncWithCode:@"YANQIANG_SYNC_STALLED"
                     message:@"Ring transfer stopped making progress; retrying"
                  generation:self.syncGeneration];
    } else {
      reject(@"YANQIANG_RECORDING_SYNC_BUSY",
             [NSString stringWithFormat:@"Voice recording sync is already running (inactive %.0fms)", inactive * 1000.0],
             nil);
      return;
    }
  }

  // Allow idle(1) and data-pending(4); unknown(-1) before first status callback.
  if (self.currentWorkingState != -1 &&
      self.currentWorkingState != AudioRecordStatusIdle &&
      self.currentWorkingState != AudioRecordStatusDataPending) {
    reject(@"YANQIANG_DEVICE_NOT_READY_FOR_SYNC",
           [NSString stringWithFormat:@"Ring cannot sync in workingState=%ld. Wait for state=1 or state=4.",
            (long)self.currentWorkingState],
           nil);
    return;
  }

  self.syncInProgress = YES;
  [self touchSyncActivity];
  NSInteger generation = ++self.syncGeneration;
  self.pendingConversions = 0;
  self.syncFinishSeen = NO;
  self.syncResolved = NO;
  self.syncResolve = resolve;
  self.syncReject = reject;
  [self.processedPackedTimes removeAllObjects];
  [self.processedOpusPaths removeAllObjects];
  [self.convertingPackedTimes removeAllObjects];

  __weak typeof(self) weakSelf = self;
  self.audioManager.receiveFileCompletion = ^(BLEReceiveStatus status) {
    dispatch_async(dispatch_get_main_queue(), ^{
      __strong typeof(weakSelf) self = weakSelf;
      if (!self) return;
      [self handleReceiveStatus:status generation:generation];
    });
  };

  self.audioManager.receiveFileProgressBlock =
      ^(BLEReceiveStatus status, NSInteger currentPacket, NSInteger totalPackets,
        NSInteger currentFileIndex, NSInteger totalFiles) {
    dispatch_async(dispatch_get_main_queue(), ^{
      __strong typeof(weakSelf) self = weakSelf;
      if (!self || generation != self.syncGeneration) return;
      [self touchSyncActivity];
      NSInteger pct = totalPackets > 0 ? (currentPacket * 100 / totalPackets) : 0;
      [self emit:@"yanqiangVoiceSyncProgress" body:@{
        @"fileName": @"",
        @"fileTime": @0,
        @"progress": @(pct),
        @"currentFile": @(currentFileIndex),
        @"totalFiles": @(totalFiles)
      }];
    });
  };

  dispatch_block_t timeout = dispatch_block_create(0, ^{
    __strong typeof(weakSelf) self = weakSelf;
    if (!self) return;
    [self failSyncWithCode:@"YANQIANG_SYNC_TIMEOUT"
                   message:[NSString stringWithFormat:@"Voice recording sync timed out after %.0f seconds", kRecordingSyncTimeoutSec]
                generation:generation];
  });
  self.syncTimeoutBlock = timeout;
  dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(kRecordingSyncTimeoutSec * NSEC_PER_SEC)),
                 dispatch_get_main_queue(), timeout);

  [self.audioManager fetchLargeAudioFile:^(BOOL sendOk) {
    dispatch_async(dispatch_get_main_queue(), ^{
      __strong typeof(weakSelf) self = weakSelf;
      if (!self) return;
      if (!sendOk) {
        [self failSyncWithCode:@"YANQIANG_SYNC_START_FAILED"
                       message:@"fetchLargeAudioFile send failed"
                    generation:generation];
        return;
      }
      NSLog(@"[YanqiangVoice] fetchLargeAudioFile request sent");
      [self emit:@"yanqiangVoiceSyncState" body:@{
        @"phase": @"start",
        @"code": @1,
        @"message": @"fetchLargeAudioFile sent"
      }];
    });
  }];
}

RCT_REMAP_METHOD(getVoiceRecordParam,
                 getVoiceRecordParamWithResolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
  [self configureIfNeeded];
  if (!self.authSucceeded) {
    reject(@"YANQIANG_GET_RECORD_PARAM_FAILED", @"Ring is not authenticated", nil);
    return;
  }
  BOOL started = [self.audioManager getCurrentRecordParamsWithCompletion:^(uint16_t bitrate, uint8_t volume, uint8_t light, NSArray<NSString *> *extraInfo) {
    dispatch_async(dispatch_get_main_queue(), ^{
      resolve(@{
        @"code": @1,
        @"message": @"ok",
        @"data": @{
          @"bitrate": @(bitrate),
          @"volume": @(volume),
          @"lightBrightness": @(light)
        }
      });
    });
  }];
  if (!started) {
    reject(@"YANQIANG_GET_RECORD_PARAM_FAILED", @"Failed to send getCurrentRecordParams", nil);
  }
}

RCT_REMAP_METHOD(setVoiceRecordParam,
                 setVoiceRecordParam:(nonnull NSNumber *)bitrate
                 volume:(nonnull NSNumber *)volume
                 lightBrightness:(nonnull NSNumber *)lightBrightness
                 resolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
  [self configureIfNeeded];
  if (!self.authSucceeded) {
    reject(@"YANQIANG_SET_RECORD_PARAM_FAILED", @"Ring is not authenticated", nil);
    return;
  }
  BOOL started = [self.audioManager setRecordParamsWithBitrate:(uint16_t)bitrate.unsignedIntValue
                                                       volume:(uint8_t)volume.unsignedIntValue
                                                        light:(uint8_t)lightBrightness.unsignedIntValue
                                                   completion:^(BOOL success) {
    dispatch_async(dispatch_get_main_queue(), ^{
      if (!success) {
        reject(@"YANQIANG_SET_RECORD_PARAM_FAILED", @"setRecordParams failed", nil);
        return;
      }
      resolve(@{
        @"code": @1,
        @"message": @"ok",
        @"data": @{
          @"bitrate": bitrate,
          @"volume": volume,
          @"lightBrightness": lightBrightness
        }
      });
    });
  }];
  if (!started) {
    reject(@"YANQIANG_SET_RECORD_PARAM_FAILED", @"Failed to send setRecordParams", nil);
  }
}

#pragma mark - Vibration / Alarm (debug)

RCT_REMAP_METHOD(sendVibrationWithType,
                 sendVibrationWithType:(nonnull NSNumber *)type
                 times:(nonnull NSNumber *)times
                 resolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
  [self configureIfNeeded];
  if (!self.authSucceeded) {
    reject(@"YANQIANG_VIBRATION_FAILED", @"Ring is not authenticated (vendorReady required)", nil);
    return;
  }

  NSInteger rawType = type.integerValue;
  if (rawType < BTVibrationTypeSystemEvent || rawType > BTVibrationTypeCareReminder) {
    reject(@"YANQIANG_VIBRATION_FAILED", @"Invalid vibration type (expect 1-6)", nil);
    return;
  }

  NSInteger buzzCount = times.integerValue;
  if (buzzCount < 1) buzzCount = 1;
  if (buzzCount > 20) buzzCount = 20;

  BTVibrationType vibrationType = (BTVibrationType)rawType;
  // Mode index is 0x01-0x05; map CareReminder(6) onto mode 5.
  UInt8 modeIndex = (UInt8)MIN(MAX(rawType, 1), 5);

  // One clear pulse per command. Firmware mode "times" often caps (~4), so multi-buzz
  // uses sequential sends with a wide gap instead of relying on mode.times.
  BTVibrationConfigModel *mode = [[BTVibrationConfigModel alloc] init];
  mode.index = modeIndex;
  mode.times = 1;
  mode.duration = 4;   // 400ms per buzz — easier to feel as one tick
  mode.interval = 6;   // 600ms (used if firmware chains internally)
  mode.frequency = 200;
  mode.volume = 100;

  // Gap between sequential commands: must exceed duration so pulses don't merge.
  const NSTimeInterval kSequentialGapSec = 0.85;

  BTVibrationSwitch *sw = [[BTVibrationSwitch alloc] initWithType:vibrationType isOn:YES];
  __weak typeof(self) weakSelf = self;
  NSInteger capturedCount = buzzCount;

  void (^fireOnce)(void) = ^{
    __strong typeof(weakSelf) self = weakSelf;
    if (!self) return;
    BOOL sent = [self.service.vibrationReq sendVibrationWithType:vibrationType
                                                     completion:^(BOOL success) {
      dispatch_async(dispatch_get_main_queue(), ^{
        if (!success) {
          reject(@"YANQIANG_VIBRATION_FAILED", @"sendVibrationWithType ACK failed", nil);
          return;
        }
        NSLog(@"[YanqiangVoice] vibration ok type=%ld times=1", (long)rawType);
        resolve(@{ @"ok": @YES, @"type": @(rawType), @"times": @1, @"mode": @"single" });
      });
    }];
    if (!sent) {
      reject(@"YANQIANG_VIBRATION_FAILED", @"Failed to send vibration request", nil);
    }
  };

  void (^fireSequentialBurst)(void) = ^{
    __strong typeof(weakSelf) self = weakSelf;
    if (!self) return;
    NSLog(@"[YanqiangVoice] sequential burst x%ld gap=%.2fs", (long)capturedCount, kSequentialGapSec);
    __block NSInteger sentOk = 0;
    __block NSInteger done = 0;
    for (NSInteger i = 0; i < capturedCount; i++) {
      NSTimeInterval delay = i * kSequentialGapSec;
      dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(delay * NSEC_PER_SEC)),
                     dispatch_get_main_queue(), ^{
        __strong typeof(weakSelf) inner = weakSelf;
        if (!inner) return;
        BOOL started = [inner.service.vibrationReq sendVibrationWithType:vibrationType
                                                             completion:^(BOOL success) {
          dispatch_async(dispatch_get_main_queue(), ^{
            if (success) sentOk += 1;
            done += 1;
            if (done < capturedCount) return;
            if (sentOk == 0) {
              reject(@"YANQIANG_VIBRATION_FAILED", @"All sequential vibration sends failed", nil);
              return;
            }
            resolve(@{
              @"ok": @YES,
              @"type": @(rawType),
              @"times": @(capturedCount),
              @"mode": @"sequential",
              @"gapMs": @((NSInteger)(kSequentialGapSec * 1000)),
              @"sentOk": @(sentOk)
            });
          });
        }];
        if (!started) {
          done += 1;
          if (done >= capturedCount) {
            if (sentOk == 0) {
              reject(@"YANQIANG_VIBRATION_FAILED", @"Failed to queue sequential vibrations", nil);
            } else {
              resolve(@{
                @"ok": @YES,
                @"type": @(rawType),
                @"times": @(capturedCount),
                @"mode": @"sequential",
                @"gapMs": @((NSInteger)(kSequentialGapSec * 1000)),
                @"sentOk": @(sentOk)
              });
            }
          }
        }
      });
    }
  };

  void (^afterMode)(void) = ^{
    if (capturedCount <= 1) {
      fireOnce();
    } else {
      // Do not trust firmware mode.times for multi-buzz (often feels like ~4).
      fireSequentialBurst();
    }
  };

  void (^afterSwitch)(void) = ^{
    __strong typeof(weakSelf) self = weakSelf;
    if (!self) return;
    BOOL modeSent = [self.service.vibrationConfigReq setVibrationModeConfiguration:mode
                                                                        completion:^(BOOL modeOk) {
      dispatch_async(dispatch_get_main_queue(), ^{
        if (!modeOk) {
          NSLog(@"[YanqiangVoice] vibration mode ACK failed — continue with default pulse");
        } else {
          NSLog(@"[YanqiangVoice] vibration mode set index=%u single-pulse duration=%u interval=%u",
                modeIndex, mode.duration, mode.interval);
        }
        afterMode();
      });
    }];
    if (!modeSent) {
      afterMode();
    }
  };

  BOOL switchSent = [self.service.vibrationReq sendVibrationSwitchSettings:@[sw]
                                                               completion:^(BOOL switchOk) {
    if (!switchOk) {
      NSLog(@"[YanqiangVoice] vibration switch ACK failed type=%ld — still trying", (long)rawType);
    }
    afterSwitch();
  }];
  if (!switchSent) {
    afterSwitch();
  }
}

RCT_REMAP_METHOD(setOneMinuteAlarm,
                 setOneMinuteAlarmWithResolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
  [self configureIfNeeded];
  if (!self.authSucceeded) {
    reject(@"YANQIANG_ALARM_FAILED", @"Ring is not authenticated (vendorReady required)", nil);
    return;
  }

  NSDate *fireAt = [[NSDate date] dateByAddingTimeInterval:60];
  NSCalendar *calendar = [NSCalendar currentCalendar];
  NSDateComponents *parts = [calendar components:(NSCalendarUnitHour | NSCalendarUnitMinute)
                                        fromDate:fireAt];
  UInt8 hour = (UInt8)parts.hour;
  UInt8 minute = (UInt8)parts.minute;

  BTAlarm *alarm = [[BTAlarm alloc] init];
  alarm.alarmID = 1;
  alarm.duration = 1; // ring duration (minutes)
  alarm.repeatDays = 0;
  alarm.isRepeatDays = NO;
  alarm.hour = hour;
  alarm.minute = minute;
  alarm.isOn = YES;
  alarm.name = @"Spur 1min";
  // Overwrite slot 1 so repeated debug taps stay reliable.
  alarm.type = BTAlarmTypeModify;

  NSData *timestamp = [BTAlarm getZeroTimeIntervalDataByDate:[NSDate date]];
  if (timestamp.length == 0) {
    timestamp = [SNBleTimeUtils getZeroTimeIntervalDataByDate:[NSDate date]];
  }

  BTVibrationSwitch *alarmSwitch =
      [[BTVibrationSwitch alloc] initWithType:BTVibrationTypeAlarm isOn:YES];
  __weak typeof(self) weakSelf = self;

  void (^resolveOk)(void) = ^{
    NSLog(@"[YanqiangVoice] one-minute alarm set id=1 at %02u:%02u", hour, minute);
    resolve(@{
      @"ok": @YES,
      @"alarmID": @1,
      @"hour": @(hour),
      @"minute": @(minute),
      @"fireAt": @((NSInteger)[fireAt timeIntervalSince1970])
    });
  };

  void (^tryAdd)(void) = ^{
    __strong typeof(weakSelf) self = weakSelf;
    if (!self) return;
    alarm.type = BTAlarmTypeAdd;
    [self.service.vibrationReq setAlarm:alarm
                              timestamp:timestamp
                             completion:^(BOOL success, NSError * _Nullable error) {
      dispatch_async(dispatch_get_main_queue(), ^{
        if (!success) {
          NSString *msg = error.localizedDescription ?: @"setAlarm Add failed after Modify failed";
          reject(@"YANQIANG_ALARM_FAILED", msg, error);
          return;
        }
        resolveOk();
      });
    }];
  };

  void (^doSetAlarm)(void) = ^{
    __strong typeof(weakSelf) self = weakSelf;
    if (!self) return;
    alarm.type = BTAlarmTypeModify;
    [self.service.vibrationReq setAlarm:alarm
                              timestamp:timestamp
                             completion:^(BOOL success, NSError * _Nullable error) {
      dispatch_async(dispatch_get_main_queue(), ^{
        if (success) {
          resolveOk();
          return;
        }
        NSLog(@"[YanqiangVoice] Modify alarm failed (%@) — retry Add",
              error.localizedDescription ?: @"unknown");
        tryAdd();
      });
    }];
  };

  BOOL switchSent = [self.service.vibrationReq sendVibrationSwitchSettings:@[alarmSwitch]
                                                               completion:^(BOOL switchOk) {
    if (!switchOk) {
      NSLog(@"[YanqiangVoice] alarm vibration switch ACK failed — still setting alarm");
    }
    doSetAlarm();
  }];
  if (!switchSent) {
    doSetAlarm();
  }
}

@end
