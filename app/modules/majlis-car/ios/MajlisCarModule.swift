import AVFoundation
import ExpoModulesCore
import MediaPlayer

// Mirrors the Android module: owns playback outside React and publishes
// now-playing metadata so CarPlay and the lock screen can drive it.
public class MajlisCarModule: Module {
  private let player = AVPlayer()
  var queue: [[String: Any]] = []
  var currentIndex = 0
  private var timeObserver: Any?
  private var endObserver: NSObjectProtocol?
  private let carPlaySource = CarPlayContentSource()

  public func definition() -> ModuleDefinition {
    Name("MajlisCar")
    Events("playbackState")

    OnCreate {
      self.configureSession()
      self.observeTime()
      self.carPlaySource.owner = self
      self.carPlaySource.reload()
      MPPlayableContentManager.shared().dataSource = self.carPlaySource
      MPPlayableContentManager.shared().delegate = self.carPlaySource
      MPPlayableContentManager.shared().reloadData()
    }

    OnDestroy {
      if let observer = self.timeObserver {
        self.player.removeTimeObserver(observer)
      }
      if let endObserver = self.endObserver {
        NotificationCenter.default.removeObserver(endObserver)
      }
    }

    Function("start") {
      self.configureSession()
      return true
    }

    AsyncFunction("setQueue") { (queueJson: String) -> Bool in
      guard
        let data = queueJson.data(using: .utf8),
        let entries = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]]
      else { return false }
      self.queue = entries
      self.currentIndex = 0
      self.loadCurrent(autoplay: true)
      return true
    }

    Function("play") { self.player.play() }
    Function("pause") { self.player.pause() }

    Function("seekTo") { (seconds: Double) in
      self.player.seek(to: CMTime(seconds: seconds, preferredTimescale: 600))
    }

    Function("next") { self.move(by: 1) }
    Function("previous") { self.move(by: -1) }

    AsyncFunction("reloadLibrary") {
      self.carPlaySource.reload()
      MPPlayableContentManager.shared().reloadData()
    }.runOnQueue(.main)

    Function("getState") { () -> [String: Any] in
      let item = self.player.currentItem
      let duration = item?.duration.seconds ?? 0
      return [
        "available": true,
        "playing": self.player.timeControlStatus == .playing,
        "positionMs": self.player.currentTime().seconds * 1000,
        "durationMs": duration.isFinite ? duration * 1000 : 0,
        "index": self.currentIndex,
        "count": self.queue.count,
        "ended": false,
      ]
    }
  }

  private func configureSession() {
    let session = AVAudioSession.sharedInstance()
    try? session.setCategory(.playback, mode: .spokenAudio)
    try? session.setActive(true)
    setupRemoteCommands()
  }

  private func setupRemoteCommands() {
    let center = MPRemoteCommandCenter.shared()
    center.playCommand.addTarget { _ in self.player.play(); return .success }
    center.pauseCommand.addTarget { _ in self.player.pause(); return .success }
    center.togglePlayPauseCommand.addTarget { _ in
      self.player.timeControlStatus == .playing ? self.player.pause() : self.player.play()
      return .success
    }
    center.nextTrackCommand.addTarget { _ in self.move(by: 1); return .success }
    center.previousTrackCommand.addTarget { _ in self.move(by: -1); return .success }
    center.changePlaybackPositionCommand.addTarget { event in
      guard let event = event as? MPChangePlaybackPositionCommandEvent else { return .commandFailed }
      self.player.seek(to: CMTime(seconds: event.positionTime, preferredTimescale: 600))
      return .success
    }
  }

  func playCurrent() {
    loadCurrent(autoplay: true)
  }

  private func move(by offset: Int) {
    let next = currentIndex + offset
    guard queue.indices.contains(next) else { return }
    currentIndex = next
    loadCurrent(autoplay: true)
  }

  private func loadCurrent(autoplay: Bool) {
    guard let entry = queue[safe: currentIndex], let uri = entry["uri"] as? String,
          let url = URL(string: uri) else { return }
    let item = AVPlayerItem(url: url)
    player.replaceCurrentItem(with: item)
    publishMetadata(entry)
    if autoplay { player.play() }

    if let endObserver = endObserver {
      NotificationCenter.default.removeObserver(endObserver)
    }
    endObserver = NotificationCenter.default.addObserver(
      forName: .AVPlayerItemDidPlayToEndTime,
      object: item,
      queue: .main
    ) { _ in
      if self.currentIndex + 1 < self.queue.count {
        self.currentIndex += 1
        self.loadCurrent(autoplay: true)
      } else {
        self.emitState(ended: true)
      }
    }
  }

  private func publishMetadata(_ entry: [String: Any]) {
    var info: [String: Any] = [
      MPMediaItemPropertyTitle: entry["title"] as? String ?? "",
      MPMediaItemPropertyArtist: entry["artist"] as? String ?? "",
    ]
    if let artwork = nowPlayingArtwork(entry["artworkUri"] as? String) {
      info[MPMediaItemPropertyArtwork] = artwork
    }
    MPNowPlayingInfoCenter.default().nowPlayingInfo = info
  }

  // The lock screen and CarPlay draw the scrubber from these; they don't track the player.
  private func updateNowPlayingProgress() {
    let center = MPNowPlayingInfoCenter.default()
    guard var info = center.nowPlayingInfo else { return }
    let duration = player.currentItem?.duration.seconds ?? 0
    if duration.isFinite { info[MPMediaItemPropertyPlaybackDuration] = duration }
    info[MPNowPlayingInfoPropertyElapsedPlaybackTime] = player.currentTime().seconds
    info[MPNowPlayingInfoPropertyPlaybackRate] = player.rate
    center.nowPlayingInfo = info
  }

  private func observeTime() {
    let interval = CMTime(seconds: 0.5, preferredTimescale: 600)
    // Also fires when playback starts or stops, so a pause reaches Now Playing.
    timeObserver = player.addPeriodicTimeObserver(forInterval: interval, queue: .main) { [weak self] _ in
      self?.emitState(ended: false)
      self?.updateNowPlayingProgress()
    }
  }

  private func emitState(ended: Bool) {
    let item = player.currentItem
    let duration = item?.duration.seconds ?? 0
    sendEvent("playbackState", [
      "available": true,
      "playing": player.timeControlStatus == .playing,
      "positionMs": player.currentTime().seconds * 1000,
      "durationMs": duration.isFinite ? duration * 1000 : 0,
      "index": currentIndex,
      "count": queue.count,
      "ended": ended,
    ])
  }
}

