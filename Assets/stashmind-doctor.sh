#!/usr/bin/env bash
# stashmind-doctor.sh v3.0 (Appwrite edition)
# Independent stability and ground-truth check for the StashMind repo.
# It does not trust any agent's report: it runs real commands and prints real results.
#
#   bash stashmind-doctor.sh                 check only, changes nothing
#   bash stashmind-doctor.sh --fix           also applies the safe fixes marked [FIXED]
#   bash stashmind-doctor.sh --boot          also boots the dev server and probes the API
#   bash stashmind-doctor.sh --fix --boot
#
# Optional environment variables for live checks (never printed):
#   GEMINI_API_KEY                                   verifies configured model IDs against Google's live model list
#   APPWRITE_ENDPOINT APPWRITE_PROJECT_ID APPWRITE_API_KEY APPWRITE_DATABASE_ID
#                                                    verifies the live Appwrite tables exist
# Never commits, pushes or force-pushes. Report saved in .doctor/. Exit code 1 if any FAIL.

FIX=0; BOOT=0
for a in "$@"; do
  case "$a" in
    --fix) FIX=1 ;;
    --boot) BOOT=1 ;;
    -h|--help) sed -n '2,15p' "$0"; exit 0 ;;
  esac
done

PASS=0; WARN=0; FAILN=0; FIXES=0
mkdir -p .doctor
REPORT=".doctor/report-$(date +%Y%m%d-%H%M%S).txt"
say()   { echo "$*" | tee -a "$REPORT"; }
ok()    { PASS=$((PASS+1));   say "[PASS]  $*"; }
warn()  { WARN=$((WARN+1));   say "[WARN]  $*"; }
bad()   { FAILN=$((FAILN+1)); say "[FAIL]  $*"; }
fixed() { FIXES=$((FIXES+1)); say "[FIXED] $*"; }
info()  { say "        $*"; }
sect()  { say ""; say "=== $* ==="; }
need()  { command -v "$1" >/dev/null 2>&1; }
# level T0 fails when missing, T1 warns
lvl_bad() { if [ "$1" = T0 ]; then bad "$2"; else warn "$2"; fi; }

# probe LEVEL present|absent LABEL REGEX PATHS...  (searches tracked and untracked files)
probe() {
  local lvl=$1 mode=$2 label=$3 rx=$4; shift 4
  local found=0
  git grep --untracked -qE "$rx" -- "$@" 2>/dev/null && found=1
  if [ "$mode" = present ]; then
    if [ $found -eq 1 ]; then ok "[$lvl] $label"; else lvl_bad "$lvl" "[$lvl] $label (not found)"; fi
  else
    if [ $found -eq 0 ]; then ok "[$lvl] $label"; else lvl_bad "$lvl" "[$lvl] $label (still present)"; fi
  fi
}
pkg_has() { grep -qE "\"$1\"" package.json 2>/dev/null; }
has_script() { node -e "process.exit(((require('./package.json').scripts)||{})['$1']?0:1)" 2>/dev/null; }
run_gate() { # name command
  local name=$1; shift
  if need timeout; then timeout 420 bash -c "$*" > ".doctor/$name.log" 2>&1; else bash -c "$*" > ".doctor/$name.log" 2>&1; fi
  local rc=$?
  if [ $rc -eq 0 ]; then ok "gate $name passed"; else bad "gate $name failed (exit $rc), see .doctor/$name.log"; tail -n 12 ".doctor/$name.log" | sed 's/^/        | /' | tee -a "$REPORT" >/dev/null; fi
  return $rc
}

say "StashMind doctor v3.0  $(date)"
say "fix=$FIX boot=$BOOT"

