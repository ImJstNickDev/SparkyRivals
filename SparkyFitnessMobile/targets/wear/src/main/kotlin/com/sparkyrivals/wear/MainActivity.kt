package com.sparkyrivals.wear

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import kotlinx.coroutines.delay

class MainActivity : ComponentActivity() {
    private val store by lazy { ChallengeStore.get(this) }
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            val state by store.state.collectAsStateWithLifecycle()
            // Display-age clock only; never advances server lifecycle or scores.
            val now by produceState(System.currentTimeMillis()) {
                while (true) { delay(60_000); value = System.currentTimeMillis() }
            }
            ChallengeApp(state, now)
        }
    }
    override fun onResume() { super.onResume(); store.refresh() }
}
