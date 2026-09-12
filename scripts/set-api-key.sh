#!/usr/bin/env bash
#
# Writes your AI provider key into .env.local without it ever appearing on
# screen, in your shell history, or in any tracked file.
#
#   bash scripts/set-api-key.sh
#
# Accepts either kind of key and points AI_PROVIDER at the matching adapter:
#   sk-or-v1-...  OpenRouter  (https://openrouter.ai/keys)
#   sk-ant-...    Anthropic   (https://console.anthropic.com/settings/keys)
#
set -euo pipefail

cd "$(dirname "$0")/.."
ENV_FILE=".env.local"

printf '\nPaste your OpenRouter (sk-or-v1-...) or Anthropic (sk-ant-...) key and press Enter.\n'
printf 'It will NOT be shown as you type — that is expected.\n\n'
printf 'Key: '
# -s hides the input; the key never renders and never reaches the scrollback.
read -rs KEY
printf '\n\n'

# Strip whitespace a copy-paste often drags along; a stray space is the most
# common reason a pasted key is rejected or saved unusable.
KEY="$(printf '%s' "${KEY}" | tr -d '[:space:]')"

if [ -z "${KEY}" ]; then
  echo "Nothing entered — no change made."
  exit 1
fi

case "${KEY}" in
  sk-or-v1-*) KEY_NAME="OPENROUTER_API_KEY"; PROVIDER="openrouter" ;;
  sk-ant-*)   KEY_NAME="ANTHROPIC_API_KEY";  PROVIDER="anthropic"  ;;
  *)
    echo "That key starts with something unexpected."
    echo "  OpenRouter keys start with 'sk-or-v1-'"
    echo "  Anthropic keys start with 'sk-ant-'"
    echo "No change made."
    exit 1
    ;;
esac

touch "${ENV_FILE}"
chmod 600 "${ENV_FILE}"

# Rewrite the key and provider lines in place, leaving every other setting
# untouched.
TMP="$(mktemp)"
trap 'rm -f "${TMP}"' EXIT
grep -vE "^(${KEY_NAME}|AI_PROVIDER)=" "${ENV_FILE}" > "${TMP}" || true
printf '%s=%s\n' "${KEY_NAME}" "${KEY}" >> "${TMP}"
printf 'AI_PROVIDER=%s\n' "${PROVIDER}" >> "${TMP}"
cat "${TMP}" > "${ENV_FILE}"
chmod 600 "${ENV_FILE}"

# Confirm by length and last four characters only — never the key itself.
echo "Saved ${KEY_NAME} to ${ENV_FILE}, with AI_PROVIDER=${PROVIDER}"
echo "  length: ${#KEY} characters, ending ...${KEY: -4}"
echo
echo "Now tell Claude 'key added' and it will restart the server and test it."
