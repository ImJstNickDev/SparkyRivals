package com.sparkyrivals.wearbridge

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.sparkyrivals.companion.ChallengeProtocol

/** Promise acknowledges durable local storage, NOT delivery to a watch. */
class WearConnectivityModule(context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
    override fun getName() = "WearConnectivity"
    @ReactMethod
    fun publishSnapshot(json: String, promise: Promise) {
        try {
            require(json.toByteArray(Charsets.UTF_8).size < 32 * 1024)
            val snapshot = ChallengeProtocol.snapshot(json)
            WearPublicationStore.save(reactApplicationContext, snapshot)
            WearPublishWorker.schedule(reactApplicationContext)
            promise.resolve(null)
        } catch (error: Exception) {
            promise.reject("E_WEAR_PUBLISH", "Unable to persist companion state", error)
        }
    }
}
