import AVFoundation
import MediaPlayer
import UIKit

struct CarQueueItem {
  /// "<bookId>:<hadithNumber>:<segment>", the same scheme the app uses.
  let id: String
  let uri: String
  let title: String
  let artist: String
  let artworkUri: String?

  init(id: String, uri: String, title: String, artist: String, artworkUri: String?) {
    self.id = id
    self.uri = uri
    self.title = title
    self.artist = artist
    self.artworkUri = artworkUri
  }

  init?(json: [String: Any]) {
    guard let uri = json["uri"] as? String else { return nil }
    self.init(
      id: json["id"] as? String ?? "",
      uri: uri,
      title: json["title"] as? String ?? "",
      artist: json["artist"] as? String ?? "",
      artworkUri: json["artworkUri"] as? String)
  }
}

struct CarHadith {
  let id: String
  let title: String
  let artist: String
  let artworkUri: String?
  let segments: [(uri: String, title: String)]

  var queue: [CarQueueItem] {
    segments.enumerated().map { index, segment in
      CarQueueItem(
        id: "\(id):\(index)", uri: segment.uri, title: "\(title) — \(segment.title)",
        artist: artist, artworkUri: artworkUri)
    }
  }
}

/// Owns playback outside React, so CarPlay can drive it even when the phone UI
/// (and with it React) was never started.
final class MajlisCarPlayer {
  static let shared = MajlisCarPlayer()
  static let libraryDidChange = Notification.Name("MajlisCarLibraryDidChange")

  var onStateChange: (([String: Any]) -> Void)?
  private(set) var library: [CarHadith] = []
  private(set) var thumbnail: UIImage?

  private let player = AVPlayer()
  private var queue: [CarQueueItem] = []
  private var currentIndex = 0
  private var timeObserver: Any?
  private var endObserver: NSObjectProtocol?

  private init() {
    setupRemoteCommands()
    let interval = CMTime(seconds: 0.5, preferredTimescale: 600)
    // Also fires when playback starts or stops, so a pause reaches Now Playing.
    timeObserver = player.addPeriodicTimeObserver(forInterval: interval, queue: .main) { [weak self] _ in
      self?.publishState(ended: false)
      self?.updateNowPlayingProgress()
    }
    reloadLibrary()
  }

  // MARK: Transport

  func setQueue(_ items: [CarQueueItem]) {
    onMain {
      self.queue = items
      self.currentIndex = 0
      self.loadCurrent()
    }
  }

  func play(_ hadith: CarHadith) {
    setQueue(hadith.queue)
  }

  func resume() {
    onMain {
      self.activateSession()
      self.player.play()
    }
  }

  func pause() {
    onMain { self.player.pause() }
  }

  func seek(to seconds: Double) {
    onMain { self.player.seek(to: CMTime(seconds: seconds, preferredTimescale: 600)) }
  }

  func next() {
    onMain { self.move(by: 1) }
  }

  func previous() {
    onMain { self.move(by: -1) }
  }

  func state(ended: Bool = false) -> [String: Any] {
    let duration = player.currentItem?.duration.seconds ?? 0
    return [
      "available": true,
      "playing": player.timeControlStatus == .playing,
      "positionMs": player.currentTime().seconds * 1000,
      "durationMs": duration.isFinite ? duration * 1000 : 0,
      "index": currentIndex,
      "count": queue.count,
      "ended": ended,
      // Lets the app notice when CarPlay switched to another hadith.
      "mediaId": queue.indices.contains(currentIndex) ? queue[currentIndex].id : "",
    ]
  }

  // MARK: Library

  /// Re-reads the index the app writes, so CarPlay lists without React running.
  func reloadLibrary() {
    guard
      let documents = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first,
      let data = try? Data(contentsOf: documents.appendingPathComponent("car-index.json")),
      let root = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
      let entries = root["hadiths"] as? [[String: Any]]
    else {
      library = []
      thumbnail = nil
      NotificationCenter.default.post(name: Self.libraryDidChange, object: nil)
      return
    }

    library = entries.compactMap { entry in
      guard
        let id = entry["id"] as? String,
        let title = entry["title"] as? String,
        let segments = entry["segments"] as? [[String: Any]]
      else { return nil }
      return CarHadith(
        id: id,
        title: title,
        artist: entry["artist"] as? String ?? "",
        artworkUri: entry["artworkUri"] as? String,
        segments: segments.compactMap { segment in
          guard let uri = segment["uri"] as? String else { return nil }
          return (uri: uri, title: segment["title"] as? String ?? "")
        })
    }
    thumbnail = Self.image(at: entries.first?["thumbnailUri"] as? String)
    NotificationCenter.default.post(name: Self.libraryDidChange, object: nil)
  }

  // MARK: Private

  private func onMain(_ work: @escaping () -> Void) {
    if Thread.isMainThread { work() } else { DispatchQueue.main.async(execute: work) }
  }

  private func activateSession() {
    let session = AVAudioSession.sharedInstance()
    try? session.setCategory(.playback, mode: .spokenAudio)
    try? session.setActive(true)
  }

  private func move(by offset: Int) {
    let next = currentIndex + offset
    guard queue.indices.contains(next) else { return }
    currentIndex = next
    loadCurrent()
  }

  private func loadCurrent() {
    guard queue.indices.contains(currentIndex), let url = URL(string: queue[currentIndex].uri) else { return }
    activateSession()
    let item = AVPlayerItem(url: url)
    player.replaceCurrentItem(with: item)
    publishMetadata(queue[currentIndex])
    player.play()

    if let endObserver { NotificationCenter.default.removeObserver(endObserver) }
    endObserver = NotificationCenter.default.addObserver(
      forName: .AVPlayerItemDidPlayToEndTime, object: item, queue: .main
    ) { [weak self] _ in
      guard let self else { return }
      if self.currentIndex + 1 < self.queue.count {
        self.currentIndex += 1
        self.loadCurrent()
      } else {
        self.publishState(ended: true)
      }
    }
  }

  private func publishState(ended: Bool) {
    onStateChange?(state(ended: ended))
  }

  private func publishMetadata(_ item: CarQueueItem) {
    var info: [String: Any] = [
      MPMediaItemPropertyTitle: item.title,
      MPMediaItemPropertyArtist: item.artist,
    ]
    if let image = Self.image(at: item.artworkUri) {
      info[MPMediaItemPropertyArtwork] = MPMediaItemArtwork(boundsSize: image.size) { _ in image }
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

  private func setupRemoteCommands() {
    let center = MPRemoteCommandCenter.shared()
    center.playCommand.addTarget { [weak self] _ in self?.resume(); return .success }
    center.pauseCommand.addTarget { [weak self] _ in self?.pause(); return .success }
    center.togglePlayPauseCommand.addTarget { [weak self] _ in
      guard let self else { return .commandFailed }
      self.player.timeControlStatus == .playing ? self.pause() : self.resume()
      return .success
    }
    center.nextTrackCommand.addTarget { [weak self] _ in self?.next(); return .success }
    center.previousTrackCommand.addTarget { [weak self] _ in self?.previous(); return .success }
    center.changePlaybackPositionCommand.addTarget { [weak self] event in
      guard let event = event as? MPChangePlaybackPositionCommandEvent else { return .commandFailed }
      self?.seek(to: event.positionTime)
      return .success
    }
  }

  private static func image(at uri: String?) -> UIImage? {
    guard let uri, let url = URL(string: uri), let data = try? Data(contentsOf: url) else { return nil }
    return UIImage(data: data)
  }
}
