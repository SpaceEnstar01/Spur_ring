import AVFoundation
import Foundation
import Speech

/// A local-only compatibility path for legacy file requests rejected with LSR/201.
/// Only use installed system assets; never upload audio or implicitly download models.
@MainActor
@objc(SpurFileSpeech)
public final class SpurFileSpeech: NSObject {
  private var task: Task<Void, Never>?
  private let operation: (URL) async throws -> String

  public override init() {
    operation = { url in
      guard #available(iOS 26.0, *) else { throw Self.unavailable() }
      return try await Self.recognize(url)
    }
    super.init()
  }

  @nonobjc init(operation: @escaping (URL) async throws -> String) {
    self.operation = operation
    super.init()
  }

  @objc public func recognizeURL(_ url: URL, completion: @escaping (String?, NSError?) -> Void) {
    cancel()
    task = Task { @MainActor in
      do {
        let text = try await operation(url)
        try Task.checkCancellation()
        completion(text, nil)
      } catch {
        // Cancellation is settled by PhoneAudio, never by a delayed callback.
        if !Task.isCancelled { completion(nil, error as NSError) }
      }
    }
  }

  @objc public func cancel() {
    task?.cancel()
    task = nil
  }

  private static func unavailable() -> NSError {
    NSError(domain: "SpurFileSpeech", code: 1, userInfo: nil)
  }

  @available(iOS 26.0, *)
  private static func recognize(_ url: URL) async throws -> String {
    let requested = Locale(identifier: "zh-CN")
    if SpeechTranscriber.isAvailable,
       let locale = await SpeechTranscriber.supportedLocale(equivalentTo: requested) {
      let module = SpeechTranscriber(locale: locale, preset: .transcription)
      if await AssetInventory.status(forModules: [module]) == .installed {
        return try await analyze(url, module: module) {
          var parts: [String] = []
          for try await result in module.results where result.isFinal {
            parts.append(String(result.text.characters))
          }
          return parts.joined(separator: "")
        }
      }
    }
    // DictationTranscriber supports devices/locales unavailable to SpeechTranscriber.
    if let locale = await DictationTranscriber.supportedLocale(equivalentTo: requested) {
      let module = DictationTranscriber(locale: locale, preset: .longDictation)
      if await AssetInventory.status(forModules: [module]) == .installed {
        return try await analyze(url, module: module) {
          var parts: [String] = []
          for try await result in module.results where result.isFinal {
            parts.append(String(result.text.characters))
          }
          return parts.joined(separator: "")
        }
      }
    }
    throw unavailable()
  }

  @available(iOS 26.0, *)
  private static func analyze(_ url: URL, module: any SpeechModule,
                              collect: @escaping () async throws -> String) async throws -> String {
    try Task.checkCancellation()
    let file = try AVAudioFile(forReading: url)
    let analyzer = SpeechAnalyzer(modules: [module])
    return try await withTaskCancellationHandler {
      // Drain results concurrently with analysis: neither side may block the other.
      async let text = collect()
      do {
        try await analyzer.start(inputAudioFile: file, finishAfterFile: true)
        let completed = try await text
        try Task.checkCancellation()
        await analyzer.cancelAndFinishNow()
        return completed.trimmingCharacters(in: .whitespacesAndNewlines)
      } catch {
        await analyzer.cancelAndFinishNow()
        throw error
      }
    } onCancel: {
      Task { await analyzer.cancelAndFinishNow() }
    }
  }
}
