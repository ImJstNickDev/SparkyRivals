package com.sparkyrivals.wear

import android.os.Bundle
import android.content.Intent
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import kotlinx.coroutines.delay

class MainActivity : ComponentActivity() {
    private var surfaceLink by mutableStateOf<Pair<String?,String?>>(null to null)
    private val store by lazy { ChallengeStore.get(this) }
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        adoptLink(intent)
        setContent {
            val state by store.state.collectAsStateWithLifecycle()
            // Display-age clock only; never advances server lifecycle or scores.
            val now by produceState(System.currentTimeMillis()) {
                while (true) { delay(60_000); value = System.currentTimeMillis() }
            }
            ChallengeApp(state, now, surfaceLink)
        }
    }
    override fun onNewIntent(intent: Intent) { super.onNewIntent(intent); setIntent(intent); adoptLink(intent) }
    private fun adoptLink(intent: Intent) {
        surfaceLink = intent.getStringExtra(ChallengeSurfaceLinks.ACCOUNT) to intent.getStringExtra(ChallengeSurfaceLinks.ID)
    }
    override fun onResume() { super.onResume(); store.refresh() }
}