sect "0. Tools and environment"
for t in git node npm curl; do need $t && ok "tool present: $t" || bad "missing tool: $t"; done
need jq && ok "tool present: jq" || warn "jq not installed (optional; some JSON checks are reduced)"
need docker && ok "docker present (needed for a local Appwrite test stack)" || warn "docker not found (live Appwrite tests need Appwrite Cloud test project or local docker)"
NODE_MAJOR=$(node -v 2>/dev/null | sed 's/v//' | cut -d. -f1)
if [ -n "$NODE_MAJOR" ] && [ "$NODE_MAJOR" -ge 20 ] 2>/dev/null; then ok "node major version $NODE_MAJOR (>= 20)"; else bad "node 20 or newer required (found: ${NODE_MAJOR:-none})"; fi

sect "1. Repository state"
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then bad "not inside a git repo"; exit 1; fi
if [ ! -f package.json ]; then bad "package.json not found: run this from the repo root"; exit 1; fi
BRANCH=$(git rev-parse --abbrev-ref HEAD); info "branch: $BRANCH"
git remote get-url origin >/dev/null 2>&1 && ok "remote origin set: $(git remote get-url origin)" || warn "no remote named origin"
git fetch --quiet origin 2>/dev/null
UP=$(git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null)
if [ -n "$UP" ]; then
  AB=$(git rev-list --left-right --count HEAD...$UP 2>/dev/null); AHEAD=$(echo $AB | cut -d' ' -f1); BEHIND=$(echo $AB | cut -d' ' -f2)
  [ "$AHEAD" = 0 ] && ok "no unpushed commits" || warn "$AHEAD commit(s) not pushed yet"
  if [ "$BEHIND" != 0 ]; then warn "$BEHIND commit(s) on remote you do not have. Run: git pull --rebase. Do NOT force-push."; fi
else warn "branch has no upstream"; fi
DIRTY=$(git status --porcelain | grep -v '[.]doctor/' | wc -l)
[ "$DIRTY" = 0 ] && ok "working tree clean" || warn "$DIRTY uncommitted change(s)"
TOTAL=$(git rev-list --count HEAD); LAYERS=$(git log --format=%s | grep -cE '^[a-z]+[(]layer-[A-Za-z0-9]+')
info "commits: $TOTAL, layer-style commits: $LAYERS"
BAD_MSG=$(git log -30 --format=%s | grep -vcE '^(feat|fix|chore|docs|test|refactor|build|ci|perf)([(][^)]+[)])?!?: ')
[ "$BAD_MSG" = 0 ] && ok "last 30 commits follow type(scope): subject" || warn "$BAD_MSG of the last 30 commits do not follow type(scope): subject"
BIG=$(git log -30 --format=%H | while read h; do n=$(git show --name-only --format= $h | grep -c .); [ "$n" -gt 60 ] && echo $h; done | wc -l)
[ "$BIG" = 0 ] && ok "no oversized commits (>60 files) in last 30" || warn "$BIG commit(s) touch more than 60 files: layers may be mixed together"

sect "2. Package hygiene"
NAME=$(node -p "require('./package.json').name" 2>/dev/null); info "package name: $NAME"
if [ "$NAME" = react-example ]; then
  if [ $FIX -eq 1 ]; then npm pkg set name=stashmind >/dev/null 2>&1 && fixed "package name set to stashmind"; else warn "package name is the AI Studio default 'react-example'"; fi
else ok "package name set"; fi
LOCKS=0; for f in package-lock.json bun.lock bun.lockb yarn.lock pnpm-lock.yaml; do [ -f $f ] && { LOCKS=$((LOCKS+1)); info "lockfile: $f"; }; done
if [ $LOCKS -eq 0 ]; then warn "no lockfile (npm ci cannot work); the install step will generate package-lock.json"
elif [ $LOCKS -gt 1 ]; then warn "more than one lockfile; keep exactly one (recommended: package-lock.json) and record it in an ADR"
else ok "exactly one lockfile"; fi
for s in dev build test lint; do has_script $s && ok "script present: $s" || bad "script missing: $s"; done
for s in verify test:live; do has_script $s && ok "script present: $s" || warn "script missing: $s (verify = typecheck+lint+test+build; test:live = opt-in live Appwrite/Gemini tests)"; done
LINT=$(node -p "((require('./package.json').scripts)||{}).lint||''" 2>/dev/null)
case "$LINT" in "tsc --noEmit"|"tsc --noEmit "*) warn "lint script is only a typecheck ($LINT); add a real linter (eslint)";; esac
if [ ! -f .nvmrc ] && [ ! -f .node-version ]; then
  if [ $FIX -eq 1 ] && [ -n "$NODE_MAJOR" ]; then echo $NODE_MAJOR > .nvmrc && fixed ".nvmrc created ($NODE_MAJOR)"; else warn "no .nvmrc / .node-version"; fi
