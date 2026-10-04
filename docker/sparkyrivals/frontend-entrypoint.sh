#!/bin/sh
set -eu
# NPM terminates TLS; nginx sees HTTP. Use the operator's canonical origin,
# never an arbitrary incoming X-Forwarded-Proto header.
case "${SPARKY_FITNESS_FRONTEND_URL:-}" in
  https://*) public_scheme=https ;;
  http://*) public_scheme=http ;;
  *) echo 'A canonical HTTP(S) frontend origin is required' >&2; exit 1 ;;
esac
template=/etc/nginx/templates/default.conf.template
if ! grep -q 'proxy_set_header X-Forwarded-Proto ' "$template"; then
  echo 'Upstream nginx proxy layout changed; review production routing' >&2
  exit 1
fi
sed -i "s/proxy_set_header X-Forwarded-Proto [^;]*;/proxy_set_header X-Forwarded-Proto ${public_scheme};/g" "$template"
exec /docker-entrypoint.sh
