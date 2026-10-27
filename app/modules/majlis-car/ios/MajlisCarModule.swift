import AVFoundation
import ExpoModulesCore
import MediaPlayer

// Mirrors the Android module: owns playback outside React and publishes
// now-playing metadata so CarPlay and the lock screen can drive it.
public class MajlisCarModule: Module {
  private let player = AVPlayer()
  private var queue: [[String: Any]] = []
  private var currentIndex = 0
  private var timeObserver: Any?
  private var endObserver: NSObjectProtocol?

  public func definition() -> ModuleDefinition {
    Name("MajlisCar")
    Events("playbackState")

    OnCreate {
      self.configureSession()
      self.observeTime()
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
    if let artworkUri = entry["artworkUri"] as? String,
       let url = URL(string: artworkUri),
       let data = try? Data(contentsOf: url),
       let image = UIImage(data: data) {
      info[MPMediaItemPropertyArtwork] = MPMediaItemArtwork(boundsSize: image.size) { _ in image }
    }
    MPNowPlayingInfoCenter.default().nowPlayingInfo = info
  }

  private func observeTime() {
    let interval = CMTime(seconds: 0.5, preferredTimescale: 600)
    timeObserver = player.addPeriodicTimeObserver(forInterval: interval, queue: .main) { [weak self] _ in
      self?.emitState(ended: false)
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
