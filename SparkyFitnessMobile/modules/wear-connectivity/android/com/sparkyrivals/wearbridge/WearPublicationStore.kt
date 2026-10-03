package com.sparkyrivals.wearbridge

import android.content.Context
import android.util.AtomicFile
import com.sparkyrivals.companion.ChallengeEnvelope
import com.sparkyrivals.companion.ChallengeProtocol
import com.sparkyrivals.companion.ChallengeSnapshot
import java.io.File
import java.util.UUID

/** No-backup journal: publisher id and sequence survive process death, not restore
 * to a different phone. The atomic record is also the latest pending delivery. */
object WearPublicationStore {
    private fun file(context: Context) = AtomicFile(File(context.noBackupFilesDir, "wear-challenges-v1.json"))
    @Synchronized fun read(context: Context): ChallengeEnvelope? {
        val file = file(context)
        if (!file.baseFile.exists()) return null
        // Corruption is not silently reset: that would lose ordering authority.
        return ChallengeProtocol.decode(file.openRead().bufferedReader().use { it.readText() })
    }
    @Synchronized fun save(context: Context, snapshot: ChallengeSnapshot) {
        val previous = read(context)
        if (previous?.snapshot == snapshot) return
        val next = ChallengeEnvelope(previous?.publisherId ?: UUID.randomUUID().toString(), Math.addExact(previous?.sequence ?: 0L, 1L), snapshot)
        val bytes = next.encode().toByteArray(Charsets.UTF_8)
        require(bytes.size <= ChallengeProtocol.MAX_BYTES)
        val file = file(context)
        val output = file.startWrite()
        try { output.write(bytes); file.finishWrite(output) }
        catch (error: Exception) { file.failWrite(output); throw error }
    }
}
