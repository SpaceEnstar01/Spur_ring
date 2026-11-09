#import "AppDelegate.h"

#import <React/RCTBundleURLProvider.h>
#import <React/RCTLinkingManager.h>

@interface AppDelegate ()
@property (nonatomic, copy) NSDictionary *reactLaunchOptions;
@end

// Kept in this translation unit so the existing Xcode target includes it.
@interface SpurSceneDelegate : UIResponder <UIWindowSceneDelegate>
@property (nonatomic, strong) UIWindow *window;
@end

@implementation AppDelegate

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
  self.moduleName = @"main";

  // You can add your custom initial props in the dictionary below.
  // They will be passed down to the ViewController used by React Native.
  self.initialProps = @{};

  // Expo/RN still set up their factories and subscribers here. The scene owns
  // window creation; creating a legacy window at launch fails on iOS 27.
  self.automaticallyLoadReactNativeWindow = NO;
  self.reactLaunchOptions = launchOptions;

  return [super application:application didFinishLaunchingWithOptions:launchOptions];
}

- (UISceneConfiguration *)application:(UIApplication *)application
    configurationForConnectingSceneSession:(UISceneSession *)connectingSceneSession
    options:(UISceneConnectionOptions *)options
{
  UISceneConfiguration *configuration = [[UISceneConfiguration alloc]
      initWithName:@"Spur" sessionRole:connectingSceneSession.role];
  configuration.delegateClass = [SpurSceneDelegate class];
  return configuration;
}

- (NSURL *)sourceURLForBridge:(RCTBridge *)bridge
{
  return [self bundleURL];
}

