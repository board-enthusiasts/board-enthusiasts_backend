#!/usr/bin/env bash
set -euo pipefail

SERVER_CERT_SOURCE="/certs/server.crt"
SERVER_KEY_SOURCE="/certs/server.key"
SERVER_CERT_TARGET="/var/lib/postgresql/server.crt"
SERVER_KEY_TARGET="/var/lib/postgresql/server.key"

if [[ -f "${SERVER_CERT_SOURCE}" && -f "${SERVER_KEY_SOURCE}" ]]; then
  cp "${SERVER_CERT_SOURCE}" "${SERVER_CERT_TARGET}"
  cp "${SERVER_KEY_SOURCE}" "${SERVER_KEY_TARGET}"
  chown postgres:postgres "${SERVER_CERT_TARGET}" "${SERVER_KEY_TARGET}"
  chmod 644 "${SERVER_CERT_TARGET}"
  chmod 600 "${SERVER_KEY_TARGET}"

  set -- "$@" \
    -c ssl=on \
    -c ssl_cert_file="${SERVER_CERT_TARGET}" \
    -c ssl_key_file="${SERVER_KEY_TARGET}" \
    -c hba_file=/etc/postgresql/pg_hba_tls.conf
fi

exec /usr/local/bin/docker-entrypoint.sh "$@"
