package expo.modules.majliscar

import android.content.ContentProvider
import android.content.ContentResolver
import android.content.ContentValues
import android.content.Context
import android.database.Cursor
import android.net.Uri
import android.os.ParcelFileDescriptor
import java.io.FileNotFoundException

/**
 * Serves list artwork to Android Auto, which runs in another process and
 * cannot read the app's private cache. Read-only, and limited to the images
 * the car index references.
 */
class ArtworkProvider : ContentProvider() {
  override fun onCreate() = true

  override fun openFile(uri: Uri, mode: String): ParcelFileDescriptor {
    val context = context ?: throw FileNotFoundException(uri.toString())
    val file = uri.lastPathSegment?.let { CarLibrary.artworkFiles(context)[it] }
    if (mode != "r" || file == null || !file.isFile) throw FileNotFoundException(uri.toString())
    return ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY)
  }

  override fun getType(uri: Uri): String =
    if (uri.lastPathSegment?.endsWith(".png") == true) "image/png" else "image/jpeg"

  override fun query(
    uri: Uri,
    projection: Array<out String>?,
    selection: String?,
    selectionArgs: Array<out String>?,
    sortOrder: String?,
  ): Cursor? = null

  override fun insert(uri: Uri, values: ContentValues?): Uri? = null

  override fun update(
    uri: Uri,
    values: ContentValues?,
    selection: String?,
    selectionArgs: Array<out String>?,
  ): Int = 0

  override fun delete(uri: Uri, selection: String?, selectionArgs: Array<out String>?): Int = 0

  companion object {
    fun authority(context: Context) = "${context.packageName}.majliscar.artwork"

    fun contentUriFor(context: Context, fileUri: String): Uri? {
      val name = Uri.parse(fileUri).lastPathSegment ?: return null
      return Uri.Builder()
        .scheme(ContentResolver.SCHEME_CONTENT)
        .authority(authority(context))
        .appendPath(name)
        .build()
    }
  }
}
