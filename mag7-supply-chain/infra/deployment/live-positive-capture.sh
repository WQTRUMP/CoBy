#!/usr/bin/env bash
set -uo pipefail

timestamp() {
  date -u +"%Y-%m-%dT%H:%M:%SZ"
}

usage() {
  cat <<'EOF'
用法：
  bash infra/deployment/live-positive-capture.sh [--mode auto|docker|external] [--env-file <path>] [--output-dir <dir>] [--keep-services]

说明：
  - 这是 full.21 source=neo4j 正向闭环的中文预检/取证入口。
  - 它会先生成不含密钥明文的环境预检摘要，再调用底层 live-acceptance-commands.sh。
  - 无论成功或失败，都会在输出目录落盘中文摘要、结构化索引、底层 result/import/http/log 证据。
  - authoritative snapshot 固定为 snapshot:2026-06-15.full.18。
  - published 固定为 332/444；all-candidates 固定为 335/448；candidate-only 固定为 3/4。

参数：
  --mode           默认 auto。auto 优先 external，缺完整外部依赖时回退 docker。
  --env-file       可选。先 source 一个环境文件，再执行预检与取证。
  --output-dir     可选。默认 /tmp/mag7-live-positive-capture-<UTC 时间戳>
  --keep-services  透传给底层执行器；docker 模式失败或成功后保留容器。
EOF
}

MODE="auto"
ENV_FILE=""
OUTPUT_DIR=""
KEEP_SERVICES="false"

while (($# > 0)); do
  case "$1" in
    --mode)
      MODE="${2:-}"
      shift 2
      ;;
    --env-file)
      ENV_FILE="${2:-}"
      shift 2
      ;;
    --output-dir)
      OUTPUT_DIR="${2:-}"
      shift 2
      ;;
    --keep-services)
      KEEP_SERVICES="true"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "未知参数: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ "$MODE" != "auto" && "$MODE" != "docker" && "$MODE" != "external" ]]; then
  echo "--mode 只支持 auto、docker、external" >&2
  exit 1
fi

REPO_ROOT="${REPO_ROOT:-/workspace/project/mag7-supply-chain}"
DEPLOYMENT_DIR="$REPO_ROOT/infra/deployment"
RUNNER="$DEPLOYMENT_DIR/live-acceptance-commands.sh"
MANIFEST_PATH="${LIVE_ACCEPTANCE_MANIFEST_PATH:-$DEPLOYMENT_DIR/live-acceptance-manifest.json}"
DEFAULT_ENV_FILE="$DEPLOYMENT_DIR/live-acceptance.env.example"

if [[ -n "$ENV_FILE" ]]; then
  if [[ ! -f "$ENV_FILE" ]]; then
    echo "找不到 --env-file: $ENV_FILE" >&2
    exit 1
  fi
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

command -v jq >/dev/null 2>&1 || { echo "缺少 jq" >&2; exit 1; }
command -v bash >/dev/null 2>&1 || { echo "缺少 bash" >&2; exit 1; }

if [[ ! -f "$RUNNER" ]]; then
  echo "找不到底层执行器: $RUNNER" >&2
  exit 1
fi

if [[ ! -f "$MANIFEST_PATH" ]]; then
  echo "找不到 manifest: $MANIFEST_PATH" >&2
  exit 1
fi

read_manifest_value() {
  jq -r "$1 // empty" "$MANIFEST_PATH"
}

AUTHORITATIVE_SNAPSHOT="$(read_manifest_value '.release.authoritative_snapshot')"
PACKAGE_SHELL_SNAPSHOT="$(read_manifest_value '.release.package_snapshot_shell')"
PUBLISHED_RELATIONS="$(read_manifest_value '.release.counts.published.relations')"
PUBLISHED_EVIDENCE="$(read_manifest_value '.release.counts.published.evidence')"
ALL_CANDIDATE_RELATIONS="$(read_manifest_value '.release.counts.all_candidates.relations')"
ALL_CANDIDATE_EVIDENCE="$(read_manifest_value '.release.counts.all_candidates.evidence')"
CANDIDATE_ONLY_RELATIONS="$(read_manifest_value '.release.counts.candidate_only_delta.relations')"
CANDIDATE_ONLY_EVIDENCE="$(read_manifest_value '.release.counts.candidate_only_delta.evidence')"