else ok "node version pinned"; fi

sect "3. Install and gates"
NEED_INSTALL=0; [ -d node_modules ] || NEED_INSTALL=1; [ -x node_modules/.bin/tsc ] || NEED_INSTALL=1
if [ $NEED_INSTALL -eq 1 ] || [ $LOCKS -eq 0 ]; then
  info "running npm install (log: .doctor/install.log)"
  npm install --no-audit --no-fund > .doctor/install.log 2>&1; RC=$?
  if [ $RC -ne 0 ] && grep -q ERESOLVE .doctor/install.log; then
    warn "dependency conflict (ERESOLVE)"
    if [ $FIX -eq 1 ] && pkg_has esbuild; then
      npm pkg set devDependencies.esbuild='^0.28.0' >/dev/null 2>&1 && fixed "esbuild devDependency set to ^0.28.0 to satisfy vite's peer range"
      npm install --no-audit --no-fund > .doctor/install.log 2>&1; RC=$?
    else info "re-run with --fix to try the esbuild peer fix. Never use --force."; fi
  fi
  [ $RC -eq 0 ] && ok "npm install succeeded" || bad "npm install failed, see .doctor/install.log (do not use --force)"
else ok "dependencies already installed"; fi
INSTALL_OK=0; [ -x node_modules/.bin/tsc ] && INSTALL_OK=1
if [ $INSTALL_OK -eq 1 ]; then
  run_gate typecheck 'npx tsc --noEmit'
  has_script lint && run_gate lint 'npm run lint --silent'
  has_script test && run_gate test 'npm test'
  has_script build && run_gate build 'npm run build'
  TESTS=$(grep -rEho '(^|[^a-zA-Z_])(it|test)(\.each)?[(]' tests src 2>/dev/null | wc -l)
  info "test cases found by static count: $TESTS (Opencode's reported baseline was 26; new Tier 0/1 behaviour should add more)"
  SKIPS=$(grep -rEho '(it|test|describe)[.](skip|todo)' tests src 2>/dev/null | wc -l); [ "$SKIPS" = 0 ] && ok "no skipped tests" || warn "$SKIPS skipped/todo tests"
else warn "gates skipped: install did not complete"; fi
probe T0 absent "tests do not bypass the AI client (no FAST_FAIL / dummy key / isTestEnvironment fallback)" 'FAST_FAIL_TEST_MODE|dummy-key|isTestEnvironment' src server.ts

sect "4. Secrets, environment and models"
if [ -f .gitignore ] && grep -qE '^[.]env' .gitignore; then ok ".env is gitignored"; else
  if [ $FIX -eq 1 ]; then printf '.env\n.env.*\n!.env.example\n.doctor/\nnode_modules\ndist\n' >> .gitignore && fixed ".gitignore updated"; else bad ".env is not gitignored"; fi; fi
