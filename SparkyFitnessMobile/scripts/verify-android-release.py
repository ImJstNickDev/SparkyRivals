#!/usr/bin/env python3
"""Verify the production phone/Wear pair without reading signing passwords."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import zipfile

PACKAGE = 'com.imjstnick.sparkyrivals'
FINGERPRINT = '3EB2F9508D159CC150141A9A570D3771244F591059D0AE09E961281EB642D52A'


def verify_runtime_config(config):
    if (config.get('android', {}).get('package') != PACKAGE
            or config.get('scheme') != 'sparkyrivals'
            or config.get('owner') != 'imjstnickdev'
            or config.get('slug') != 'sparkyrivals'
            or config.get('extra', {}).get('eas', {}).get('projectId') !=
            '63f08cec-3f87-4cee-89be-bebf970b6262'):
        raise ValueError('Bundled Expo runtime config must match owned production identity')


def inspect_apk(apk, tools, expected_code):
    signature = subprocess.check_output([str(tools / 'apksigner'), 'verify', '--verbose',
                                         '--print-certs', str(apk)], text=True)
    signers = re.findall(r'^Signer #\d+ certificate SHA-256 digest: (\S+)$', signature, re.M)
    if len(signers) != 1 or signers[0].replace(':', '').upper() != FINGERPRINT:
        raise ValueError('APK must have exactly the expected permanent production signer')
    badging = subprocess.check_output([str(tools / 'aapt'), 'dump', 'badging', str(apk)], text=True)
    identity = re.search(r"^package: name='([^']+)' versionCode='(\d+)'", badging, re.M)
    if not identity or identity.group(1) != PACKAGE or int(identity.group(2)) != expected_code:
        raise ValueError('Unexpected production package/versionCode')
    with apk.open('rb') as artifact:
        digest = hashlib.file_digest(artifact, 'sha256').hexdigest()
    return {'path': str(apk.resolve()), 'package': identity.group(1), 'versionCode': expected_code,
            'signerSha256': FINGERPRINT, 'sha256': digest}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--phone', type=Path, required=True)
    parser.add_argument('--wear', type=Path, required=True)
    parser.add_argument('--phone-code', type=int, required=True)
    parser.add_argument('--wear-code', type=int, required=True)
    parser.add_argument('--build-tools', type=Path, default=Path(
        os.environ.get('ANDROID_HOME', '/opt/android-sdk')) / 'build-tools/36.0.0')
    args = parser.parse_args()
    if not 1 < args.phone_code < 1_000_000_000 or not 1_000_000_000 <= args.wear_code <= 2_100_000_000:
        parser.error('Use allocated, disjoint phone and Wear release version codes')
    result = {'phone': inspect_apk(args.phone, args.build_tools, args.phone_code),
              'wear': inspect_apk(args.wear, args.build_tools, args.wear_code)}
    with zipfile.ZipFile(args.phone) as archive:
        verify_runtime_config(json.loads(archive.read('assets/app.config')))
    result['phone']['expoRuntimeIdentity'] = 'verified'
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()
