import Foundation
import React
import AlarmKit
import SwiftUI

@available(iOS 26.0, *)
private struct SpurAlarmMetadata: AlarmMetadata {}

@objc(SpurAlarm)
class SpurAlarm: NSObject {
  @objc static func requiresMainQueueSetup() -> Bool { true }
  private let ledgerKey = "spur-alarm-ledger-v1"

  private func ledger() -> [String: String] {
    UserDefaults.standard.dictionary(forKey: ledgerKey) as? [String: String] ?? [:]
  }
  private func mark(_ id: String, _ state: String) {
    var values = ledger()
    values[id] = state
    UserDefaults.standard.set(values, forKey: ledgerKey)
  }

  @objc func status(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    Task { @MainActor in
      guard #available(iOS 26.0, *) else {
        resolve(["supported": false, "authorized": false]); return
      }
      resolve(["supported": true, "authorized": AlarmManager.shared.authorizationState == .authorized])
    }
  }

  @objc func authorize(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    Task { @MainActor in
      guard #available(iOS 26.0, *) else {
        reject("UNSUPPORTED", "系统闹钟需要 iOS 26 或更新版本", nil); return
      }
      do {
        let state = try await AlarmManager.shared.requestAuthorization()
        guard state == .authorized else {
          reject("DENIED", "未获得闹钟权限，请到系统设置允许 Spur 使用闹钟", nil); return
        }
        resolve(true)
      } catch { reject("AUTHORIZATION", error.localizedDescription, error) }
    }
  }

  @objc func schedule(_ identifier: String, timestamp: Double, title: String,
                      resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    Task { @MainActor in
      guard #available(iOS 26.0, *) else {
        reject("UNSUPPORTED", "系统闹钟需要 iOS 26 或更新版本", nil); return
      }
      guard let id = UUID(uuidString: identifier), timestamp.isFinite,
            timestamp / 1000 > Date().timeIntervalSince1970 + 5 else {
        reject("INVALID_TIME", "闹钟时间已过或无效，请重新确认", nil); return
      }
      guard AlarmManager.shared.authorizationState == .authorized else {
        reject("DENIED", "闹钟权限未开启，请在首页重新授权", nil); return
      }
      do {
        if ledger()[identifier] == "cancelled" {
          reject("CANCELLED", "此闹钟已取消，不会重复创建", nil); return
        }
        if try AlarmManager.shared.alarms.contains(where: { $0.id == id }) {
          mark(identifier, "scheduled"); resolve(true); return
        }
        if ledger()[identifier] == "scheduled" {
          reject("MISSING", "闹钟已结束或在系统中移除，不会自动重建", nil); return
        }
        mark(identifier, "scheduling")
        let alert = AlarmPresentation.Alert(
          title: LocalizedStringResource(stringLiteral: String(title.prefix(60))),
          stopButton: AlarmButton(text: "停止", textColor: .white, systemImageName: "stop.circle")
        )
        let attributes = AlarmAttributes<SpurAlarmMetadata>(
          presentation: AlarmPresentation(alert: alert), metadata: SpurAlarmMetadata(), tintColor: .blue
        )
        let configuration = AlarmManager.AlarmConfiguration.alarm(
          schedule: .fixed(Date(timeIntervalSince1970: timestamp / 1000)), attributes: attributes
        )
        _ = try await AlarmManager.shared.schedule(id: id, configuration: configuration)
        mark(identifier, "scheduled")
        resolve(true)
      } catch { reject("SCHEDULE_FAILED", error.localizedDescription, error) }
    }
  }

  @objc func list(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    Task { @MainActor in
      guard #available(iOS 26.0, *) else { resolve([]); return }
      do {
        // AlarmKit exposes only this application's alarms. Query the OS rather than
        // filtering by our journal: a process can die after OS success but before disk flush.
        let alarms = try AlarmManager.shared.alarms
        for alarm in alarms where ledger()[alarm.id.uuidString] == nil {
          mark(alarm.id.uuidString, "scheduled")
        }
        resolve(alarms.map { $0.id.uuidString })
      } catch { reject("QUERY_FAILED", error.localizedDescription, error) }
    }
  }

  @objc func cancel(_ identifier: String, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    Task { @MainActor in
      guard #available(iOS 26.0, *), let id = UUID(uuidString: identifier), ledger()[identifier] != nil else {
        reject("UNKNOWN_ALARM", "无法取消不属于 Spur 的闹钟", nil); return
      }
      do {
        if try AlarmManager.shared.alarms.contains(where: { $0.id == id }) {
          try AlarmManager.shared.cancel(id: id)
        }
        mark(identifier, "cancelled")
        resolve(true)
      } catch { reject("CANCEL_FAILED", error.localizedDescription, error) }
    }
  }
}