if [[ -z "$OUTPUT_DIR" ]]; then
  OUTPUT_DIR="/tmp/mag7-live-positive-capture-$(date -u +%Y%m%dT%H%M%SZ)"
fi

mkdir -p "$OUTPUT_DIR" "$OUTPUT_DIR/logs"

ENTRY_PREFLIGHT_JSON="$OUTPUT_DIR/capture-entry-preflight.json"
ENTRY_SUMMARY_JSON="$OUTPUT_DIR/capture-entry-summary.json"
ENTRY_REPORT_MD="$OUTPUT_DIR/capture-entry-report.md"
ENTRY_INVOCATION_LOG="$OUTPUT_DIR/logs/capture-entry.log"

log() {
  printf '[%s] %s\n' "$(timestamp)" "$*" | tee -a "$ENTRY_INVOCATION_LOG" >&2
}

env_state() {
  local key="$1"
  if [[ -n "${!key:-}" ]]; then
    printf 'set'
  else
    printf 'missing'
  fi
}

OPTIONAL_ENV_KEYS_JSON="$(printf '%s\n' VITE_GRAPH_API_BASE_URL CORS_ORIGIN API_BASE HOST PORT | jq -R . | jq -s .)"
REQUIRED_ENV_KEYS_JSON="$(printf '%s\n' GRAPH_RUNTIME_MODE NEO4J_URI NEO4J_USERNAME NEO4J_PASSWORD NEO4J_DATABASE REDIS_URL | jq -R . | jq -s .)"

jq -n \
  --arg generatedAt "$(timestamp)" \
  --arg requestedMode "$MODE" \
  --arg envFile "${ENV_FILE:-}" \
  --arg defaultEnvFile "$DEFAULT_ENV_FILE" \
  --arg outputDir "$OUTPUT_DIR" \
  --arg authoritativeSnapshot "$AUTHORITATIVE_SNAPSHOT" \
  --arg packageShellSnapshot "$PACKAGE_SHELL_SNAPSHOT" \
  --arg publishedRelations "$PUBLISHED_RELATIONS" \
  --arg publishedEvidence "$PUBLISHED_EVIDENCE" \
  --arg allCandidateRelations "$ALL_CANDIDATE_RELATIONS" \
  --arg allCandidateEvidence "$ALL_CANDIDATE_EVIDENCE" \
  --arg candidateOnlyRelations "$CANDIDATE_ONLY_RELATIONS" \
  --arg candidateOnlyEvidence "$CANDIDATE_ONLY_EVIDENCE" \
  --arg graphRuntimeModeState "$(env_state GRAPH_RUNTIME_MODE)" \
  --arg neo4jUriState "$(env_state NEO4J_URI)" \
  --arg neo4jUsernameState "$(env_state NEO4J_USERNAME)" \
  --arg neo4jPasswordState "$(env_state NEO4J_PASSWORD)" \
  --arg neo4jDatabaseState "$(env_state NEO4J_DATABASE)" \
  --arg redisUrlState "$(env_state REDIS_URL)" \
  --arg viteGraphApiBaseUrlState "$(env_state VITE_GRAPH_API_BASE_URL)" \
  --arg corsOriginState "$(env_state CORS_ORIGIN)" \
  --arg apiBaseState "$(env_state API_BASE)" \
  --arg hostState "$(env_state HOST)" \
  --arg portState "$(env_state PORT)" \
  --argjson requiredEnvKeys "$REQUIRED_ENV_KEYS_JSON" \
  --argjson optionalEnvKeys "$OPTIONAL_ENV_KEYS_JSON" \
  '{
    schema: "wanman.live-positive-capture-preflight",
    version: 1,
    generatedAt: $generatedAt,
    requestedMode: $requestedMode,
    outputDir: $outputDir,
    envFile: (if $envFile == "" then null else $envFile end),
    defaultEnvFile: $defaultEnvFile,
    releaseBoundary: {
      authoritativeSnapshot: $authoritativeSnapshot,
      packageShellSnapshot: $packageShellSnapshot,
      published: {
        relations: ($publishedRelations | tonumber),
        evidence: ($publishedEvidence | tonumber)
      },
      allCandidates: {
        relations: ($allCandidateRelations | tonumber),
        evidence: ($allCandidateEvidence | tonumber)
      },
      candidateOnly: {
        relations: ($candidateOnlyRelations | tonumber),
        evidence: ($candidateOnlyEvidence | tonumber)
      }
    },
    envValidation: {
      requiredExternalVars: {
        GRAPH_RUNTIME_MODE: $graphRuntimeModeState,
        NEO4J_URI: $neo4jUriState,
        NEO4J_USERNAME: $neo4jUsernameState,
        NEO4J_PASSWORD: $neo4jPasswordState,
        NEO4J_DATABASE: $neo4jDatabaseState,
        REDIS_URL: $redisUrlState
      },
      optionalVars: {
        VITE_GRAPH_API_BASE_URL: $viteGraphApiBaseUrlState,
        CORS_ORIGIN: $corsOriginState,
        API_BASE: $apiBaseState,
        HOST: $hostState,
        PORT: $portState
      },
      requiredExternalKeys: $requiredEnvKeys,
      optionalKeys: $optionalEnvKeys,
      rules: [
        "只记录变量是否已注入，不回显任何 provider secret 或明文凭据",
        "external 模式至少需要 NEO4J_URI、NEO4J_USERNAME、NEO4J_PASSWORD、NEO4J_DATABASE、REDIS_URL",
        "GRAPH_RUNTIME_MODE 必须保持 live"
      ]
    }
  }' >"$ENTRY_PREFLIGHT_JSON"

