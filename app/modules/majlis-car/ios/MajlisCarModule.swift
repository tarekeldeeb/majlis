import ExpoModulesCore

// A thin bridge: playback lives in MajlisCarPlayer so CarPlay can use it
// without React. The CarPlay UI itself is CarPlaySceneDelegate.
public class MajlisCarModule: Module {
  public func definition() -> ModuleDefinition {
    Name("MajlisCar")
    Events("playbackState")

    OnCreate {
      MajlisCarPlayer.shared.onStateChange = { [weak self] state in
        self?.sendEvent("playbackState", state)
      }
    }

    OnDestroy {
      MajlisCarPlayer.shared.onStateChange = nil
    }

    Function("start") { true }

    AsyncFunction("setQueue") { (queueJson: String) -> Bool in
      guard
        let data = queueJson.data(using: .utf8),
        let entries = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]]
      else { return false }
      MajlisCarPlayer.shared.setQueue(entries.compactMap(CarQueueItem.init(json:)))
      return true
    }

    Function("play") { MajlisCarPlayer.shared.resume() }
    Function("pause") { MajlisCarPlayer.shared.pause() }

    Function("seekTo") { (seconds: Double) in
      MajlisCarPlayer.shared.seek(to: seconds)
    }

    Function("next") { MajlisCarPlayer.shared.next() }
    Function("previous") { MajlisCarPlayer.shared.previous() }

    AsyncFunction("reloadLibrary") {
      MajlisCarPlayer.shared.reloadLibrary()
    }.runOnQueue(.main)

    Function("getState") { () -> [String: Any] in
      MajlisCarPlayer.shared.state()
    }

    // Downloaded narration can always be fetched again, so it stays out of iCloud backups.
    Function("excludeFromBackup") { (uri: String) in
      guard var url = URL(string: uri) else { return }
      var values = URLResourceValues()
      values.isExcludedFromBackup = true
      try url.setResourceValues(values)
    }
  }
}
