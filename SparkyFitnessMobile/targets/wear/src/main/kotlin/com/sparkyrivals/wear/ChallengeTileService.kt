package com.sparkyrivals.wear

import androidx.wear.tiles.TileService
import androidx.wear.tiles.RequestBuilders
import androidx.wear.tiles.TileBuilders
import androidx.wear.protolayout.LayoutElementBuilders
import androidx.wear.protolayout.DimensionBuilders
import androidx.wear.protolayout.ModifiersBuilders
import androidx.wear.protolayout.ActionBuilders
import androidx.wear.protolayout.ColorBuilders
import androidx.wear.protolayout.ResourceBuilders
import androidx.wear.protolayout.TimelineBuilders
import com.google.common.util.concurrent.Futures
import com.google.common.util.concurrent.ListenableFuture

/** Round-screen glance, from the existing local receipt. No Data Layer request. */
class ChallengeTileService : TileService() {
    override fun onTileRequest(requestParams: RequestBuilders.TileRequest): ListenableFuture<TileBuilders.Tile> {
        val value=surfaceText(this)
        val activity=ActionBuilders.AndroidActivity.Builder().setPackageName(packageName).setClassName(MainActivity::class.java.name)
            .addKeyToExtraMapping(ChallengeSurfaceLinks.ID,ActionBuilders.AndroidStringExtra.Builder().setValue(value.model.item?.id.orEmpty()).build())
            .addKeyToExtraMapping(ChallengeSurfaceLinks.ACCOUNT,ActionBuilders.AndroidStringExtra.Builder().setValue(value.model.accountKey).build()).build()
        val click=ModifiersBuilders.Clickable.Builder().setId("challenge").setOnClick(ActionBuilders.LaunchAction.Builder().setAndroidActivity(activity).build()).build()
        fun text(content: String,size: Float,color: Int,lines: Int = 1) = LayoutElementBuilders.Text.Builder().setText(content).setMaxLines(lines)
            .setFontStyle(LayoutElementBuilders.FontStyle.Builder().setSize(DimensionBuilders.sp(size)).setColor(ColorBuilders.argb(color)).build()).build()
        val column=LayoutElementBuilders.Column.Builder().setHorizontalAlignment(LayoutElementBuilders.HORIZONTAL_ALIGN_CENTER)
            .addContent(text(value.title,14f,0xffffffff.toInt(),2))
            .addContent(text(value.score,22f,0xff9ee7cf.toInt(),2))
            .addContent(text(value.rank,14f,0xffffffff.toInt()))
            .addContent(text(value.status,12f,0xffcccccc.toInt(),2)).build()
        val root=LayoutElementBuilders.Box.Builder().setWidth(DimensionBuilders.expand()).setHeight(DimensionBuilders.expand())
            .setModifiers(ModifiersBuilders.Modifiers.Builder().setClickable(click)
                .setSemantics(ModifiersBuilders.Semantics.Builder().setContentDescription(value.description).build())
                .setPadding(ModifiersBuilders.Padding.Builder().setAll(DimensionBuilders.dp(22f)).build()).build())
            .addContent(column).build()
        val entry=TimelineBuilders.TimelineEntry.Builder().setLayout(LayoutElementBuilders.Layout.Builder().setRoot(root).build()).build()
        return Futures.immediateFuture(TileBuilders.Tile.Builder().setResourcesVersion("1").setFreshnessIntervalMillis(900000)
            .setTileTimeline(TimelineBuilders.Timeline.Builder().addTimelineEntry(entry).build()).build())
    }
    override fun onTileResourcesRequest(requestParams: RequestBuilders.ResourcesRequest): ListenableFuture<ResourceBuilders.Resources> =
        Futures.immediateFuture(ResourceBuilders.Resources.Builder().setVersion("1").build())
}
