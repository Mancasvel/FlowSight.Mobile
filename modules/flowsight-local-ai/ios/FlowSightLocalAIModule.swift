import ExpoModulesCore
import CryptoKit
import Foundation

#if canImport(FoundationModels) && !targetEnvironment(simulator)
import FoundationModels
#endif

/// Apple on-device text generation + SHA-256 for the Qwen GGUF.
/// Qwen3-0.6B itself runs in JS (llama.rn), not here.
public class FlowSightLocalAIModule: Module {
  public func definition() -> ModuleDefinition {
    Name("FlowSightLocalAI")

    AsyncFunction("getStatus") { () -> [String: Any] in
      LocalPatternEngine.status()
    }

    AsyncFunction("generatePatterns") { (stats: String, promise: Promise) in
      Task {
        let result = await LocalPatternEngine.generate(stats: stats)
        promise.resolve(result)
      }
    }

    AsyncFunction("sha256File") { (path: String) -> String in
      try LocalPatternEngine.sha256(path: path)
    }
  }
}

enum LocalPatternEngine {
  static let engineName = "apple-foundation-models"

  static func status() -> [String: Any] {
    #if canImport(FoundationModels) && !targetEnvironment(simulator)
    if #available(iOS 26.0, *) {
      return appleStatus()
    }
    #endif
    return [
      "available": false,
      "reason": "os",
      "engine": "none",
      "modelId": engineName,
      "detail": "Apple Intelligence is not on this iOS version.",
    ]
  }

  static func generate(stats: String) async -> [String: Any] {
    #if canImport(FoundationModels) && !targetEnvironment(simulator)
    if #available(iOS 26.0, *) {
      return await appleGenerate(stats: stats)
    }
    #endif
    return [
      "ok": false,
      "reason": "os",
      "modelId": engineName,
      "detail": "Apple Intelligence is not on this iOS version.",
    ]
  }

  static func sha256(path: String) throws -> String {
    let raw = path.hasPrefix("file://") ? String(path.dropFirst(7)) : path
    let url = URL(fileURLWithPath: raw)
    let handle = try FileHandle(forReadingFrom: url)
    defer { try? handle.close() }
    var hasher = SHA256()
    while true {
      let chunk = handle.readData(ofLength: 1 << 20)
      if chunk.isEmpty { break }
      hasher.update(data: chunk)
    }
    return hasher.finalize().map { String(format: "%02x", $0) }.joined()
  }

  #if canImport(FoundationModels) && !targetEnvironment(simulator)
  @available(iOS 26.0, *)
  static func appleStatus() -> [String: Any] {
    let model = SystemLanguageModel.default
    switch model.availability {
    case .available:
      return [
        "available": true,
        "reason": "ready",
        "engine": engineName,
        "modelId": "SystemLanguageModel",
        "detail": "Apple on-device model ready.",
      ]
    case .unavailable(.deviceNotEligible):
      return unavailable("device", "This iPhone does not support Apple Intelligence.")
    case .unavailable(.appleIntelligenceNotEnabled):
      return unavailable("disabled", "Turn on Apple Intelligence to write patterns on-device.")
    case .unavailable(.modelNotReady):
      return unavailable("not-ready", "The on-device model is still downloading. Using session rules until it is ready.")
    case .unavailable(let other):
      return unavailable("unavailable", String(describing: other))
    @unknown default:
      return unavailable("unavailable", "On-device model is not available.")
    }
  }

  @available(iOS 26.0, *)
  static func unavailable(_ reason: String, _ detail: String) -> [String: Any] {
    [
      "available": false,
      "reason": reason,
      "engine": engineName,
      "modelId": "SystemLanguageModel",
      "detail": detail,
    ]
  }

  @available(iOS 26.0, *)
  static func appleGenerate(stats: String) async -> [String: Any] {
    let model = SystemLanguageModel.default
    guard case .available = model.availability else {
      var payload = appleStatus()
      payload["ok"] = false
      return payload
    }

    let instructions = """
    You are an expert productivity consultant. English only. Output valid JSON only ? no markdown.
    Use ONLY the STATS the user provides. Cite specific hours, app names, pause counts, and session lengths.
    Be concrete and actionable. Avoid generic filler.
    Return {"patterns":[{"title":"short title","body":"1-2 sentences, max 220 characters"}],"note":"3-5 sentences, max 600 characters"} with 3 to 5 pattern items.
    """

    let prompt = """
    Write 3 to 5 work-pattern cards and a short week's note from STATS.

    STATS:
    \(stats)
    """

    do {
      let session = LanguageModelSession(instructions: instructions)
      let options = GenerationOptions(temperature: 0.25)
      let response = try await session.respond(to: prompt, options: options)
      return [
        "ok": true,
        "text": response.content,
        "engine": engineName,
        "modelId": "SystemLanguageModel",
      ]
    } catch {
      return [
        "ok": false,
        "reason": "error",
        "engine": engineName,
        "modelId": "SystemLanguageModel",
        "detail": error.localizedDescription,
      ]
    }
  }
  #endif
}
