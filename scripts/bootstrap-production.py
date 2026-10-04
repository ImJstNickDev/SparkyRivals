#!/usr/bin/env python3
"""Prepare local files only. Never deploy, overwrite secrets or contact a host."""
import argparse
import fcntl
import os
from pathlib import Path
import secrets
import subprocess
import sys
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
SECRET_NAMES = ('db_password', 'app_db_password', 'api_encryption_key', 'auth_secret')


def validate_url(value, local_test=False):
    parsed = urlsplit(value)
    if (parsed.scheme not in ('https', 'http') or not parsed.hostname
            or parsed.username or parsed.password or parsed.query or parsed.fragment
            or parsed.path not in ('', '/') or any(char.isspace() for char in value)
            or any(char in value for char in ('$', '"', "'"))):
        raise ValueError('Use a canonical HTTP(S) origin without credentials/path/query')
    # Access validates port syntax/range as well.
    _ = parsed.port
    if not local_test and parsed.scheme != 'https':
        raise ValueError('Production requires an HTTPS origin')
    if local_test and not parsed.hostname.endswith('.test'):
        raise ValueError('Local acceptance must use a reserved .test hostname')
    return value.rstrip('/')


def exclusive_write(path, content):
    with path.open('x', encoding='utf8') as output:
        os.chmod(path, 0o600)
        output.write(content)


def prepare(root, data, url, local_test=False):
    url = validate_url(url, local_test)
    root = root.resolve()
    expected = root / 'dockerdata'
    # Also excludes symlinks escaping the checkout and path traversal.
    if data.is_symlink() or not data.resolve().is_relative_to(expected):
        raise ValueError('Persistent state must remain under repository-root dockerdata')
    if not local_test and data != expected:
        raise ValueError('Production uses exactly repository-root dockerdata')
    env_link = root / '.env'
    runtime = data / 'config/runtime.env'
    if not local_test and os.path.lexists(env_link):
        if not env_link.is_symlink() or env_link.resolve() != runtime.resolve():
            raise ValueError('Existing .env preserved; reconcile it manually before bootstrap')
    data.mkdir(mode=0o700, parents=True, exist_ok=True)
    with (data / '.bootstrap.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        for name in ('postgres', 'uploads', 'backups', 'config', 'secrets'):
            folder = data / name
            if folder.is_symlink():
                raise ValueError(f'Refusing symlink directory: {name}')
            if not folder.exists():
                folder.mkdir(mode=0o700)
                if name == 'postgres':
                    # Postgres 18 chowns PGDATA (18/docker), not the mount root.
                    # UID 70 must traverse that root after dropping privileges.
                    # Host dockerdata stays 0700 and PGDATA is managed as 0700.
                    folder.chmod(0o755)
        missing = [name for name in SECRET_NAMES if not (data / 'secrets' / name).exists()]
        if missing and any((data / 'postgres').iterdir()):
            raise ValueError('Database exists but secrets are missing; restore secrets, never regenerate')
        for name in SECRET_NAMES:
            target = data / 'secrets' / name
            if target.is_symlink():
                raise ValueError('Refusing symlink secret')
            if not target.exists():
                exclusive_write(target, secrets.token_hex(32) + '\n')
            elif not target.is_file() or target.stat().st_mode & 0o077 or target.stat().st_size == 0:
                raise ValueError(f'Existing secret must be nonempty and mode 0600: {name}')
        if runtime.is_symlink():
            raise ValueError('Refusing symlink runtime file')
        if runtime.exists():
            if f'SPARKY_FITNESS_FRONTEND_URL={url}\n' not in runtime.read_text():
                raise ValueError('Existing origin differs; runtime configuration preserved')
            if runtime.stat().st_mode & 0o077:
                raise ValueError('runtime.env must have mode 0600')
        else:
            template = (root / 'docker/sparkyrivals/runtime.env.example').read_text()
            exclusive_write(runtime, template.replace('@PUBLIC_URL@', url))
        if not local_test and not os.path.lexists(env_link):
            env_link.symlink_to('dockerdata/config/runtime.env')
    return runtime


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', required=True, help='Operator-chosen canonical HTTPS origin')
    parser.add_argument('--local-test', action='store_true', help='Disposable .test origin; no .env link')
    parser.add_argument('--data-dir', type=Path, help='Local-test directory beneath dockerdata')
    args = parser.parse_args()
    if not args.local_test:
        subprocess.run(['docker', 'network', 'inspect', 'prod-frontend'],
                       check=True, stdout=subprocess.DEVNULL)
    data = args.data_dir or ROOT / 'dockerdata'
    runtime = prepare(ROOT, data.absolute(), args.url, args.local_test)
    print(f'Prepared {runtime.relative_to(ROOT)}; no containers started, existing secrets preserved.')
    print('Review admin email, optional integrations and secure off-host backups before first startup.')


if __name__ == '__main__':
    try:
        main()
    except (ValueError, OSError, subprocess.CalledProcessError) as error:
        print(f'Bootstrap stopped: {error}', file=sys.stderr)
        sys.exit(1)
