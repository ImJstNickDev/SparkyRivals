"""Private Docker-only two-hop proxy and first-admin acceptance."""
import json
from pathlib import Path
import secrets
import subprocess

ROOT = Path(__file__).resolve().parents[1]


def check_auth(compose, project, data, images):
    def run(args, **kwargs):
        return subprocess.run(args, check=True, text=True, **kwargs)

    def capture(args, **kwargs):
        return run(args, stdout=subprocess.PIPE, **kwargs).stdout

    password = secrets.token_urlsafe(24)
    admin_input = json.dumps({'name': 'Acceptance administrator', 'password': password})
    admin = compose + ['exec', '-T', '-e', 'SPARKY_FITNESS_LOG_LEVEL=SILENT',
                       'sparkyrivals-server', './node_modules/.bin/tsx',
                       'scripts/initializeFirstAdmin.script.ts']
    with (data / 'admin-onboarding.log').open('w') as log:
        run(admin, input=admin_input, stdout=log, stderr=log)
        # An initialized database is never reset or overwritten by a retry.
        duplicate = subprocess.run(admin, input=admin_input, text=True, stdout=log, stderr=log)
        assert duplicate.returncode != 0
        open_signup = admin.copy()
        open_signup[open_signup.index('SPARKY_FITNESS_LOG_LEVEL=SILENT')] = 'SPARKY_FITNESS_DISABLE_SIGNUP=false'
        refused = subprocess.run(open_signup, input=admin_input, text=True, stdout=log, stderr=log)
        assert refused.returncode != 0
    proxy = project + '-proxy'
    config = data / 'proxy.conf'
    config.write_text('''server {
  listen 80;
  location / {
    proxy_pass http://sparkyrivals-frontend:80;
    proxy_set_header Host sparkyrivals.test;
    proxy_set_header X-Forwarded-Proto https;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }
}
''')
    try:
        run(['docker', 'run', '-d', '--name', proxy, '--network', 'prod-frontend',
             '--mount', f'type=bind,src={config},dst=/etc/nginx/conf.d/default.conf,readonly',
             '--entrypoint', 'nginx', images['sparkyrivals-frontend'], '-g', 'daemon off;'],
            stdout=subprocess.DEVNULL)
        result = json.loads(capture([
            'docker', 'run', '--rm', '-i', '--network', 'prod-frontend',
            '--mount', f'type=bind,src={ROOT / "scripts/production-auth-probe.mjs"},dst=/probe.mjs,readonly',
            '--entrypoint', 'node', images['sparkyrivals-server'], '/probe.mjs',
        ], input=json.dumps({'proxy': 'http://' + proxy, 'email': 'admin@example.test', 'password': password})))
        # Only a boolean leaves the DB. Verify Better Auth persisted the real
        # Docker client's IP, not the proxy or any attacker-supplied header.
        ip = result.pop('clientIp')
        assert all(part.isdigit() for part in ip.split('.')) and len(ip.split('.')) == 4
        sql = f'''SELECT count(*)=1 AND bool_and(ip_address='{ip}') FROM session;'''
        verified = capture(compose + ['exec', '-T', 'sparkyrivals-db', 'sh', '-c',
                           'psql -At -U "$POSTGRES_USER" -d "$POSTGRES_DB"'], input=sql)
        assert verified.strip() == 't', 'Session IP did not match the real proxy client'
        result['persistedRealClientIp'] = True
        result['repeatAdminInitializationRefused'] = True
        return result
    finally:
        # This container holds no persistent state and belongs only to this test.
        subprocess.run(['docker', 'stop', '--time', '10', proxy], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        subprocess.run(['docker', 'rm', proxy], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
