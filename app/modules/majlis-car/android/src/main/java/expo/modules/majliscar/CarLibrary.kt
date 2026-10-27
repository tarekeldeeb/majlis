package expo.modules.majliscar

import android.content.Context
import android.net.Uri
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import org.json.JSONObject
import java.io.File

data class CarSegment(val uri: String, val title: String)

data class CarHadith(
  val id: String,
  val title: String,
  val artist: String,
  val artworkUri: String?,
  val thumbnailUri: String?,
  val segments: List<CarSegment>,
) {
  // List rows show the shared thumbnail, which Android Auto loads through the provider.
  fun toMediaItem(context: Context): MediaItem = MediaItem.Builder()
    .setMediaId(id)
    .setMediaMetadata(
      MediaMetadata.Builder()
        .setTitle(title)
        .setArtist(artist)
        .setArtworkUri(thumbnailUri?.let { ArtworkProvider.contentUriFor(context, it) })
        .setIsBrowsable(false)
        .setIsPlayable(true)
        .build()
    )
    .build()

  // The cover is loaded in-process by the session, which hands the bitmap to the car.
  fun mediaItems(): List<MediaItem> = segments.mapIndexed { index, segment ->
    MediaItem.Builder()
      .setMediaId("$id:$index")
      .setUri(segment.uri)
      .setMediaMetadata(
        MediaMetadata.Builder()
          .setTitle("$title — ${segment.title}")
          .setArtist(artist)
          .setArtworkUri(artworkUri?.let(Uri::parse))
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
          artworkUri = entry.optText("artworkUri"),
          thumbnailUri = entry.optText("thumbnailUri"),
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

  /** The only files the artwork provider will serve: images this index points at. */
  fun artworkFiles(context: Context): Map<String, File> =
    read(context)
      .flatMap { listOfNotNull(it.artworkUri, it.thumbnailUri) }
      .mapNotNull { uri -> Uri.parse(uri).path?.let(::File) }
      .associateBy { it.name }

  // optString turns a missing key into "" and a JSON null into "null".
  private fun JSONObject.optText(key: String): String? =
    if (isNull(key)) null else optString(key).ifEmpty { null }
}
