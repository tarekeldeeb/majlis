package expo.modules.majliscar

import android.content.ComponentName
import android.net.Uri
import android.os.Handler
import android.os.Looper
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.Player
import androidx.media3.session.MediaController
import androidx.media3.session.SessionToken
import com.google.common.util.concurrent.ListenableFuture
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONArray

class MajlisCarModule : Module() {
  private val mainHandler = Handler(Looper.getMainLooper())
  private var playerListener: Player.Listener? = null
  private var pendingQueue: String? = null
  private var controller: ListenableFuture<MediaController>? = null

  private fun player(): Player? = MajlisCarService.current?.player()

  // Media3 only publishes a session once a controller connects: that is what posts
  // the media notification and promotes playback to a foreground service. Binding
  // also creates the service, so it is never started directly.
  private fun ensureService() {
    if (controller != null) return
    val context = appContext.reactContext ?: return
    val token = SessionToken(context, ComponentName(context, MajlisCarService::class.java))
    controller = MediaController.Builder(context, token)
      .setApplicationLooper(Looper.getMainLooper())
      .buildAsync()
  }

  private fun stateOf(player: Player): Map<String, Any> = mapOf(
    "available" to true,
    "playing" to player.isPlaying,
    "positionMs" to player.currentPosition,
    "durationMs" to maxOf(player.duration, 0L),
    "index" to player.currentMediaItemIndex,
    "count" to player.mediaItemCount,
    "ended" to (player.playbackState == Player.STATE_ENDED),
    // Lets the app notice when Android Auto switched to another hadith.
    "mediaId" to (player.currentMediaItem?.mediaId ?: ""),
    // Lets the app mark the hadith done that the player finished and went on from.
    "continuedFrom" to (MajlisCarService.current?.continuedFrom ?: ""),
  )

  private fun emitState() {
    val player = player() ?: return
    sendEvent("playbackState", stateOf(player))
  }

  private fun attachListener(player: Player) {
    if (playerListener != null) return
    val listener = object : Player.Listener {
      override fun onIsPlayingChanged(isPlaying: Boolean) = emitState()
      override fun onPlaybackStateChanged(playbackState: Int) = emitState()
      override fun onMediaItemTransition(mediaItem: MediaItem?, reason: Int) = emitState()
    }
    player.addListener(listener)
    playerListener = listener
  }

  private fun itemsFrom(queueJson: String): List<MediaItem> {
    val entries = JSONArray(queueJson)
    return (0 until entries.length()).map { index ->
      val entry = entries.getJSONObject(index)
      val metadata = MediaMetadata.Builder()
        .setTitle(entry.optString("title"))
        .setArtist(entry.optString("artist"))
        .apply {
          if (entry.has("artworkUri")) setArtworkUri(Uri.parse(entry.getString("artworkUri")))
        }
        .build()
      MediaItem.Builder()
        .setMediaId(entry.optString("id"))
        .setUri(entry.getString("uri"))
        .setMediaMetadata(metadata)
        .build()
    }
  }

  // The service is created asynchronously, so the queue waits for its player.
  private fun applyQueue(attempt: Int = 0) {
    val queueJson = pendingQueue ?: return
    val player = player()
    if (player == null) {
      if (attempt < 40) mainHandler.postDelayed({ applyQueue(attempt + 1) }, 50)
      return
    }
    pendingQueue = null
    // The app moves on to the next hadith itself.
    MajlisCarService.current?.queueStarted(byCar = false)
    player.setMediaItems(itemsFrom(queueJson))
    player.prepare()
    player.play()
    attachListener(player)
  }

  override fun definition() = ModuleDefinition {
    Name("MajlisCar")
    Events("playbackState")

    OnDestroy {
      controller?.let(MediaController::releaseFuture)
      controller = null
    }

    Function("start") {
      ensureService()
      true
    }

    // ExoPlayer may only be touched on the main thread.
    AsyncFunction("setQueue") { queueJson: String ->
      pendingQueue = queueJson
      ensureService()
      applyQueue()
      true
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("play") {
      ensureService()
      val current = player()
      if (current != null) current.play()
      else mainHandler.postDelayed({ player()?.play() }, 200)
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("pause") { player()?.pause() }.runOnQueue(Queues.MAIN)

    AsyncFunction("seekTo") { seconds: Double ->
      player()?.seekTo((seconds * 1000).toLong())
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("next") { player()?.seekToNextMediaItem() }.runOnQueue(Queues.MAIN)
    AsyncFunction("previous") { player()?.seekToPreviousMediaItem() }.runOnQueue(Queues.MAIN)

    AsyncFunction("reloadLibrary") {
      MajlisCarService.current?.notifyLibraryChanged()
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("getState") {
      val current = player() ?: return@AsyncFunction mapOf("available" to false)
      stateOf(current)
    }.runOnQueue(Queues.MAIN)
  }
}
