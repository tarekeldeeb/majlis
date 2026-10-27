package expo.modules.majliscar

import android.content.Intent
import android.net.Uri
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.Player
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONArray

class MajlisCarModule : Module() {
  private var playerListener: Player.Listener? = null

  private fun stateOf(player: Player): Map<String, Any> = mapOf(
    "available" to true,
    "playing" to player.isPlaying,
    "positionMs" to player.currentPosition,
    "durationMs" to maxOf(player.duration, 0L),
    "index" to player.currentMediaItemIndex,
    "count" to player.mediaItemCount,
  )

  private fun emitState() {
    val player = MajlisCarService.current?.player() ?: return
    sendEvent("playbackState", stateOf(player))
  }

  override fun definition() = ModuleDefinition {
    Name("MajlisCar")
    Events("playbackState")

    Function("start") {
      val context = appContext.reactContext ?: return@Function false
      context.startService(Intent(context, MajlisCarService::class.java))

      if (playerListener == null) {
        val player = MajlisCarService.current?.player()
        if (player != null) {
          val listener = object : Player.Listener {
            override fun onIsPlayingChanged(isPlaying: Boolean) = emitState()
            override fun onPlaybackStateChanged(playbackState: Int) = emitState()
            override fun onMediaItemTransition(mediaItem: MediaItem?, reason: Int) = emitState()
          }
          player.addListener(listener)
          playerListener = listener
        }
      }
      true
    }

    Function("setQueue") { queueJson: String ->
      val player = MajlisCarService.current?.player() ?: return@Function false
      val entries = JSONArray(queueJson)
      val items = (0 until entries.length()).map { index ->
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
      player.setMediaItems(items)
      player.prepare()
      true
    }

    Function("play") { MajlisCarService.current?.player()?.play() }
    Function("pause") { MajlisCarService.current?.player()?.pause() }

    Function("seekTo") { seconds: Double ->
      MajlisCarService.current?.player()?.seekTo((seconds * 1000).toLong())
    }

    Function("next") { MajlisCarService.current?.player()?.seekToNextMediaItem() }
    Function("previous") { MajlisCarService.current?.player()?.seekToPreviousMediaItem() }

    Function("getState") {
      val player = MajlisCarService.current?.player()
        ?: return@Function mapOf("available" to false)
      stateOf(player)
    }
  }
}