RUNNER_ARGS=(--mode "$MODE" --output-dir "$OUTPUT_DIR")
if [[ "$KEEP_SERVICES" = "true" ]]; then
  RUNNER_ARGS+=(--keep-services)
fi

RUNNER_EXIT_CODE=0
log "执行底层取证脚本: bash $RUNNER ${RUNNER_ARGS[*]}"
bash "$RUNNER" "${RUNNER_ARGS[@]}" >>"$ENTRY_INVOCATION_LOG" 2>&1
RUNNER_EXIT_CODE=$?

RESULT_JSON="$OUTPUT_DIR/result.json"
IMPORT_SUMMARY_JSON="$OUTPUT_DIR/import-summary.json"
IMPORT_FAILURE_JSON="$OUTPUT_DIR/import-failure.json"
HTTP_SUMMARY_JSON="$OUTPUT_DIR/http-smoke-summary.json"
MIN_PREREQ_JSON="$OUTPUT_DIR/minimal-external-prerequisites.json"
BACKEND_LOG="$OUTPUT_DIR/logs/backend-live.log"

result_value() {
  local expr="$1"
  if [[ -f "$RESULT_JSON" ]]; then
    jq -r "$expr // empty" "$RESULT_JSON"
  fi
}

json_payload_state() {
  local path="$1"
  if [[ ! -f "$path" ]]; then
    printf 'missing'
    return 0
  fi

  if jq -e 'if type == "object" then length > 0 elif type == "array" then length > 0 else true end' "$path" >/dev/null 2>&1; then
    printf 'captured'
  else
    printf 'missing'
  fi
}

RESULT_PASSED="$(result_value '.passed')"
RESULT_STAGE="$(result_value '.stage')"
RESULT_MODE="$(result_value '.mode')"
FAILURE_CODE="$(result_value '.failure.code')"
FAILURE_MESSAGE="$(result_value '.failure.message')"
FAILURE_DETAIL="$(result_value '.failure.detail')"
if [[ -z "$RESULT_MODE" && -f "$OUTPUT_DIR/mode-selection.json" ]]; then
  RESULT_MODE="$(jq -r '.selectedMode // empty' "$OUTPUT_DIR/mode-selection.json")"
fi
if [[ -z "$RESULT_MODE" ]]; then
  RESULT_MODE="unknown"
fi
NEXT_ACTIONS_JSON='[]'
if [[ -f "$MIN_PREREQ_JSON" ]]; then
  NEXT_ACTIONS_JSON="$(jq -c '.required_to_unblock_real_data_launch // []' "$MIN_PREREQ_JSON")"
fi

http_file_state() {
  local name="$1"
  if [[ -f "$OUTPUT_DIR/http/$name.json" ]]; then
    printf 'captured'
  else
    printf 'missing'
  fi
}