TRACKED_ENV=$(git ls-files | grep -E '^[.]env($|[.])' | grep -v example | wc -l)
[ "$TRACKED_ENV" = 0 ] && ok "no real .env file is tracked" || bad "$TRACKED_ENV .env file(s) tracked by git"
SECRETS=$(git grep -nE 'AIza[0-9A-Za-z_-]{30,}|sk-[A-Za-z0-9]{30,}|eyJ[A-Za-z0-9_-]{40,}[.][A-Za-z0-9_-]{20,}|standard_[a-f0-9]{100,}' -- . ':!package-lock.json' ':!.env.example' 2>/dev/null | wc -l)
[ "$SECRETS" = 0 ] && ok "no secret-shaped strings in tracked files" || bad "$SECRETS secret-shaped string(s) in tracked files (rotate them!)"
HIST=$(git log --all -p -S'AIza' --format=%h 2>/dev/null | head -c 20 | wc -c); [ "$HIST" = 0 ] && ok "no Google key prefix in git history" || bad "Google key prefix found in git history: rotate the key"
USED=$(git grep -hoE 'process[.]env[.][A-Z][A-Z0-9_]+' -- src server.ts 2>/dev/null | sed 's/process.env.//' | sort -u)
MISSING=""; for v in $USED; do grep -qE "^$v=" .env.example 2>/dev/null || MISSING="$MISSING $v"; done
if [ -z "$MISSING" ]; then ok "every env var used in code is documented in .env.example"; else
  warn "env vars used but missing from .env.example:$MISSING"
  if [ $FIX -eq 1 ]; then for v in $MISSING; do echo "$v=" >> .env.example; done; fixed "added blank entries to .env.example"; fi; fi
probe T0 absent "no retired Gemini models (1.5 / 2.0) in code" 'gemini-1[.]5|gemini-2[.]0' src server.ts tests
probe T0 absent "no Gemini 2.5 models in code (scheduled for shutdown on 16 Oct 2026)" 'gemini-2[.]5' src server.ts tests
MODEL_FILES=$(git grep --untracked -lE "gemini-[0-9a-z.-]+" -- src server.ts tests 2>/dev/null)
NMF=$(echo "$MODEL_FILES" | grep -c .)
if [ "$NMF" -le 1 ]; then ok "model IDs confined to at most one file"; else warn "model IDs hard-coded in $NMF files (should live in one config module):"; echo "$MODEL_FILES" | sed 's/^/        /' | tee -a "$REPORT" >/dev/null; fi
if [ -n "$GEMINI_API_KEY" ]; then
  LIVE=$(curl -s -H "x-goog-api-key: $GEMINI_API_KEY" 'https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000')
  if echo "$LIVE" | grep -q '"models"'; then
    for id in $(git grep --untracked -hoE "gemini-[0-9a-z.-]+" -- src server.ts 2>/dev/null | sort -u); do
      echo "$LIVE" | grep -q "models/$id\"" && ok "model exists on live list: $id" || bad "model NOT on Google's live list: $id"
    done
  else warn "could not read Google's model list (check GEMINI_API_KEY)"; fi
else warn "GEMINI_API_KEY not set: model IDs not verified against Google's live list"; fi

sect "5. Appwrite integration"
pkg_has node-appwrite && ok "node-appwrite (server SDK) installed" || bad "node-appwrite not in package.json"
pkg_has appwrite && ok "appwrite (web SDK) installed" || warn "appwrite web SDK not in package.json (needed for client login/realtime)"
LEFT=$(git grep --untracked -liE '@supabase|createClient[(].*supabase|SUPABASE_' -- src server.ts package.json .env.example 2>/dev/null | wc -l)
[ "$LEFT" = 0 ] && ok "no Supabase code or config left" || bad "$LEFT file(s) still reference Supabase"
DOCLEFT=$(git grep --untracked -liE 'supabase|row level security|\bRLS\b|postgres' -- README.md AGENTS.md CONSTITUTION.md docs 2>/dev/null | grep -v 'docs/archive' | wc -l)
[ "$DOCLEFT" = 0 ] && ok "docs no longer describe Supabase/RLS" || warn "$DOCLEFT doc file(s) still mention Supabase/RLS/Postgres (outside docs/archive)"
[ -f appwrite.config.json ] || [ -f appwrite.json ] && ok "Appwrite schema config file present" || bad "no appwrite.config.json: schema is not reproducible from git"
CFG=appwrite.config.json; [ -f $CFG ] || CFG=appwrite.json
for t in profiles sources lessons cards saved_cards practice_sessions activity_log streaks usage_counters api_keys webhooks webhook_deliveries audit_log jobs payments subscriptions telegram_links card_feedback ask_threads; do
  if [ -f $CFG ] && grep -q "\"$t\"" $CFG; then :; else info "table not in config: $t"; MISSTAB=1; fi
