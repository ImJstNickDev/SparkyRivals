package com.sparkyrivals.wear

import android.content.Context
import android.util.AtomicFile
import com.google.android.gms.tasks.Tasks
import com.google.android.gms.wearable.CapabilityClient
import com.google.android.gms.wearable.Wearable
import com.sparkyrivals.companion.ChallengeProtocol
import com.sparkyrivals.companion.ChallengeReceipt
import com.sparkyrivals.companion.ChallengeSnapshot
import java.io.File
import java.util.concurrent.Executors
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow

data class CompanionState(val receipt: ChallengeReceipt, val phoneReachable: Boolean? = null)

/** Tiny atomic no-backup receipt, including tombstone and high-water sequence.
 * Both foreground reads and listener events run on this serial executor. */
class ChallengeStore private constructor(private val context: Context) {
    private val file = AtomicFile(File(context.noBackupFilesDir, "challenge-receipt-v1.json"))
    private val executor = Executors.newSingleThreadExecutor()
    private val mutable = MutableStateFlow(CompanionState(load()))
    val state = mutable.asStateFlow()
    private fun load(): ChallengeReceipt = try {
        if (file.baseFile.exists()) ChallengeReceipt.decode(file.openRead().bufferedReader().use { it.readText() }) else ChallengeReceipt()
    } catch (_: Exception) { ChallengeReceipt(resetRequired = true) }

    private fun persist(receipt: ChallengeReceipt) {
        val changed = mutable.value.receipt != receipt
        val privacyChange = mutable.value.receipt.snapshot.accountKey != receipt.snapshot.accountKey || receipt.snapshot.state != "ready"
        // Publish a privacy clear immediately even if storage is unavailable.
        mutable.value = mutable.value.copy(receipt = receipt)
        if (changed) ChallengeSurfaceUpdates.request(context, privacyChange)
        val output = file.startWrite()
        try { output.write(receipt.encode().toByteArray(Charsets.UTF_8)); file.finishWrite(output) }
        catch (error: Exception) { file.failWrite(output); throw error }
    }
    fun receive(node: String, bytes: ByteArray?) = executor.execute {
        try {
            val next = if (bytes == null) mutable.value.receipt.copy(snapshot = ChallengeSnapshot())
            else mutable.value.receipt.receive(node, ChallengeProtocol.decode(bytes.toString(Charsets.UTF_8)))
            persist(next)
        } catch (_: Exception) {
            val cleared = mutable.value.receipt.invalidate()
            runCatching { persist(cleared) }
        }
    }
    fun refresh() = executor.execute {
        // A transient unavailable phone must not erase verified offline data.
        runCatching {
            val items = Tasks.await(Wearable.getDataClient(context).dataItems)
            try {
                for (item in items) if (item.uri.path == ChallengeProtocol.PATH) {
                    val bytes = item.data
                    val next = if (bytes == null) mutable.value.receipt.copy(snapshot = ChallengeSnapshot())
                    else runCatching { mutable.value.receipt.receive(item.uri.host.orEmpty(), ChallengeProtocol.decode(bytes.toString(Charsets.UTF_8))) }
                        .getOrElse { mutable.value.receipt.invalidate() }
                    persist(next)
                }
            } finally { items.release() }
        }
        val reachable = runCatching {
            Tasks.await(Wearable.getCapabilityClient(context).getCapability(ChallengeProtocol.PHONE_CAPABILITY, CapabilityClient.FILTER_REACHABLE)).nodes.isNotEmpty()
        }.getOrNull()
        mutable.value = mutable.value.copy(phoneReachable = reachable)
    }
    companion object {
        @Volatile private var instance: ChallengeStore? = null
        fun get(context: Context): ChallengeStore = instance ?: synchronized(this) {
            instance ?: ChallengeStore(context.applicationContext).also { instance = it }
        }
    }
}
