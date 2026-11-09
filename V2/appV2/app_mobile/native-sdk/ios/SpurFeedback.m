#import <React/RCTBridgeModule.h>
#import <UIKit/UIKit.h>

@interface SpurFeedback : NSObject <RCTBridgeModule>
@end

@implementation SpurFeedback
RCT_EXPORT_MODULE(SpurFeedback)
+ (BOOL)requiresMainQueueSetup { return NO; }
- (dispatch_queue_t)methodQueue { return dispatch_get_main_queue(); }
RCT_EXPORT_METHOD(selection) {
    UISelectionFeedbackGenerator *feedback = [UISelectionFeedbackGenerator new];
    [feedback selectionChanged];
}
@end
