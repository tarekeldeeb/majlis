package expo.modules.majliscar

import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.session.MediaSession
import androidx.media3.session.MediaSessionService

/**
 * Owns the car playback session so it survives the React UI. Android Auto and
 * the system media controls bind to this service rather than to a screen.
 */
class MajlisCarService : MediaSessionService() {
  private var session: MediaSession? = null

  override fun onCreate() {
    super.onCreate()
    val player = ExoPlayer.Builder(this).build()
    session = MediaSession.Builder(this, player).build()
    current = this
  }

  override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaSession? = session

  override fun onDestroy() {
    session?.player?.release()
    session?.release()
    session = null
    current = null
    super.onDestroy()
  }

  fun player(): Player? = session?.player

  companion object {
    @Volatile
    var current: MajlisCarService? = null
      private set
  }
}