done
[ -z "$MISSTAB" ] && ok "all expected tables are declared in the Appwrite config" || warn "some expected tables are not declared (listed above; adjust names if you chose different ones)"
if [ -f $CFG ]; then
  FALSE_RS=$(grep -cE '"rowSecurity" *: *false' $CFG); [ "$FALSE_RS" = 0 ] && ok "no table has row security switched off" || bad "$FALSE_RS table(s) have rowSecurity false"
  ANYP=$(grep -cE 'any[(][)]|"any"' $CFG); [ "$ANYP" = 0 ] && ok "no 'any' role permissions in config" || warn "$ANYP 'any' role permission(s): confirm each is intentionally public"
fi
if [ -n "$APPWRITE_ENDPOINT" ] && [ -n "$APPWRITE_PROJECT_ID" ] && [ -n "$APPWRITE_API_KEY" ] && [ -n "$APPWRITE_DATABASE_ID" ]; then
  CODE=$(curl -s -o .doctor/appwrite-tables.json -w '%{http_code}' -H "X-Appwrite-Project: $APPWRITE_PROJECT_ID" -H "X-Appwrite-Key: $APPWRITE_API_KEY" "$APPWRITE_ENDPOINT/tablesdb/$APPWRITE_DATABASE_ID/tables?limit=100")
  if [ "$CODE" = 200 ]; then
    ok "live Appwrite reachable and database readable"
    for t in profiles sources lessons cards saved_cards practice_sessions streaks usage_counters api_keys webhooks audit_log jobs; do
      grep -q "\"$t\"" .doctor/appwrite-tables.json && ok "live table exists: $t" || bad "live table missing: $t (run the provisioning script)"
    done
  else warn "live Appwrite check returned HTTP $CODE (check endpoint, project, key scopes)"; fi
else warn "APPWRITE_* variables not set: live schema not checked"; fi
probe T0 absent "no custom password/JWT auth code (use Appwrite Auth)" 'jsonwebtoken|JWT_ACCESS_SECRET|bcrypt|argon2' src server.ts
probe T0 absent "no hard-coded demo user" 'user_student_demo|DEMO_USER' src server.ts
probe T0 present "server verifies the caller's Appwrite JWT/session" 'setJWT|setSession|account[.]get|createJWT' src server.ts
probe T0 present "Appwrite repository implementation exists" 'TablesDB|tablesDB' src server.ts
probe T0 present "Appwrite Storage used for audio/uploads" 'Storage[(]|storage[.]createFile|createFile[(]' src server.ts
probe T0 present "production refuses to run on an in-memory store" 'production' src/db src/config src/server.ts server.ts
MAPN=$(git grep --untracked -nE 'new Map[<(]' -- 'src/db/*' 'src/repository*' 2>/dev/null | wc -l); [ "$MAPN" = 0 ] && ok "no in-memory Map in the data layer" || info "in-memory Map code in data layer ($MAPN lines): acceptable only as a test-only repository"

