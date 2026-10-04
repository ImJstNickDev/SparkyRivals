#!/usr/bin/env python3
"""Build and exercise production topology locally; retain private test data/logs."""
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import uuid

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('bootstrap', ROOT / 'scripts/bootstrap-production.py')
bootstrap = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bootstrap)


def run(args, **kwargs):
    return subprocess.run(args, check=True, text=True, **kwargs)


def capture(args):
    return run(args, stdout=subprocess.PIPE).stdout


def assert_topology(config, data):
    assert not config.get('volumes'), 'Named volumes forbidden'
    for name, service in config['services'].items():
        assert not service.get('ports'), 'Host ports forbidden'
        expected = {'sparkyrivals-internal'}
        if name == 'sparkyrivals-frontend':
            expected.add('prod-frontend')
        assert set(service['networks']) == expected
        for mount in service.get('volumes', []):
            assert mount['type'] == 'bind'
            source = Path(mount['source'])
            if not mount.get('read_only') or '/secrets' in mount['target']:
                assert source.is_relative_to(data)
        if name != 'sparkyrivals-db':
            assert service['pull_policy'] == 'build'
            assert Path(service['build']['context']) == ROOT
            assert service['build']['dockerfile'] == 'docker/Dockerfile.' + (
                'frontend' if name.endswith('frontend') else 'backend')
    assert not config['networks']['sparkyrivals-internal'].get('internal')
    assert config['networks']['prod-frontend']['external']
    assert config['networks']['prod-frontend']['name'] == 'prod-frontend'


