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

  private let player = AVQueuePlayer()
  /// The playing hadith's segments, then the next hadith's once they are queued behind it.
  private var queue: [CarQueueItem] = []
  /// The player items of `queue`, index for index, so the playing item maps back to its segment.
  private var items: [AVPlayerItem] = []
  private var currentIndex = 0
  /// Set for a hadith chosen in the car, which plays on into the hadiths after it.
  private var continuous = false
  /// The hadith the player finished and went on from by itself, "<bookId>:<hadithNumber>".
  private var continuedFrom: String?
  private var timeObserver: Any?
  private var endObserver: NSObjectProtocol?
  private var itemObserver: NSKeyValueObservation?

  private init() {
    setupRemoteCommands()
    let interval = CMTime(seconds: 0.5, preferredTimescale: 600)
    // Also fires when playback starts or stops, so a pause reaches Now Playing.
    timeObserver = player.addPeriodicTimeObserver(forInterval: interval, queue: .main) { [weak self] _ in
      self?.publishState(ended: false)
      self?.updateNowPlayingProgress()
    }
    // The queue player moves to the next segment on its own; follow it.
    itemObserver = player.observe(\.currentItem) { [weak self] _, _ in
      DispatchQueue.main.async { self?.currentItemDidChange() }
    }
    endObserver = NotificationCenter.default.addObserver(
      forName: AVPlayerItem.didPlayToEndTimeNotification, object: nil, queue: .main
    ) { [weak self] note in
      guard let self, let item = note.object as? AVPlayerItem, item === self.items.last else { return }
      self.publishState(ended: true)
    }
    reloadLibrary()
  }

  // MARK: Transport

  /// The app's queue; the app moves on to the next hadith itself.
  func setQueue(_ items: [CarQueueItem]) {
    start(items, continuous: false)
  }

  /// A hadith chosen in the car, which plays on into the next ones even without the app.
  func play(_ hadith: CarHadith) {
    start(hadith.queue, continuous: true)
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
      // Lets the app mark the hadith done that the player finished and went on from.
      "continuedFrom": continuedFrom ?? "",
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

  private func start(_ items: [CarQueueItem], continuous: Bool) {
    onMain {
      self.continuous = continuous
      self.continuedFrom = nil
      self.queue = items.filter { URL(string: $0.uri) != nil }
      self.load(from: 0)
    }
  }

  private func move(by offset: Int) {
    let next = currentIndex + offset
    guard queue.indices.contains(next) else { return }
    currentIndex = next
    if offset == 1, player.items().count > 1 {
      // Already queued, so skipping does not stop the audio output either.
      player.advanceToNextItem()
      player.play()
    } else {
      load(from: next)
    }
  }

  /// Queues every segment from `index` on, so AVQueuePlayer goes from one clip to
  /// the next without stopping the audio output. Swapping items in a plain AVPlayer
  /// left a short gap at each boundary; over CarPlay that gap can restart the audio
  /// stream to the car, and the head unit drops the start of the next clip: all but
  /// the last letter of a one-word title.
  private func load(from index: Int) {
    guard queue.indices.contains(index) else { return }
    activateSession()
    currentIndex = index
    items = queue.compactMap { URL(string: $0.uri).map(AVPlayerItem.init(url:)) }
    player.removeAllItems()
    player.actionAtItemEnd = .advance
    for item in items[index...] {
      player.insert(item, after: nil)
    }
    player.play()
  }

  private func currentItemDidChange() {
    guard let item = player.currentItem, var index = items.firstIndex(where: { $0 === item }) else { return }
    // Playback ran on into the next hadith, so the one before it is done: drop it.
    let previous = Self.hadithID(of: queue[0].id)
    if Self.hadithID(of: queue[index].id) != previous {
      continuedFrom = previous
      queue.removeFirst(index)
      items.removeFirst(index)
      index = 0
    }
    currentIndex = index
    if index == queue.count - 1 { queueNextHadith() }
    // Hold the last clip at its end, as the single AVPlayer did, so the final state
    // still reports the hadith's last segment instead of an empty player.
    player.actionAtItemEnd = index == items.count - 1 ? .pause : .advance
    publishMetadata(queue[index])
    updateNowPlayingProgress()
    publishState(ended: false)
  }

  /// Queues the next hadith behind the last segment of one chosen in the car, so the
  /// player runs straight into it. Waiting for the end to load it would stop the
  /// audio output, and the car would drop the start of the hadith number (see `load`).
  private func queueNextHadith() {
    guard continuous, let last = queue.last, let next = hadith(after: Self.hadithID(of: last.id)) else { return }
    let added = next.queue.filter { URL(string: $0.uri) != nil }
    let addedItems = added.compactMap { URL(string: $0.uri).map(AVPlayerItem.init(url:)) }
    queue += added
    items += addedItems
    for item in addedItems {
      player.insert(item, after: nil)
    }
  }

  /// The hadith after `id` in the car index, as long as it is from the same book.
  private func hadith(after id: String) -> CarHadith? {
    guard let index = library.firstIndex(where: { $0.id == id }), index + 1 < library.count else { return nil }
    let next = library[index + 1]
    let sameBook = next.id.prefix(while: { $0 != ":" }) == id.prefix(while: { $0 != ":" })
    return sameBook ? next : nil
  }

  /// "<bookId>:<hadithNumber>" of a queue item id "<bookId>:<hadithNumber>:<segment>".
  private static func hadithID(of itemID: String) -> String {
    guard let cut = itemID.lastIndex(of: ":") else { return itemID }
    return String(itemID[..<cut])
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