sect "6. Tier 0 and Tier 1 feature probes"
probe T0 present "SSRF guard resolves DNS" 'dns[.]promises|dns/promises|dns[.]lookup' src
probe T0 present "webhooks make real HTTP requests" 'fetch[(]' src/services/webhooks.ts
probe T0 absent "webhooks are not simulated" 'simulat' src/services/webhooks.ts
probe T0 present "real PDF parser dependency" '"(pdf-parse|pdfjs-dist|unpdf|pdf2json)"' package.json
probe T0 absent "YouTube ingestion is not a hard-coded template" '[[]00:00[]] Introduction' src
probe T0 present "device TTS calls the browser speech API" 'speechSynthesis' src
probe T0 present "voice practice uses Live API or speech recognition" 'live[.]connect|sendRealtimeInput|SpeechRecognition' src
probe T0 present "model IDs verified or listed at startup" 'models[.]list|listModels|/v1beta/models' src server.ts
probe T0 present "persistent kill switch / spend cap" 'kill_switch|KILL_SWITCH|daily_cap|spend_cap' src server.ts
probe T0 present "readiness endpoint" '/ready' src server.ts
probe T1 present "M-Pesa Daraja STK push" 'stkpush|stk_push|STKPush|daraja' src
probe T1 present "Telegram bot integration" 'telegram' src package.json
probe T1 present "data-saver / low bitrate audio mode" 'data.?saver|opus|low.?bandwidth' src
probe T1 present "PWA service worker" 'serviceWorker[.]register|registerSW|vite-plugin-pwa' src vite.config.ts index.html
[ -f public/manifest.webmanifest ] || [ -f public/manifest.json ] && ok "[T1] PWA manifest present" || warn "[T1] PWA manifest missing"
probe T1 present "ask-the-source endpoint with citations" '/ask|citation' src server.ts
probe T1 present "card ratings / edits" 'card_feedback|cardFeedback|thumbs' src
probe T1 present "quiz and Anki export" 'anki' src
probe T1 present "Swahili support" 'sw-KE|Swahili|"sw"' src
ARIA=$(git grep --untracked -hoE 'aria-[a-z]+' -- src 2>/dev/null | wc -l); [ "$ARIA" -ge 25 ] && ok "[T1] accessibility attributes present ($ARIA)" || warn "[T1] only $ARIA aria-* attributes in src (accessibility likely incomplete)"

sect "7. Documentation and handoff readiness"
for f in AGENTS.md CONSTITUTION.md BUILD_STATE.md .env.example README.md docs/adr docs/sprints docs/evals docs/runbooks docs/launch/LAUNCH_CHECKLIST.md audit/matrix.json audit/GAP_BACKLOG.md; do
  [ -e $f ] && ok "present: $f" || warn "missing: $f"; done
ls docs/adr 2>/dev/null | grep -qi appwrite && ok "ADR for the Appwrite decision exists" || warn "no ADR mentions Appwrite (write one that supersedes the Supabase decision)"
if [ -f audit/matrix.json ]; then
  node -e "JSON.parse(require('fs').readFileSync('audit/matrix.json','utf8'))" 2>/dev/null && ok "audit/matrix.json is valid JSON" || bad "audit/matrix.json is not valid JSON"
  need jq && info "matrix status counts: $(jq -r '[..|.status? // empty] | group_by(.) | map(.[0]+"="+(length|tostring)) | join(" ")' audit/matrix.json 2>/dev/null)"
