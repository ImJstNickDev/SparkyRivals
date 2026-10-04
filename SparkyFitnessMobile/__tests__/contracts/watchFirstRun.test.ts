import fs from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '../..');
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');
const watch = (file: string) => read(`targets/watch/${file}`);
const content = watch('Presentation/ContentView.swift');

// Source contracts complement the native model harness and physical swipe/save
// acceptance. Jest does not render SwiftUI or execute WatchConnectivity.
it('always mounts the existing page deck, even when weight is missing or stale', () => {
  const body = content.slice(content.indexOf('var body: some View'));
  const deck = body.slice(0, body.indexOf('.onAppear'));
  expect(deck).toContain('TabView(selection: Binding');
  expect(deck).toContain('ForEach(pages, id: \\.self)');
  expect(deck).toContain('.tabViewStyle(.page(indexDisplayMode: .automatic))');
  expect(deck).toContain('.id(pages)');
  expect(deck).not.toMatch(/if |FirstRunEntryView|needsFirstRunEntry/);
});

it('shows First check-in only inside Entry and retains real capture/send on Save', () => {
  const entry = content.slice(
    content.indexOf('case .entry:'),
    content.indexOf('case .trend:')
  );
  expect(entry).toContain('if !didFirstRun && store.needsFirstRunEntry');
  expect(entry).toContain('FirstRunEntryView { weight, bodyFat in');
  expect(entry).toContain(
    'let checkIn = store.capture(weightKg: weight, bodyFatPercentage: bodyFat)'
  );
  expect(entry).toContain(
    'store.markState(session.send(checkIn), for: checkIn)'
  );
  expect(entry).toContain('didFirstRun = true');
  expect(entry).toContain('self.page = shown(.trend)');
  expect(entry).toContain('CheckInEntryView {');
  expect(content.match(/store\.capture\(/g)).toHaveLength(1);
  expect(content.match(/session\.send\(/g)).toHaveLength(1);
});

it('uses first check-in as the initial selection without changing order or hiding', () => {
  expect(content).toContain(
    'store.context.visiblePages(workoutActive: workout.isActive)'
  );
  expect(content).toContain('WatchPage.initial(');
  expect(content).toContain(
    'needsFirstRunEntry: !didFirstRun && store.needsFirstRunEntry'
  );
  const pages = watch('Domain/WatchPage.swift');
  expect(pages).toContain(
    'if needsFirstRunEntry, pages.contains(.entry) { return .entry }'
  );
  expect(pages).toContain(
    'if workoutActive, pages.contains(.workout) { return .workout }'
  );
  expect(pages).toContain('return pages.first ?? .goals');
});

it('lets swipes and deep links select Challenges without completing a check-in', () => {
  expect(content).toContain(
    'Binding(get: { selectedPage }, set: { page = $0 })'
  );
  expect(content).toContain('shown(page) ?? initialPage');
  expect(content).toMatch(/case \.challenge:\s+ChallengeView\(\)/);
  const link = content.slice(
    content.indexOf('.onOpenURL'),
    content.indexOf('private func destination')
  );
  expect(link).toContain('page = requested');
  expect(link).not.toMatch(
    /capture\(|send\(|didFirstRun\s*=|needsFirstRunEntry/
  );
});

it('allows returning to an uncompleted Entry form and does not seed fabricated values', () => {
  const form = content.slice(content.indexOf('struct FirstRunEntryView'));
  expect(form).toContain('@State private var weightText = ""');
  expect(form).toContain('@State private var bodyFatText = ""');
  expect(form).toContain('Button("Save")');
  expect(form).toContain(
    'guard let weight = parse(weightText) else { return }'
  );
  expect(form).toContain('onSave(unit.toKg(weight), parse(bodyFatText))');
  expect(form).toContain('.disabled(parse(weightText) == nil)');
  expect(form).toContain('Enter your weight, or swipe to explore other pages.');
  expect(form).not.toMatch(/onAppear|onDisappear|markState|capture\(/);
});

it('keeps Challenges unsynced and empty states independent of weight entry', () => {
  const challenges = watch('Presentation/ChallengeView.swift');
  expect(challenges).toContain(
    'if let snapshot = store.context.challengeSnapshot'
  );
  expect(challenges).toContain('snapshot.items.isEmpty');
  expect(challenges).toContain('No challenges yet');
  expect(challenges).toContain('Challenges not synced yet');
  expect(challenges).not.toMatch(
    /needsFirstRunEntry|hasSeed|weightKg|capture\(/
  );
});

it('retains local persistence and queued delivery until the phone acknowledges Save', () => {
  const store = watch('Application/CheckInStore.swift');
  const capture = store.slice(
    store.indexOf('func capture('),
    store.indexOf('func markState(')
  );
  expect(capture).toContain('weightKg: weightKg');
  expect(capture).toContain('bodyFatPercentage: bodyFatPercentage');
  expect(capture).toContain('pending.append(checkIn)');
  expect(capture).toContain('lastCapturedState = .queued');
  expect(capture).toContain('persist()');
  const session = watch('Infrastructure/WatchSessionManager.swift');
  const send = session.slice(
    session.indexOf('func send(_ checkIn:'),
    session.indexOf('func requestWorkoutStart(')
  );
  expect(send).toContain('transfer(OutboundPayloads.checkIn(checkIn))');
  expect(send).toContain('return .queued');
});

it('covers native first-run selection, hidden Entry and workout priority in the Swift harness', () => {
  const checks = read('__tests__/watch/ChallengeModelChecks.swift');
  for (const assertion of [
    'missing weight initially selects first check-in',
    'missing weight does not remove Challenges',
    'stale weight initially selects Entry without reordering',
    'missing weight respects hidden Entry',
    'active workout overrides first check-in',
  ])
    expect(checks).toContain(assertion);
});
