package expo.modules.majliscar

import android.content.Context
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import org.json.JSONObject
import java.io.File

data class CarSegment(val uri: String, val title: String)

data class CarHadith(
  val id: String,
  val title: String,
  val artist: String,
  val segments: List<CarSegment>,
) {
  fun toMediaItem(): MediaItem = MediaItem.Builder()
    .setMediaId(id)
    .setMediaMetadata(
      MediaMetadata.Builder()
        .setTitle(title)
        .setArtist(artist)
        .setIsBrowsable(false)
        .setIsPlayable(true)
        .build()
    )
    .build()

  fun mediaItems(): List<MediaItem> = segments.mapIndexed { index, segment ->
    MediaItem.Builder()
      .setMediaId("$id#$index")
      .setUri(segment.uri)
      .setMediaMetadata(
        MediaMetadata.Builder()
          .setTitle("$title — ${segment.title}")
          .setArtist(artist)
          .build()
      )
      .build()
  }
}

/** Reads the index the app persists, so browsing works without React running. */
object CarLibrary {
  fun read(context: Context): List<CarHadith> {
    val file = File(context.filesDir, "car-index.json")
    if (!file.exists()) return emptyList()

    return runCatching {
      val entries = JSONObject(file.readText()).optJSONArray("hadiths") ?: return emptyList()
      (0 until entries.length()).mapNotNull { index ->
        val entry = entries.optJSONObject(index) ?: return@mapNotNull null
        val segments = entry.optJSONArray("segments") ?: return@mapNotNull null
        CarHadith(
          id = entry.optString("id"),
          title = entry.optString("title"),
          artist = entry.optString("artist"),
          segments = (0 until segments.length()).map { i ->
            val segment = segments.getJSONObject(i)
            CarSegment(segment.getString("uri"), segment.optString("title"))
          },
        )
      }
    }.getOrDefault(emptyList())
  }

  fun find(context: Context, mediaId: String): CarHadith? =
    read(context).firstOrNull { it.id == mediaId }
}
