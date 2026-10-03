#!/usr/bin/env python3
import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('verify', Path(__file__).with_name('verify-android-release.py'))
verify = importlib.util.module_from_spec(spec)
spec.loader.exec_module(verify)


class ReleaseVerificationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.apk = Path(self.temp.name) / 'test.apk'
        self.apk.write_bytes(b'test fixture, never distributed')
        self.signature = 'Signer #1 certificate SHA-256 digest: ' + verify.FINGERPRINT.lower() + '\n'
        self.badging = "package: name='com.imjstnick.sparkyrivals' versionCode='1001' versionName='1.0'"

    def inspect(self, signature=None, badging=None):
        with patch.object(verify.subprocess, 'check_output', side_effect=[
                signature or self.signature, badging or self.badging]):
            return verify.inspect_apk(self.apk, Path('/unused-test-tools'), 1001)

    def test_exact_owned_signature(self):
        self.assertEqual(self.inspect()['signerSha256'], verify.FINGERPRINT)

    def test_unrelated_certificate_rejected(self):
        with self.assertRaises(ValueError):
            self.inspect(signature='Signer #1 certificate SHA-256 digest: ' + '0' * 64 + '\n')

    def test_multiple_signers_rejected(self):
        with self.assertRaises(ValueError):
            self.inspect(signature=self.signature + self.signature.replace('#1', '#2'))

    def test_wrong_variant_rejected(self):
        with self.assertRaises(ValueError):
            self.inspect(badging=self.badging.replace('sparkyrivals', 'sparkyrivals.dev'))

    def test_wrong_version_rejected(self):
        with self.assertRaises(ValueError):
            self.inspect(badging=self.badging.replace('1001', '1002'))

    def test_bundled_runtime_must_match_native_identity(self):
        valid = {'android': {'package': verify.PACKAGE}, 'scheme': 'sparkyrivals',
                 'owner': 'imjstnickdev', 'slug': 'sparkyrivals',
                 'extra': {'eas': {'projectId': '63f08cec-3f87-4cee-89be-bebf970b6262'}}}
        verify.verify_runtime_config(valid)
        for changed in ({'scheme': 'sparkyfitnessmobile'}, {'owner': None}, {'extra': {}},
                        {'android': {'package': verify.PACKAGE + '.dev'}}):
            with self.subTest(changed=changed), self.assertRaises(ValueError):
                verify.verify_runtime_config({**valid, **changed})


if __name__ == '__main__':
    unittest.main()
