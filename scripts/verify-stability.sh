#!/usr/bin/env bash
# StashMind Stability Verification Script
# Runs prerequisite checks before any Tier 0 / Tier 1 execution.
# Modeled on Software-Factory verify-*.sh and Daftari verify-*.sh patterns.
# Fail closed: any non-zero check aborts with exit code 1.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

FAILURES=0
PASS_COUNT=0

pass() { echo "  [PASS] $1"; PASS_COUNT=$((PASS_COUNT + 1)); }
fail() { echo "  [FAIL] $1"; FAILURES=$((FAILURES + 1)); }

echo "================================================"
echo " StashMind Stability Verification"
echo " Root: $ROOT_DIR"
echo "================================================"

# --- 1. Runtime prerequisites ---
echo ""
echo "--- [1] Runtime prerequisites ---"

if command -v node >/dev/null 2>&1; then
  NODE_VERSION=$(node --version)
  pass "Node.js installed: $NODE_VERSION"
else
  fail "Node.js not found on PATH"
fi

if command -v npm >/dev/null 2>&1; then
  NPM_VERSION=$(npm --version)
  pass "npm installed: $NPM_VERSION"
else
  fail "npm not found on PATH"
fi

# --- 2. Dependency integrity ---
echo ""
echo "--- [2] Dependency integrity (package.json) ---"

if [ -f package.json ]; then
  pass "package.json present"
else
  fail "package.json missing"
fi

# Check for known fake/nonexistent dependency versions
FAKE_VERSIONS=$(grep -E '"vite": "\^8\.' package.json 2>/dev/null || true)
FAKE_VERSIONS="$FAKE_VERSIONS$(grep -E '"@vitejs/plugin-react": "\^6\.' package.json 2>/dev/null || true)"
FAKE_VERSIONS="$FAKE_VERSIONS$(grep -E '"typescript": "\^7\.' package.json 2>/dev/null || true)"
FAKE_VERSIONS=$(echo "$FAKE_VERSIONS" | grep -v '^$' || true)
if [ -z "$FAKE_VERSIONS" ]; then
  pass "No fake/nonexistent major dependency versions detected"
else
  fail "Fake dependency versions found (vite@8, plugin-react@6, typescript@7 do not exist): $FAKE_VERSIONS"
fi

# --- 3. Installability ---
echo ""
echo "--- [3] Installability ---"

if [ -d node_modules ]; then
  pass "node_modules present"
else
  fail "node_modules missing — run npm install"
fi

if npm install --no-audit --no-fund 2>/dev/null; then
  pass "npm install succeeds (clean install)"
else
  fail "npm install fails — dependency versions need fixing"
fi

# --- 4. Typecheck ---
echo ""
echo "--- [4] TypeScript strict typecheck ---"

if npm run typecheck >/dev/null 2>&1; then
  pass "TypeScript strict typecheck passes (tsc --noEmit)"
else
  fail "TypeScript typecheck fails — run npm run typecheck to see errors"
fi

# --- 5. Test suite ---
echo ""
echo "--- [5] Unit + integration test suite ---"

if npm run test >/dev/null 2>&1; then
  pass "All Vitest tests pass"
else
  fail "Vitest tests fail — run npm run test to see failures"
fi

# --- 6. Environment configuration ---
echo ""
echo "--- [6] Environment configuration ---"

if [ -f .env ]; then
  pass ".env file present (secrets are local, gitignored)"
else
  if [ -f .env.example ]; then
    fail ".env missing — copy .env.example to .env and fill in secrets"
  else
    fail ".env and .env.example both missing"
  fi
fi

# Check .env is gitignored
if git check-ignore .env >/dev/null 2>&1; then
  pass ".env is gitignored (secrets won't reach GitHub)"
else
  fail ".env is NOT gitignored — secret leakage risk"
fi

# --- 7. Model ID centralization (AGENTS.md rule) ---
echo ""
echo "--- [7] Model ID centralization (no hardcoded models) ---"

CONFIG_MODELS_FILE="src/config/index.ts"
if [ -f "$CONFIG_MODELS_FILE" ]; then
  pass "Central config module exists: $CONFIG_MODELS_FILE"
else
  fail "Central config module missing: $CONFIG_MODELS_FILE"
fi

# Search for hardcoded model ID strings outside config
HARDCODED=$(grep -rn "gemini-3\.8\|gemini-4\|gemini-1\.5\|gemini-2\.0" --include="*.ts" --include="*.tsx" src/ 2>/dev/null | grep -v "src/config/index.ts" || true)
if [ -z "$HARDCODED" ]; then
  pass "No hardcoded model IDs outside src/config/index.ts"
else
  fail "Hardcoded model IDs found outside config: $HARDCODED"
fi

# --- 8. Server-side AI & secrets boundary ---
echo ""
echo "--- [8] Server-side AI & secrets boundary ---"

# @google/genai must NOT be imported on the client
CLIENT_GENAI=$(grep -rn "@google/genai" --include="*.tsx" --include="*.ts" src/App.tsx src/main.tsx 2>/dev/null || true)
if [ -z "$CLIENT_GENAI" ]; then
  pass "No @google/genai imports in client bundle"
else
  fail "@google/genai imported in client code — security violation"
fi

# Secrets must not reach client
CLIENT_SECRETS=$(grep -rn "GEMINI_API_KEY\|SUPABASE_SERVICE_ROLE_KEY" --include="*.tsx" --include="*.ts" src/App.tsx src/main.tsx 2>/dev/null || true)
if [ -z "$CLIENT_SECRETS" ]; then
  pass "No server secrets exposed to client bundle"
else
  fail "Server secrets referenced in client code: $CLIENT_SECRETS"
fi

# --- 9. Repository is not in-memory-only in production ---
echo ""
echo "--- [9] Real database boundary ---"

HAS_SUPABASE_CLIENT=$(grep -rn "@supabase/supabase-js\|@supabase/ssr" package.json 2>/dev/null || true)
if [ -n "$HAS_SUPABASE_CLIENT" ]; then
  pass "Supabase client dependency declared"
else
  fail "No Supabase client in package.json — repository is in-memory only (not production-ready)"
fi

# --- 10. Git hygiene ---
echo ""
echo "--- [10] Git hygiene ---"

if git status --porcelain | grep -q .; then
  fail "Working tree has uncommitted changes — commit or stash first"
else
  pass "Working tree clean"
fi

if git remote -v | grep -q stashmind; then
  pass "Remote origin configured for stashmind"
else
  fail "No remote origin pointing to stashmind repository"
fi

# --- Summary ---
echo ""
echo "================================================"
echo " Stability Verification Summary"
echo " Passed: $PASS_COUNT   Failed: $FAILURES"
echo "================================================"

if [ "$FAILURES" -gt 0 ]; then
  echo "RESULT: UNSTABLE — fix the $FAILURES failure(s) above before executing Tier 0 / Tier 1 work."
  exit 1
else
  echo "RESULT: STABLE — all prerequisites met. Safe to execute Tier 0 / Tier 1 work."
  exit 0
fi
