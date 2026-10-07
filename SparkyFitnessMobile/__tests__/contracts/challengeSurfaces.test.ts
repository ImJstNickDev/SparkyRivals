import fs from 'fs';
import path from 'path';
const read = (file: string) =>
  fs.readFileSync(path.resolve(__dirname, '../..', file), 'utf8');
it('keeps both existing phone widgets and registers the third in existing targets', () => {
  const bundle = read('targets/widget/index.swift');
  for (const call of ['widget()', 'macroWidget()', 'ChallengeWidget()'])
    expect(bundle).toContain(call);
  const plugin = read('plugins/withCalorieWidget.ts');
  for (const name of [
    'CalorieWidgetReceiver',
    'MacroWidgetReceiver',
    'ChallengeWidgetReceiver',
  ])
    expect(plugin).toContain(name);
  const widget = read('targets/widget/ChallengeWidget.swift');
  expect(widget).toContain('[.systemSmall, .systemMedium]');
  expect(widget).toContain('generatedAt / 1000');
  expect(widget).toContain('value.state == "ready"');
  expect(widget).toMatch(/if value.score.isEmpty\s*\{\s*Text\(value.metric\)/);
  expect(widget).toContain('family == .systemMedium');
  expect(widget).not.toMatch(/Text\(value\.(peer|gap)\)/);
  expect(widget).toContain(
    'Text(verbatim: localizedWidgetString("widget.challenge.name"))'
  );
  expect(widget).toContain(
    'Text(verbatim: localizedWidgetString("widget.challenge.description"))'
  );
});
it('Android third widget has its own snapshot and variant-aware destination', () => {
  const base =
    'targets/android-widget/kotlin/com/sparkyapps/sparkyfitness/widget/';
  expect(read(base + 'ChallengeWidgetReceiver.kt.tmpl')).toContain(
    'SparkyChallengeWidget'
  );
  const widget = read(base + 'ChallengeWidget.kt.tmpl');
  expect(widget).toContain('{{APP_URL_SCHEME}}://challenges');
  expect(widget).toContain('SizeMode.Responsive');
  expect(widget).toContain('900000');
  expect(widget).toContain('optString("accountKey").isNotEmpty()');
  expect(widget).toContain('WidgetLocale.LOCALE_RENDER_REVISION_STATE_KEY');
  const provider = read(
    'targets/android-widget/res/xml/sparky_challenge_widget_info.xml'
  );
  expect(provider).toContain('android:targetCellWidth="4"');
  expect(provider).toContain('android:targetCellHeight="2"');
  expect(provider).toContain('@layout/sparky_challenge_widget_initial_layout');
  const preview = read(
    'targets/android-widget/res/layout/sparky_challenge_widget_initial_layout.xml'
  );
  expect(preview).toContain('@string/sparky_challenge_widget_name');
  expect(preview).not.toMatch(/calorie|kcal|macro/);
  expect(read(base + 'CalorieWidgetModule.kt.tmpl')).toContain(
    'fun setChallengeSnapshot'
  );
});
it('Watch complication clears through adopted context and keeps old complication writers', () => {
  expect(read('targets/watch/Application/CheckInStore.swift')).toContain(
    'ComplicationPublisher.publish(challenges: incoming.challengeSnapshot)'
  );
  const writer = read(
    'targets/watch/Infrastructure/ComplicationPublisher.swift'
  );
  for (const key of [
    'energyGoalSnapshot',
    'waterGoalSnapshot',
    'challengeComplicationSnapshot',
  ])
    expect(writer).toContain(key);
  const view = read('targets/watch-widget/ChallengeComplication.swift');
  expect(view).toContain(
    '[.accessoryInline, .accessoryCircular, .accessoryRectangular]'
  );
  expect(view).toContain('!value.accountKey.isEmpty');
  expect(view).toContain('ComplicationLink.challenge.url');
  expect(view).toContain('value.rank.isEmpty ? value.status');
  expect(read('targets/watch/Domain/WatchDeepLink.swift')).toContain(
    'case challenge'
  );
  expect(read('targets/watch/Presentation/ContentView.swift')).toContain(
    'case .challenge:\n            return .challenge'
  );
});
it('Wear surfaces use the existing receipt and protected native services', () => {
  const manifest = read('targets/wear/src/main/AndroidManifest.xml');
  expect(manifest).toContain('permission.BIND_TILE_PROVIDER');
  expect(manifest).toContain('permission.BIND_COMPLICATION_PROVIDER');
  expect(manifest).toContain('SHORT_TEXT,LONG_TEXT');
  expect(
    read(
      'targets/wear/src/main/kotlin/com/sparkyrivals/wear/ChallengeSurfaces.kt'
    )
  ).toContain('ChallengeStore.get(context).state.value.receipt.snapshot');
  expect(
    read('targets/wear/src/main/kotlin/com/sparkyrivals/wear/ChallengeStore.kt')
  ).toContain('ChallengeSurfaceUpdates.request(context, privacyChange)');
  for (const file of [
    'ChallengeTileService.kt',
    'ChallengeComplicationService.kt',
  ])
    expect(
      read('targets/wear/src/main/kotlin/com/sparkyrivals/wear/' + file)
    ).not.toMatch(/Wearable|getDataClient|Http|Health|Sensor/);
});
it('preserves one composed Apple context and one Wear protocol path', () => {
  expect(
    read('src/hooks/useWatchCheckInBridge.ts').match(
      /WatchConnectivity\.updateContext\(/g
    )
  ).toHaveLength(1);
  expect(
    read(
      'targets/wear/protocol/com/sparkyrivals/companion/ChallengeProtocol.kt'
    )
  ).toContain('/sparkyrivals/challenges/v1');
  expect(read('src/hooks/useChallengeSurfaces.ts')).not.toMatch(
    /fetch\(|challengesApi|setInterval/
  );
});