fi
CLAIMS=$(git grep --untracked -liE '100% (complete|verified)|fully complete|all (work|phases|layers) (is |are )?complete|production.ready' -- README.md BUILD_STATE.md AGENTS.md docs 2>/dev/null | wc -l)
[ "$CLAIMS" = 0 ] && ok "no completion claims in docs" || warn "$CLAIMS doc file(s) contain completion/production-ready claims: check them against audit/matrix.json"
has_script start && ok "start script present" || warn "no start script for production"
[ -f Dockerfile ] && ok "Dockerfile present" || warn "no Dockerfile"
[ -f .github/workflows/ci.yml ] || ls .github/workflows/*.yml >/dev/null 2>&1 && ok "CI workflow present" || warn "no GitHub Actions workflow"

if [ $BOOT -eq 1 ] && [ $INSTALL_OK -eq 1 ]; then
  sect "8. Boot and API probes"
  PORT=${PORT:-3000}
  if has_script start && [ -d dist ]; then
    ( env -u APPWRITE_API_KEY -u APPWRITE_ENDPOINT -u APPWRITE_PROJECT_ID -u GEMINI_API_KEY NODE_ENV=production npm start > .doctor/prod-guard.log 2>&1 & echo $! > .doctor/prod.pid )
    sleep 8
    if kill -0 $(cat .doctor/prod.pid) 2>/dev/null; then bad "production started WITHOUT Appwrite/Gemini configuration (must fail closed)"; kill $(cat .doctor/prod.pid) 2>/dev/null; pkill -P $(cat .doctor/prod.pid) 2>/dev/null
    else ok "production refuses to start without required configuration"; fi
  else info "skipping production guard test (needs a start script and a built dist/)"; fi
  if curl -s -o /dev/null http://localhost:$PORT/ 2>/dev/null; then warn "port $PORT already in use; skipping dev boot"
  else
    if need setsid; then setsid npm run dev > .doctor/dev.log 2>&1 & else npm run dev > .doctor/dev.log 2>&1 & fi
    DEVPID=$!; UPOK=0
    for i in $(seq 1 40); do curl -sf http://localhost:$PORT/api/v1/health >/dev/null 2>&1 && { UPOK=1; break; }; sleep 1; done
    if [ $UPOK -eq 1 ]; then
      ok "dev server healthy on :$PORT"
      curl -s http://localhost:$PORT/api/v1/openapi.json | grep -qE '"openapi" *: *"3[.]1' && ok "OpenAPI 3.1 served" || bad "OpenAPI 3.1 not served"
      NT=$(curl -s -X POST http://localhost:$PORT/api/v1/mcp -H 'Content-Type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | grep -o '"name"' | wc -l)
      [ "$NT" -ge 11 ] && ok "MCP lists $NT tools" || warn "MCP lists only $NT tool entries (expected 11 or more)"
      C1=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:$PORT/api/v1/me)
      case $C1 in 401|403) ok "unauthenticated /api/v1/me is rejected ($C1)";; 200) bad "unauthenticated /api/v1/me returned 200 (demo-user bypass)";; *) warn "/api/v1/me returned $C1";; esac
      C2=$(curl -s -o /dev/null -w '%{http_code}' -X POST http://localhost:$PORT/api/v1/lessons -H 'Content-Type: application/json' -d '{}')
      case $C2 in 401|403) ok "unauthenticated lesson creation is rejected ($C2)";; 2*) bad "unauthenticated lesson creation accepted ($C2)";; *) warn "lesson creation returned $C2 without auth";; esac
      curl -sI http://localhost:$PORT/api/v1/health | grep -qi 'x-content-type-options' && ok "security headers present" || warn "security headers missing (helmet or equivalent)"
      C3=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:$PORT/ready); [ "$C3" = 200 ] && ok "/ready returns 200" || warn "/ready returned $C3"
    else bad "dev server did not become healthy in 40s, see .doctor/dev.log"; tail -n 12 .doctor/dev.log | sed 's/^/        | /' | tee -a "$REPORT" >/dev/null; fi
    kill -TERM -$DEVPID 2>/dev/null || kill $DEVPID 2>/dev/null; pkill -P $DEVPID 2>/dev/null
  fi
fi

sect "SUMMARY"
say "PASS=$PASS  WARN=$WARN  FAIL=$FAILN  FIXED=$FIXES"
say "Report: $REPORT"
if [ $FIXES -gt 0 ]; then say "Fixes changed files. Review with git diff, then commit them as their own layer, for example:"; say "  git add -A && git commit -m 'chore(layer-C01-hygiene): apply doctor safe fixes'"; fi
say "Reminder: if the remote is ahead, use git pull --rebase. Never git push -f."
[ $FAILN -gt 0 ] && exit 1
exit 0