jq -n \
  --arg generatedAt "$(timestamp)" \
  --arg requestedMode "$MODE" \
  --arg actualMode "${RESULT_MODE:-unknown}" \
  --arg resultStage "${RESULT_STAGE:-missing}" \
  --arg failureCode "${FAILURE_CODE:-}" \
  --arg failureMessage "${FAILURE_MESSAGE:-}" \
  --arg failureDetail "${FAILURE_DETAIL:-}" \
  --arg outputDir "$OUTPUT_DIR" \
  --arg authoritativeSnapshot "$AUTHORITATIVE_SNAPSHOT" \
  --arg publishedRelations "$PUBLISHED_RELATIONS" \
  --arg publishedEvidence "$PUBLISHED_EVIDENCE" \
  --arg allCandidateRelations "$ALL_CANDIDATE_RELATIONS" \
  --arg allCandidateEvidence "$ALL_CANDIDATE_EVIDENCE" \
  --arg candidateOnlyRelations "$CANDIDATE_ONLY_RELATIONS" \
  --arg candidateOnlyEvidence "$CANDIDATE_ONLY_EVIDENCE" \
  --arg importSummaryState "$(json_payload_state "$IMPORT_SUMMARY_JSON")" \
  --arg importFailureState "$(json_payload_state "$IMPORT_FAILURE_JSON")" \
  --arg healthState "$(http_file_state health)" \
  --arg detailState "$(http_file_state detail)" \
  --arg overviewState "$(http_file_state overview)" \
  --arg searchState "$(http_file_state search)" \
  --arg suggestState "$(http_file_state suggest)" \
  --arg subgraphState "$(http_file_state subgraph)" \
  --arg pathState "$(http_file_state path)" \
  --arg statsState "$(http_file_state stats)" \
  --arg evidenceState "$(http_file_state evidence)" \
  --arg candidateSubgraphState "$(http_file_state candidate-subgraph)" \
  --arg candidateEvidenceState "$(http_file_state candidate-evidence)" \
  --arg backendLogState "$(if [[ -f "$BACKEND_LOG" ]]; then echo captured; else echo missing; fi)" \
  --arg httpSummaryState "$(json_payload_state "$HTTP_SUMMARY_JSON")" \
  --argjson passed "$(if [[ "$RESULT_PASSED" = "true" ]]; then echo true; else echo false; fi)" \
  --argjson nextActions "$NEXT_ACTIONS_JSON" \
  '{
    schema: "wanman.live-positive-capture-summary",
    version: 1,
    generatedAt: $generatedAt,
    passed: $passed,
    requestedMode: $requestedMode,
    actualMode: $actualMode,
    resultStage: $resultStage,
    outputDir: $outputDir,
    releaseBoundary: {
      authoritativeSnapshot: $authoritativeSnapshot,
      published: {
        relations: ($publishedRelations | tonumber),
        evidence: ($publishedEvidence | tonumber)
      },
      allCandidates: {
        relations: ($allCandidateRelations | tonumber),
        evidence: ($allCandidateEvidence | tonumber)
      },
      candidateOnly: {
        relations: ($candidateOnlyRelations | tonumber),
        evidence: ($candidateOnlyEvidence | tonumber)
      }
    },
    captureState: {
      importSummary: $importSummaryState,
      importFailure: $importFailureState,
      httpSmokeSummary: $httpSummaryState,
      backendLog: $backendLogState,
      httpSamples: {
        health: $healthState,
        detail: $detailState,
        overview: $overviewState,
        search: $searchState,
        suggest: $suggestState,
        subgraph: $subgraphState,
        path: $pathState,
        stats: $statsState,
        evidence: $evidenceState
      },
      candidateShellChecks: {
        candidateSubgraph: $candidateSubgraphState,
        candidateEvidence: $candidateEvidenceState
      }
    },
    failure: (if $failureCode == "" then null else {
      code: $failureCode,
      message: $failureMessage,
      detail: $failureDetail
    } end),
    nextActions: $nextActions
  }' >"$ENTRY_SUMMARY_JSON"

PASS_LABEL="失败"
if [[ "$RESULT_PASSED" = "true" ]]; then
  PASS_LABEL="通过"
fi

