#!/usr/bin/env python3
"""Initialize the first admin through the running backend; never open public signup."""
import getpass
import json
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]


def main():
    name = input('Administrator display name: ').strip()
    password = getpass.getpass('New administrator password (8–128 characters): ')
    if not name or not 8 <= len(password) <= 128:
        raise ValueError('Name and valid password required')
    if password != getpass.getpass('Confirm password: '):
        raise ValueError('Passwords differ')
    # Password travels only on stdin. Never argv, environment, logs or a file.
    result = subprocess.run([
        'docker', 'compose', '-f', str(ROOT / 'compose.yaml'), 'exec', '-T',
        '-e', 'SPARKY_FITNESS_LOG_LEVEL=SILENT', 'sparkyrivals-server',
        './node_modules/.bin/tsx', 'scripts/initializeFirstAdmin.script.ts',
    ], cwd=ROOT, input=json.dumps({'name': name, 'password': password}), text=True)
    if result.returncode:
        raise ValueError('Initialization failed; existing state was not reset')


if __name__ == '__main__':
    try:
        main()
    except (ValueError, KeyboardInterrupt, EOFError) as error:
        print(f'Stopped: {error}', file=sys.stderr)
        sys.exit(1)
