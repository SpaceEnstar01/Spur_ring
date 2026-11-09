import Foundation
import Security
import React

/// Device bearer credentials and short-lived execution receipts never enter AsyncStorage.
@objc(SpurIdentity)
class SpurIdentity: NSObject {
  @objc static func requiresMainQueueSetup() -> Bool { false }
  private func query(_ scope: String) -> [String: Any] {
    [kSecClass as String: kSecClassGenericPassword,
     kSecAttrService as String: "com.spur.recordingring.agent.v1",
     kSecAttrAccount as String: scope]
  }
  @objc func read(_ scope: String, resolver resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    var request = query(scope)
    request[kSecReturnData as String] = true
    request[kSecMatchLimit as String] = kSecMatchLimitOne
    var result: CFTypeRef?
    let status = SecItemCopyMatching(request as CFDictionary, &result)
    if status == errSecItemNotFound { resolve(nil); return }
    guard status == errSecSuccess, let data = result as? Data,
          let value = String(data: data, encoding: .utf8) else {
      reject("KEYCHAIN_READ", "安全身份暂时无法读取，已停止执行", nil); return
    }
    resolve(value)
  }
  @objc func write(_ scope: String, value: String, resolver resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    guard scope.count <= 512, let data = value.data(using: .utf8), data.count < 1000000 else {
      reject("INVALID", "安全凭据格式无效", nil); return
    }
    let attributes: [String: Any] = [kSecValueData as String: data,
      kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly]
    var status = SecItemUpdate(query(scope) as CFDictionary, attributes as CFDictionary)
    if status == errSecItemNotFound {
      status = SecItemAdd(query(scope).merging(attributes) { _, new in new } as CFDictionary, nil)
    }
    if status != errSecSuccess { reject("KEYCHAIN_WRITE", "安全凭据未保存，操作已停止", nil); return }
    resolve(true)
  }
  @objc func newId(_ resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    resolve(UUID().uuidString.lowercased())
  }
}
