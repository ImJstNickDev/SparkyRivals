#!/usr/bin/env python3
import importlib.util
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('bootstrap', Path(__file__).with_name('bootstrap-production.py'))
bootstrap = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bootstrap)


class BootstrapTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        folder = self.root / 'docker/sparkyrivals'
        folder.mkdir(parents=True)
        (folder / 'runtime.env.example').write_text(
            (bootstrap.ROOT / 'docker/sparkyrivals/runtime.env.example').read_text())
        self.data = self.root / 'dockerdata'

    def run_bootstrap(self):
        return bootstrap.prepare(self.root, self.data, 'https://fitness.example.test')

    def test_private_idempotent_secrets_and_relative_env(self):
        runtime = self.run_bootstrap()
        original = {name: (self.data / 'secrets' / name).read_bytes() for name in bootstrap.SECRET_NAMES}
        self.run_bootstrap()
        self.assertEqual(runtime.stat().st_mode & 0o777, 0o600)
        self.assertEqual((self.data / 'postgres').stat().st_mode & 0o777, 0o755)
        self.assertEqual((self.root / '.env').readlink(), Path('dockerdata/config/runtime.env'))
        for name, value in original.items():
            target = self.data / 'secrets' / name
            self.assertEqual(target.read_bytes(), value)
            self.assertEqual(target.stat().st_mode & 0o777, 0o600)

    def test_existing_env_is_preserved(self):
        (self.root / '.env').write_text('keep me')
        with self.assertRaisesRegex(ValueError, 'Existing .env'):
            self.run_bootstrap()
        self.assertEqual((self.root / '.env').read_text(), 'keep me')

    def test_missing_secret_never_rotates_existing_database(self):
        self.run_bootstrap()
        (self.data / 'postgres/PG_VERSION').write_text('18')
        (self.data / 'secrets/db_password').unlink()
        with self.assertRaisesRegex(ValueError, 'Database exists'):
            self.run_bootstrap()
        self.assertFalse((self.data / 'secrets/db_password').exists())

    def test_changed_origin_fails_without_overwrite(self):
        runtime = self.run_bootstrap()
        original = runtime.read_bytes()
        with self.assertRaisesRegex(ValueError, 'origin differs'):
            bootstrap.prepare(self.root, self.data, 'https://another.example.test')
        self.assertEqual(runtime.read_bytes(), original)

    def test_auth_origin_mismatch_is_rejected_without_repair(self):
        runtime = self.run_bootstrap()
        runtime.write_text(runtime.read_text().replace(
            'BETTER_AUTH_URL=https://fitness.example.test',
            'BETTER_AUTH_URL=http://sparkyrivals-server:3010'))
        original = runtime.read_bytes()
        with self.assertRaisesRegex(ValueError, 'origin differs'):
            self.run_bootstrap()
        self.assertEqual(runtime.read_bytes(), original)

    def test_signup_is_closed_on_first_start(self):
        runtime = self.run_bootstrap()
        self.assertIn('SPARKY_FITNESS_DISABLE_SIGNUP=true\n', runtime.read_text())

    def test_local_test_does_not_change_root_env(self):
        (self.root / '.env').write_text('user state')
        bootstrap.prepare(self.root, self.data / 'acceptance-test', 'http://local.test', True)
        self.assertEqual((self.root / '.env').read_text(), 'user state')

    def test_invalid_or_unsafe_origins(self):
        for url in ('http://production.example', 'https://user:password@host', 'https://host/path',
                    'https://host?query=x', 'https://host\nINJECT=1', 'https://$TOKEN',
                    'https://host:invalid', 'https://host\t'):
            with self.subTest(url=url), self.assertRaises(ValueError):
                bootstrap.validate_url(url)
        with self.assertRaises(ValueError):
            bootstrap.validate_url('https://real.example', True)

    def test_data_cannot_escape_checkout(self):
        with self.assertRaises(ValueError):
            bootstrap.prepare(self.root, self.root / 'elsewhere', 'https://local.test', True)

    def test_optional_push_never_generates_external_credentials(self):
        self.run_bootstrap()
        self.assertFalse((self.data / 'secrets/expo_access_token').exists())

    def test_private_external_push_import_is_idempotent_and_never_overwrites(self):
        source = self.root / 'external-token'
        source.write_text('unit-test-external-token\n')
        source.chmod(0o600)
        bootstrap.prepare(self.root, self.data, 'https://fitness.example.test', expo_token_source=source)
        target = self.data / 'secrets/expo_access_token'
        self.assertEqual(target.read_bytes(), source.read_bytes())
        self.assertEqual(target.stat().st_mode & 0o777, 0o600)
        bootstrap.prepare(self.root, self.data, 'https://fitness.example.test', expo_token_source=source)
        source.write_text('replacement-unit-test-token\n')
        with self.assertRaises(ValueError):
            bootstrap.prepare(self.root, self.data, 'https://fitness.example.test', expo_token_source=source)
        self.assertEqual(target.read_text(), 'unit-test-external-token\n')

    def test_push_enabled_requires_external_private_file_and_container_path(self):
        runtime = self.run_bootstrap()
        runtime.write_text(runtime.read_text().replace('SPARKY_FITNESS_REMOTE_PUSH_ENABLED=false', 'SPARKY_FITNESS_REMOTE_PUSH_ENABLED=true'))
        with self.assertRaisesRegex(ValueError, 'Push enabled'):
            self.run_bootstrap()
        token = self.data / 'secrets/expo_access_token'
        token.write_text('unit-test-external-token\n'); token.chmod(0o600)
        with self.assertRaisesRegex(ValueError, 'EXPO_ACCESS_TOKEN_FILE'):
            self.run_bootstrap()
        runtime.write_text(runtime.read_text() + '\nEXPO_ACCESS_TOKEN_FILE=/run/secrets/expo_access_token\n')
        self.run_bootstrap()
        token.chmod(0o644)
        with self.assertRaisesRegex(ValueError, 'Push enabled'):
            self.run_bootstrap()

    def test_push_import_rejects_public_or_symlink_source(self):
        source = self.root / 'external-token'
        source.write_text('unit-test-external-token\n'); source.chmod(0o644)
        with self.assertRaises(ValueError):
            bootstrap.prepare(self.root, self.data, 'https://fitness.example.test', expo_token_source=source)
        source.chmod(0o600)
        link = self.root / 'linked-token'; link.symlink_to(source)
        with self.assertRaises(ValueError):
            bootstrap.prepare(self.root, self.data, 'https://fitness.example.test', expo_token_source=link)


if __name__ == '__main__':
    unittest.main()
