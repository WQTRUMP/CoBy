#!/bin/sh
set -eu

until /usr/bin/mc alias set local "http://minio:9000" "${MINIO_ROOT_USER}" "${MINIO_ROOT_PASSWORD}" >/dev/null 2>&1; do
  sleep 2
done

/usr/bin/mc mb --ignore-existing "local/${MINIO_BUCKET_RAW}"
/usr/bin/mc mb --ignore-existing "local/${MINIO_BUCKET_CURATED}"
/usr/bin/mc mb --ignore-existing "local/${MINIO_BUCKET_EXPORTS}"
/usr/bin/mc anonymous set private "local/${MINIO_BUCKET_RAW}" >/dev/null
/usr/bin/mc anonymous set private "local/${MINIO_BUCKET_CURATED}" >/dev/null
/usr/bin/mc anonymous set private "local/${MINIO_BUCKET_EXPORTS}" >/dev/null
