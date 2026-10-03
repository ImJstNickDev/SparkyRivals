package com.sparkyrivals.wearbridge

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.Worker
import androidx.work.WorkerParameters
import androidx.work.WorkManager
import com.google.android.gms.tasks.Tasks
import com.google.android.gms.wearable.PutDataRequest
import com.google.android.gms.wearable.Wearable
import com.sparkyrivals.companion.ChallengeProtocol
import java.util.concurrent.TimeUnit

/** One serial durable chain, no network constraint (Bluetooth is sufficient).
 * Every worker reads the latest journal. A slow older put can never finish after
 * a newer worker's put. No timeouts/cancellation that abandon an in-flight put. */
class WearPublishWorker(context: Context, params: WorkerParameters) : Worker(context, params) {
    override fun doWork(): Result = try {
        val latest = WearPublicationStore.read(applicationContext)
        if (latest != null) {
            val data = Wearable.getDataClient(applicationContext)
            val bytes = latest.encode().toByteArray(Charsets.UTF_8)
            val request = PutDataRequest.create(ChallengeProtocol.PATH).setData(bytes)
            if (latest.snapshot.state == "unavailable") request.setUrgent()
            Tasks.await(data.putDataItem(request))
        }
        Result.success()
    } catch (_: Exception) { Result.retry() }

    companion object {
        fun schedule(context: Context) {
            WorkManager.getInstance(context).enqueueUniqueWork(
                "wear-challenges-publish-v1", ExistingWorkPolicy.APPEND_OR_REPLACE,
                OneTimeWorkRequestBuilder<WearPublishWorker>().setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS).build()
            )
        }
    }
}