private extension Array {
  subscript(safe index: Int) -> Element? {
    indices.contains(index) ? self[index] : nil
  }
}

private func nowPlayingArtwork(_ uri: String?) -> MPMediaItemArtwork? {
  guard
    let uri, let url = URL(string: uri),
    let data = try? Data(contentsOf: url),
    let image = UIImage(data: data)
  else { return nil }
  return MPMediaItemArtwork(boundsSize: image.size) { _ in image }
}

// MARK: - CarPlay browsing

struct CarHadithEntry {
  let id: String
  let title: String
  let artist: String
  let artworkUri: String?
  let segments: [[String: String]]
}

/// CarPlay needs an NSObject conformer, which the Expo Module class is not.
final class CarPlayContentSource: NSObject, MPPlayableContentDataSource, MPPlayableContentDelegate {
  weak var owner: MajlisCarModule?
  private var library: [CarHadithEntry] = []
  // Every hadith shares one list thumbnail, so it is decoded once per reload.
  private var thumbnail: MPMediaItemArtwork?

  func reload() {
    guard
      let documents = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first,
      let data = try? Data(contentsOf: documents.appendingPathComponent("car-index.json")),
      let root = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
      let entries = root["hadiths"] as? [[String: Any]]
    else {
      library = []
      thumbnail = nil
      return
    }

    library = entries.compactMap { entry in
      guard
        let id = entry["id"] as? String,
        let title = entry["title"] as? String,
        let segments = entry["segments"] as? [[String: Any]]
      else { return nil }
      return CarHadithEntry(
        id: id,
        title: title,
        artist: entry["artist"] as? String ?? "",
        artworkUri: entry["artworkUri"] as? String,
        segments: segments.compactMap { segment in
          guard let uri = segment["uri"] as? String else { return nil }
          return ["uri": uri, "title": segment["title"] as? String ?? ""]
        }
      )
    }
    thumbnail = nowPlayingArtwork(entries.first?["thumbnailUri"] as? String)
  }

  func numberOfChildItems(at indexPath: IndexPath) -> Int {
    indexPath.isEmpty ? library.count : 0
  }

  func contentItem(at indexPath: IndexPath) -> MPContentItem? {
    guard indexPath.count == 1, library.indices.contains(indexPath[0]) else { return nil }
    let hadith = library[indexPath[0]]
    let item = MPContentItem(identifier: hadith.id)
    item.title = hadith.title
    item.subtitle = hadith.artist
    item.artwork = thumbnail
    item.isPlayable = true
    return item
  }

  func playableContentManager(
    _ contentManager: MPPlayableContentManager,
    initiatePlaybackOfContentItemAt indexPath: IndexPath,
    completionHandler: @escaping (Error?) -> Void
  ) {
    guard indexPath.count == 1, library.indices.contains(indexPath[0]), let owner else {
      completionHandler(nil)
      return
    }
    let hadith = library[indexPath[0]]
    owner.queue = hadith.segments.map { segment in
      var entry: [String: Any] = [
        "uri": segment["uri"] ?? "",
        "title": "\(hadith.title) — \(segment["title"] ?? "")",
        "artist": hadith.artist,
      ]
      if let artworkUri = hadith.artworkUri { entry["artworkUri"] = artworkUri }
      return entry
    }
    owner.currentIndex = 0
    owner.playCurrent()
    contentManager.nowPlayingIdentifiers = [hadith.id]
    completionHandler(nil)
  }
}