def main():
    os.umask(0o077)
    # Refuse remote Docker contexts/overrides: this command is laptop acceptance.
    endpoint = os.environ.get('DOCKER_HOST') or json.loads(capture(
        ['docker', 'context', 'inspect']))[0]['Endpoints']['docker']['Host']
    if not endpoint.startswith('unix://'):
        raise RuntimeError('Local Unix Docker socket required; remote testing is forbidden')
    token = uuid.uuid4().hex[:12]
    project = 'sparkyrivals-acceptance-' + token
    data = ROOT / 'dockerdata' / project
    runtime = bootstrap.prepare(ROOT, data, 'https://sparkyrivals.test', True)
    config = json.loads(capture(['docker', 'compose', '--env-file', str(runtime),
                                '-f', str(ROOT / 'compose.yaml'), 'config',
                                '--no-env-resolution', '--format', 'json']))
    config['name'] = project
    config['networks']['sparkyrivals-internal']['name'] = project + '-internal'
    for service in config['services'].values():
        for mount in service.get('volumes', []):
            source = Path(mount['source'])
            if source.is_relative_to(ROOT / 'dockerdata'):
                mount['source'] = str(data / source.relative_to(ROOT / 'dockerdata'))
        if service.get('env_file'):
            service['env_file'] = [{'path': str(runtime)}]
    assert_topology(config, data)
    compose_file = data / 'compose.json'
    compose_file.write_text(json.dumps(config, indent=2))
    compose = ['docker', 'compose', '-p', project, '-f', str(compose_file)]
    run(compose + ['config', '--quiet'])
    created_network = False
    started = False
    try:
        network = subprocess.run(['docker', 'network', 'inspect', 'prod-frontend'],
                                 text=True, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
        if network.returncode:
            run(['docker', 'network', 'create', '--label', 'sparkyrivals.acceptance=' + token,
                 'prod-frontend'], stdout=subprocess.DEVNULL)
            created_network = True
        else:
            for container_id in json.loads(network.stdout)[0].get('Containers', {}):
                info = json.loads(capture(['docker', 'inspect', container_id]))[0]
                aliases = info['NetworkSettings']['Networks']['prod-frontend'].get('Aliases') or []
                if 'sparkyrivals-frontend' in aliases:
                    raise RuntimeError('Existing SparkyRivals frontend on prod-frontend; refusing collision')
        print(f'Local acceptance project: {project}\nPrivate evidence/data: {data}', flush=True)
        started = True
        with (data / 'build-startup.log').open('w') as log:
            run(compose + ['up', '-d', '--wait', '--wait-timeout', '240'], stdout=log, stderr=log)
        evidence = {'project': project, 'containers': {}, 'routes': {}}
        for service in config['services']:
            container = capture(compose + ['ps', '-q', service]).strip()
            info = json.loads(capture(['docker', 'inspect', container]))[0]
            assert not info['HostConfig']['PortBindings']
            assert all(not bindings for bindings in info['NetworkSettings']['Ports'].values())
            expected_networks = {project + '-internal'}
            if service.endswith('frontend'):
                expected_networks.add('prod-frontend')
            assert set(info['NetworkSettings']['Networks']) == expected_networks
            assert info['State']['Health']['Status'] == 'healthy'
            for mount in info['Mounts']:
                assert mount['Type'] == 'bind'
                if mount['RW'] or mount['Destination'].startswith('/run/secrets'):
                    assert Path(mount['Source']).is_relative_to(data)
            evidence['containers'][service] = {
                'image': info['Image'], 'health': info['State']['Health']['Status'],
                'networks': sorted(expected_networks), 'portBindings': info['HostConfig']['PortBindings'],
                'mounts': [{key: mount[key] for key in ('Source', 'Destination', 'Type', 'RW')}
                           for mount in info['Mounts']],
            }
        curl = ['docker', 'run', '--rm', '--network', 'prod-frontend', 'curlimages/curl:8.12.1',
                '-sS', '--max-time', '20', '-H', 'Host: sparkyrivals.test']
        for route, expected in [('/', '200'), ('/api/health', '200'),
                                ('/api/auth/get-session', '200'), ('/api/v2/challenges', '401')]:
            code = capture(curl + ['-o', '/dev/null', '-w', '%{http_code}',
                                   'http://sparkyrivals-frontend:80' + route]).strip()
            assert code == expected, f'{route}: expected {expected}, got {code}'
            evidence['routes'][route] = code
        for host in ('sparkyrivals-server', 'sparkyrivals-db'):
            result = subprocess.run(curl + ['http://' + host + ':3010'],
                                    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            assert result.returncode == 6, 'Backend/database must not resolve on external network'
        # Logical backup/restore into another disposable DB in this test cluster.
        # No production DB or user fixture is ever used.
        db_exec = compose + ['exec', '-T', 'sparkyrivals-db', 'sh', '-c']
        run(db_exec + ['psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" '
                       '-c "CREATE TABLE release_acceptance_probe (value text); '
                       "INSERT INTO release_acceptance_probe VALUES ('retained');\""],
            stdout=subprocess.DEVNULL)
        dump = data / 'backups/acceptance.sql'
        with dump.open('w') as output:
            run(db_exec + ['pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB"'], stdout=output)
        run(db_exec + ['createdb -U "$POSTGRES_USER" release_acceptance_restore'])
        with dump.open() as source, (data / 'restore.log').open('w') as log:
            run(db_exec + ['psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d release_acceptance_restore'],
                stdin=source, stdout=log, stderr=log)
        restored = capture(db_exec + ['psql -At -U "$POSTGRES_USER" -d release_acceptance_restore '
                                      '-c "SELECT value FROM release_acceptance_probe"']).strip()
        assert restored == 'retained'
        evidence['logicalRestore'] = 'passed in disposable database with existing cluster roles'
        # Repeat up: pull_policy=build must enter the build even with existing images.
        # Startup uses the ordinary migration initializer against the same data.
        with (data / 'repeat-startup.log').open('w') as log:
            run(compose + ['up', '-d', '--wait', '--wait-timeout', '240'], stdout=log, stderr=log)
        repeated = (data / 'repeat-startup.log').read_text()
        assert 'Building' in repeated or 'building' in repeated, 'No rebuild observed'
        (data / 'acceptance.json').write_text(json.dumps(evidence, indent=2))
        print('PASS: fork builds, healthy services, DNS/proxy/auth routes, zero published ports, bind mounts, logical restore, repeat up', flush=True)
    finally:
        if started:
            with (data / 'container.log').open('w') as log:
                subprocess.run(compose + ['logs', '--no-color'], stdout=log, stderr=log)
            run(compose + ['down', '--timeout', '30'])  # Never -v; retain test files.
        if created_network:
            state = json.loads(capture(['docker', 'network', 'inspect', 'prod-frontend']))[0]
            if state.get('Labels', {}).get('sparkyrivals.acceptance') == token and not state.get('Containers'):
                run(['docker', 'network', 'rm', 'prod-frontend'], stdout=subprocess.DEVNULL)
        print(f'Private test files retained at {data}; no user data deleted.', flush=True)


if __name__ == '__main__':
    try:
        main()
    except (AssertionError, RuntimeError, subprocess.CalledProcessError) as error:
        print(f'Local acceptance failed: {error}', file=sys.stderr)
        sys.exit(1)
