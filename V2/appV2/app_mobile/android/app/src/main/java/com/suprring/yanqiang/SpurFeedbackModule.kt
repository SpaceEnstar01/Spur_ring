package com.suprring.yanqiang

import android.view.HapticFeedbackConstants
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class SpurFeedbackModule(context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  override fun getName() = "SpurFeedback"

  @ReactMethod
  fun selection() {
    reactApplicationContext.runOnUiQueueThread {
      reactApplicationContext.currentActivity?.window?.decorView
        ?.performHapticFeedback(HapticFeedbackConstants.KEYBOARD_TAP)
    }
  }
}
