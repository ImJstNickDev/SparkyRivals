#!/usr/bin/env python3
"""Compile actual Wear protocol with pinned Kotlin/JUnit, without Android SDK.
Cache is disposable; --download explicitly permits fetching locked Maven jars.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile
import urllib.request

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--download', action='store_true')
parser.add_argument('--cache', default='/tmp/sparkyrivals-wear/jvm')
args = parser.parse_args()
root = Path(__file__).resolve().parent.parent
cache = Path(args.cache)
cache.mkdir(parents=True, exist_ok=True)
for entry in json.loads((root / 'scripts/wear-jvm-dependencies.json').read_text()):
    dest = cache / entry['file']
    if not dest.exists():
        if not args.download:
            raise SystemExit('Missing compiler dependency; use --download or populate the cache')
        urllib.request.urlretrieve(entry['url'], dest)
    if hashlib.sha256(dest.read_bytes()).hexdigest() != entry['sha256']:
        raise SystemExit(f'Checksum mismatch: {dest.name}')
java = str(Path(os.environ['JAVA_HOME']) / 'bin/java') if os.environ.get('JAVA_HOME') else 'java'
classpath = os.pathsep.join(str(p) for p in sorted(cache.glob('*.jar')))
sources = sorted((root / 'targets/wear/protocol').rglob('*.kt')) + sorted((root / 'targets/wear/src/test').rglob('*.kt'))
with tempfile.TemporaryDirectory(prefix='wear-models-') as output:
    subprocess.run([java, '-cp', classpath, 'org.jetbrains.kotlin.cli.jvm.K2JVMCompiler', '-no-stdlib', '-no-reflect', '-jvm-target', '17', '-classpath', classpath, '-d', output, *map(str, sources)], check=True)
    subprocess.run([java, '-cp', os.pathsep.join([output, str(root / '__tests__/fixtures'), classpath]), 'org.junit.runner.JUnitCore', 'com.sparkyrivals.companion.ChallengeProtocolTest', 'com.sparkyrivals.companion.ChallengeSurfaceTest', 'com.sparkyrivals.companion.ChallengeDisplayTest'], check=True)
