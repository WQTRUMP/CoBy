#!/bin/sh
set -eu

until cypher-shell -a "bolt://neo4j:7687" -u "${NEO4J_USERNAME}" -p "${NEO4J_PASSWORD}" -d system "RETURN 1;" >/dev/null 2>&1; do
  sleep 2
done

for file in /cypher/constraints.cypher /cypher/indexes.cypher /cypher/seed.cypher; do
  cypher-shell -a "bolt://neo4j:7687" -u "${NEO4J_USERNAME}" -p "${NEO4J_PASSWORD}" -d "${NEO4J_DATABASE}" -f "${file}"
done