- (NSURL *)bundleURL
{
#if DEBUG
  return [[RCTBundleURLProvider sharedSettings] jsBundleURLForBundleRoot:@".expo/.virtual-metro-entry"];
#else
  return [[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"];
#endif
}

// Linking API
- (BOOL)application:(UIApplication *)application openURL:(NSURL *)url options:(NSDictionary<UIApplicationOpenURLOptionsKey,id> *)options {
  return [super application:application openURL:url options:options] || [RCTLinkingManager application:application openURL:url options:options];
}

// Universal Links
- (BOOL)application:(UIApplication *)application continueUserActivity:(nonnull NSUserActivity *)userActivity restorationHandler:(nonnull void (^)(NSArray<id<UIUserActivityRestoring>> * _Nullable))restorationHandler {
  BOOL result = [RCTLinkingManager application:application continueUserActivity:userActivity restorationHandler:restorationHandler];
  return [super application:application continueUserActivity:userActivity restorationHandler:restorationHandler] || result;
}

// Explicitly define remote notification delegates to ensure compatibility with some third-party libraries
- (void)application:(UIApplication *)application didRegisterForRemoteNotificationsWithDeviceToken:(NSData *)deviceToken
{
  return [super application:application didRegisterForRemoteNotificationsWithDeviceToken:deviceToken];
}

// Explicitly define remote notification delegates to ensure compatibility with some third-party libraries
- (void)application:(UIApplication *)application didFailToRegisterForRemoteNotificationsWithError:(NSError *)error
{
  return [super application:application didFailToRegisterForRemoteNotificationsWithError:error];
}

// Explicitly define remote notification delegates to ensure compatibility with some third-party libraries
- (void)application:(UIApplication *)application didReceiveRemoteNotification:(NSDictionary *)userInfo fetchCompletionHandler:(void (^)(UIBackgroundFetchResult))completionHandler
{
  return [super application:application didReceiveRemoteNotification:userInfo fetchCompletionHandler:completionHandler];
}

@end

@implementation SpurSceneDelegate

- (void)scene:(UIScene *)scene willConnectToSession:(UISceneSession *)session
    options:(UISceneConnectionOptions *)connectionOptions
{
  if (![scene isKindOfClass:[UIWindowScene class]]) {
    return;
  }

  AppDelegate *appDelegate = (AppDelegate *)UIApplication.sharedApplication.delegate;
  if (!appDelegate.window) {
    NSMutableDictionary *launchOptions = [appDelegate.reactLaunchOptions mutableCopy]
        ?: [NSMutableDictionary new];
    UIOpenURLContext *urlContext = connectionOptions.URLContexts.anyObject;
    if (urlContext) {
      launchOptions[UIApplicationLaunchOptionsURLKey] = urlContext.URL;
    }
    for (NSUserActivity *activity in connectionOptions.userActivities) {
      if ([activity.activityType isEqualToString:NSUserActivityTypeBrowsingWeb]) {
        launchOptions[UIApplicationLaunchOptionsUserActivityDictionaryKey] = @{
          UIApplicationLaunchOptionsUserActivityTypeKey: activity.activityType,
          @"UIApplicationLaunchOptionsUserActivityKey": activity
        };
        break;
      }
    }

    UIView *rootView = [appDelegate.rootViewFactory
        viewWithModuleName:appDelegate.moduleName
        initialProperties:appDelegate.initialProps
        launchOptions:launchOptions];
    UIViewController *rootViewController = [appDelegate createRootViewController];
    [appDelegate setRootView:rootView toRootViewController:rootViewController];
    self.window = [[UIWindow alloc] initWithWindowScene:(UIWindowScene *)scene];
    self.window.rootViewController = rootViewController;
    appDelegate.window = self.window;
    appDelegate.reactLaunchOptions = nil;
  } else {
    self.window = appDelegate.window;
    self.window.windowScene = (UIWindowScene *)scene;
  }
  [self.window makeKeyAndVisible];
}

// Expo 52 subscribers still use UIApplicationDelegate callbacks. UIKit's
// application notifications continue to serve RN AppState; do not repost them.
- (void)sceneDidBecomeActive:(UIScene *)scene
{
  [UIApplication.sharedApplication.delegate
      applicationDidBecomeActive:UIApplication.sharedApplication];
}

- (void)sceneWillResignActive:(UIScene *)scene
{
  [UIApplication.sharedApplication.delegate
      applicationWillResignActive:UIApplication.sharedApplication];
}

- (void)sceneWillEnterForeground:(UIScene *)scene
{
  [UIApplication.sharedApplication.delegate
      applicationWillEnterForeground:UIApplication.sharedApplication];
}

- (void)sceneDidEnterBackground:(UIScene *)scene
{
  [UIApplication.sharedApplication.delegate
      applicationDidEnterBackground:UIApplication.sharedApplication];
}

- (void)scene:(UIScene *)scene openURLContexts:(NSSet<UIOpenURLContext *> *)URLContexts
{
  for (UIOpenURLContext *context in URLContexts) {
    NSMutableDictionary *options = [NSMutableDictionary new];
    options[UIApplicationOpenURLOptionsOpenInPlaceKey] = @(context.options.openInPlace);
    if (context.options.sourceApplication) {
      options[UIApplicationOpenURLOptionsSourceApplicationKey] = context.options.sourceApplication;
    }
    if (context.options.annotation) {
      options[UIApplicationOpenURLOptionsAnnotationKey] = context.options.annotation;
    }
    [UIApplication.sharedApplication.delegate application:UIApplication.sharedApplication
        openURL:context.URL options:options];
  }
}

- (void)scene:(UIScene *)scene continueUserActivity:(NSUserActivity *)userActivity
{
  [UIApplication.sharedApplication.delegate application:UIApplication.sharedApplication
      continueUserActivity:userActivity
      restorationHandler:^(NSArray<id<UIUserActivityRestoring>> *objects) {}];
}

- (void)windowScene:(UIWindowScene *)windowScene
    didUpdateCoordinateSpace:(id<UICoordinateSpace>)previousCoordinateSpace
    interfaceOrientation:(UIInterfaceOrientation)previousInterfaceOrientation
    traitCollection:(UITraitCollection *)previousTraitCollection
{
  id<UIWindowSceneDelegate> delegate = (id<UIWindowSceneDelegate>)UIApplication.sharedApplication.delegate;
  if ([delegate respondsToSelector:_cmd]) {
    [delegate windowScene:windowScene didUpdateCoordinateSpace:previousCoordinateSpace
        interfaceOrientation:previousInterfaceOrientation traitCollection:previousTraitCollection];
  }
}

@end
