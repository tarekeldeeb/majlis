package expo.modules.majliscar

import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.session.LibraryResult
import androidx.media3.session.MediaLibraryService
import androidx.media3.session.MediaSession
import com.google.common.collect.ImmutableList
import com.google.common.util.concurrent.Futures
import com.google.common.util.concurrent.ListenableFuture

/**
 * Owns the car playback session so it survives the React UI. Android Auto
 * browses the persisted library and plays through this service.
 */
class MajlisCarService : MediaLibraryService() {
  private var session: MediaLibrarySession? = null

  /** Set for a hadith chosen in the car, which plays on into the hadiths after it. */
  private var continuous = false

  /** The hadith the player finished and went on from by itself, "<bookId>:<hadithNumber>". */
  var continuedFrom: String? = null
    private set

  override fun onCreate() {
    super.onCreate()
    val player = ExoPlayer.Builder(this).build()
    player.addListener(object : Player.Listener {
      override fun onMediaItemTransition(mediaItem: MediaItem?, reason: Int) = followQueue(player)
    })
    session = MediaLibrarySession.Builder(this, player, LibraryCallback(this)).build()
    current = this
  }

  override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaLibrarySession? = session

  override fun onDestroy() {
    session?.player?.release()
    session?.release()
    session = null
    current = null
    super.onDestroy()
  }

  fun player(): Player? = session?.player

  fun notifyLibraryChanged() {
    session?.notifyChildrenChanged(ROOT_ID, CarLibrary.read(this).size, null)
  }

  /** Every new queue starts afresh; only a hadith the car chose plays on into the next. */
  fun queueStarted(byCar: Boolean) {
    continuous = byCar
    continuedFrom = null
  }

  // A hadith chosen in the car runs straight into the next one, queued while its last
  // segment plays so the audio never stops; once it is left, the finished one is dropped.
  private fun followQueue(player: Player) {
    val current = player.currentMediaItem ?: return
    val previous = hadithOf(player.getMediaItemAt(0).mediaId)
    if (hadithOf(current.mediaId) != previous) {
      continuedFrom = previous
      player.removeMediaItems(0, player.currentMediaItemIndex)
    }
    if (continuous && player.currentMediaItemIndex == player.mediaItemCount - 1) {
      CarLibrary.after(this, hadithOf(current.mediaId))?.let { player.addMediaItems(it.mediaItems()) }
    }
  }

  // Queue items are "<bookId>:<hadithNumber>:<segment>".
  private fun hadithOf(mediaId: String) = mediaId.substringBeforeLast(':')

  companion object {
    const val ROOT_ID = "root"

    @Volatile
    var current: MajlisCarService? = null
      private set
  }
}

private class LibraryCallback(private val service: MajlisCarService) :
  MediaLibraryService.MediaLibrarySession.Callback {

  private fun rootItem(): MediaItem = MediaItem.Builder()
    .setMediaId(MajlisCarService.ROOT_ID)
    .setMediaMetadata(
      androidx.media3.common.MediaMetadata.Builder()
        .setTitle("مجلس")
        .setIsBrowsable(true)
        .setIsPlayable(false)
        .build()
    )
    .build()

  override fun onGetLibraryRoot(
    session: MediaLibraryService.MediaLibrarySession,
    browser: MediaSession.ControllerInfo,
    params: MediaLibraryService.LibraryParams?,
  ): ListenableFuture<LibraryResult<MediaItem>> =
    Futures.immediateFuture(LibraryResult.ofItem(rootItem(), params))

  override fun onGetChildren(
    session: MediaLibraryService.MediaLibrarySession,
    browser: MediaSession.ControllerInfo,
    parentId: String,
    page: Int,
    pageSize: Int,
    params: MediaLibraryService.LibraryParams?,
  ): ListenableFuture<LibraryResult<ImmutableList<MediaItem>>> {
    val items = CarLibrary.read(service).map { it.toMediaItem(service) }
    return Futures.immediateFuture(LibraryResult.ofItemList(ImmutableList.copyOf(items), params))
  }

  override fun onGetItem(
    session: MediaLibraryService.MediaLibrarySession,
    browser: MediaSession.ControllerInfo,
    mediaId: String,
  ): ListenableFuture<LibraryResult<MediaItem>> {
    val hadith = CarLibrary.find(service, mediaId)
      ?: return Futures.immediateFuture(LibraryResult.ofError(LibraryResult.RESULT_ERROR_BAD_VALUE))
    return Futures.immediateFuture(LibraryResult.ofItem(hadith.toMediaItem(service), null))
  }

  // A browsed hadith becomes its whole segment queue, and plays on into the next ones.
  override fun onAddMediaItems(
    session: MediaSession,
    controller: MediaSession.ControllerInfo,
    mediaItems: MutableList<MediaItem>,
  ): ListenableFuture<MutableList<MediaItem>> {
    val resolved = mutableListOf<MediaItem>()
    var browsed = false
    for (item in mediaItems) {
      val hadith = CarLibrary.find(service, item.mediaId)
      if (hadith != null) {
        resolved += hadith.mediaItems()
        browsed = true
      } else {
        resolved += item
      }
    }
    if (browsed) service.queueStarted(byCar = true)
    return Futures.immediateFuture(resolved)
  }
}
