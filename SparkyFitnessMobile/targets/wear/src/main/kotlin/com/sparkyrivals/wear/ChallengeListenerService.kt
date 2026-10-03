package com.sparkyrivals.wear

import com.google.android.gms.wearable.DataEvent
import com.google.android.gms.wearable.DataEventBuffer
import com.google.android.gms.wearable.WearableListenerService
import com.sparkyrivals.companion.ChallengeProtocol

class ChallengeListenerService : WearableListenerService() {
    override fun onDataChanged(events: DataEventBuffer) {
        for (event in events) {
            val item = event.dataItem
            if (item.uri.path != ChallengeProtocol.PATH) continue
            // Copy buffer-backed data before returning from this callback.
            ChallengeStore.get(this).receive(item.uri.host.orEmpty(), if (event.type == DataEvent.TYPE_DELETED) null else item.data?.clone())
        }
    }
}
