import Foundation

@main
struct SpurFileSpeechTests {
  @MainActor static func main() async throws {
    let url = URL(fileURLWithPath: "/tmp/not-a-real-recording.caf")
    var callbacks = 0
    var started = false
    let cancelled = SpurFileSpeech { _ in
      started = true
      // Simulate a system operation that ignores cancellation and returns late.
      try? await Task.sleep(nanoseconds: 30_000_000)
      return "late result"
    }
    cancelled.recognizeURL(url) { _, _ in callbacks += 1 }
    while !started { await Task.yield() }
    cancelled.cancel()
    try await Task.sleep(nanoseconds: 50_000_000)
    precondition(callbacks == 0, "Cancelled recognition must never deliver a result")

    var delivered: [String] = []
    var attempt = 0
    let replaced = SpurFileSpeech { _ in
      attempt += 1
      let current = attempt
      try? await Task.sleep(nanoseconds: 20_000_000)
      return "result-\(current)"
    }
    replaced.recognizeURL(url) { text, _ in delivered.append(text ?? "") }
    while attempt == 0 { await Task.yield() }
    replaced.recognizeURL(url) { text, _ in delivered.append(text ?? "") }
    try await Task.sleep(nanoseconds: 60_000_000)
    precondition(delivered == ["result-2"], "Superseded recognition must not overwrite a newer result")

    let failed = SpurFileSpeech { _ in throw NSError(domain: "fixture", code: 201) }
    var errorCode: Int?
    failed.recognizeURL(url) { text, error in
      precondition(text == nil)
      errorCode = error?.code
    }
    try await Task.sleep(nanoseconds: 20_000_000)
    precondition(errorCode == 201, "Failure must reach the caller without a false transcript")
    print("SpurFileSpeech cancellation, replacement and failure tests passed")
  }
}