cat >"$ENTRY_REPORT_MD" <<EOF
# Mag7 full.21 正向闭环预检/取证摘要

## 1. 结论

- 执行时间：$(timestamp)
- 请求模式：\`$MODE\`
- 实际模式：\`${RESULT_MODE:-unknown}\`
- 结果：\`$PASS_LABEL\`
- 阶段：\`${RESULT_STAGE:-missing}\`
- authoritative snapshot：\`$AUTHORITATIVE_SNAPSHOT\`
- published：\`${PUBLISHED_RELATIONS}/${PUBLISHED_EVIDENCE}\`
- all-candidates：\`${ALL_CANDIDATE_RELATIONS}/${ALL_CANDIDATE_EVIDENCE}\`
- candidate-only：\`${CANDIDATE_ONLY_RELATIONS}/${CANDIDATE_ONLY_EVIDENCE}\`
- 输出目录：\`$OUTPUT_DIR\`

## 2. 环境变量预检

- 结构化预检：\`capture-entry-preflight.json\`
- 只记录变量是否已注入，不回显 \`NEO4J_PASSWORD\`、\`REDIS_URL\` 等 provider secret。
- external 模式必需：\`GRAPH_RUNTIME_MODE\`、\`NEO4J_URI\`、\`NEO4J_USERNAME\`、\`NEO4J_PASSWORD\`、\`NEO4J_DATABASE\`、\`REDIS_URL\`
- 当前推荐样例：\`infra/deployment/live-acceptance.env.example\`

## 3. 取证文件

- 导入结果：$(if [[ "$(json_payload_state "$IMPORT_SUMMARY_JSON")" = "captured" ]]; then echo '\`import-summary.json\` 已捕获'; else echo '\`import-summary.json\` 未捕获'; fi)
- 导入失败兜底：$(if [[ "$(json_payload_state "$IMPORT_FAILURE_JSON")" = "captured" ]]; then echo '\`import-failure.json\` 已捕获'; else echo '\`import-failure.json\` 未捕获'; fi)
- HTTP 样本：
  - \`health\`：$(http_file_state health)
  - \`detail\`：$(http_file_state detail)
  - \`overview\`：$(http_file_state overview)
  - \`search\`：$(http_file_state search)
  - \`suggest\`：$(http_file_state suggest)
  - \`subgraph\`：$(http_file_state subgraph)
  - \`path\`：$(http_file_state path)
  - \`stats\`：$(http_file_state stats)
  - \`evidence\`：$(http_file_state evidence)
- candidate shell 隔离补充：
  - \`candidate-subgraph\`：$(http_file_state candidate-subgraph)
  - \`candidate-evidence\`：$(http_file_state candidate-evidence)
- 日志：
  - \`logs/capture-entry.log\`
  - \`logs/backend-live.log\`：$(if [[ -f "$BACKEND_LOG" ]]; then echo 'captured'; else echo 'missing'; fi)
  - 底层执行器日志与 docker 日志仍由 \`live-acceptance-commands.sh\` 统一落盘

## 4. 失败回退口径

- 任一步失败都必须保留 \`output-dir\`，不得删除已采集的 \`result.json\`、\`preflight.json\`、\`bringup.json\`、\`http/*.json\`、\`logs/*\`。
- 不得把 \`335/448\` 或 \`3/4\` 写成 published。
- 不得把 failure fallback 叙述成 prototype/mock 成功。
- 若失败，请优先查看：\`result.json\`、\`capture-entry-summary.json\`、\`minimal-external-prerequisites.json\`、\`logs/import.stderr.log\`、\`logs/backend-live.log\`。

## 5. 推荐复跑命令

\`\`\`bash
cd /workspace/project/mag7-supply-chain
set -a
source infra/deployment/live-acceptance.env.example
set +a
bash infra/deployment/live-positive-capture.sh --mode ${MODE} --output-dir "$OUTPUT_DIR"
\`\`\`
EOF

log "取证摘要已生成: $ENTRY_REPORT_MD"
log "结构化索引已生成: $ENTRY_SUMMARY_JSON"

if [[ "$RUNNER_EXIT_CODE" -ne 0 ]]; then
  log "底层执行器失败，保留输出目录供人工继续取证。"
  exit "$RUNNER_EXIT_CODE"
fi

exit 0
