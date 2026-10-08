#!/usr/bin/env bash
# Shared private GitHub storage client for dedicated agent PCs and OpenDots.
# Source this file; it intentionally refuses to store data in the public control repository.
if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  echo "Source this helper from an agent launcher" >&2
  exit 2
fi

storage_configure() {
  : "${AGENT_STORAGE_REPO:=hanefimert2016-oss/Metodbox-secret-system}"
  : "${AGENT_STORAGE_BRANCH:=agent-data}"
  if [[ -z "${AGENT_STORAGE_TOKEN:-}" ]]; then
    echo "::error::AGENT_STORAGE_TOKEN GitHub Actions secret eksik." >&2
    return 1
  fi
  if [[ ! "$AGENT_STORAGE_REPO" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]] ||
     [[ ! "$AGENT_STORAGE_BRANCH" =~ ^[A-Za-z0-9._/-]+$ ]]; then
    echo "Invalid private storage repository/branch" >&2
    return 1
  fi
  if [[ "$AGENT_STORAGE_REPO" == "${GITHUB_REPOSITORY:-hanefimert2016-oss/metodbox-on-demand-api}" ]]; then
    echo "Refusing to use the PUBLIC control repository for persistent data." >&2
    return 1
  fi
  # Fail closed: never upload private agent data to a public repository.
  # Uses the already-provided one fine-grained PAT, without logging it.
  local is_private
  is_private="$(GH_TOKEN="$AGENT_STORAGE_TOKEN" gh api "repos/$AGENT_STORAGE_REPO" --jq '.private')" || return 1
  if [[ "$is_private" != "true" ]]; then
    echo "::error::Storage repo is PUBLIC. Set repository visibility to Private before starting agents." >&2
    return 1
  fi
  export GIT_TERMINAL_PROMPT=0
  export GIT_ASKPASS="${RUNNER_TEMP:-/tmp}/agent-storage-askpass-$$.sh"
  umask 077
  cat > "$GIT_ASKPASS" <<'SH'
#!/bin/sh
case "$1" in
  *Username*) printf '%s\n' x-access-token ;;
  *Password*) printf '%s\n' "$AGENT_STORAGE_TOKEN" ;;
  *) printf '\n' ;;
esac
SH
  chmod 700 "$GIT_ASKPASS"
}

storage_clone() {
  local destination="$1"
  storage_configure || return 1
  rm -rf "$destination"
  git -c credential.helper= clone -q --single-branch --branch "$AGENT_STORAGE_BRANCH" \
    "https://github.com/$AGENT_STORAGE_REPO.git" "$destination"
  git -C "$destination" config user.name "Metodbox Private Agent Storage"
  git -C "$destination" config user.email "actions@users.noreply.github.com"
}

storage_push() {
  local directory="$1"
  for attempt in 1 2 3 4 5; do
    if ! git -C "$directory" -c credential.helper= pull --rebase -q origin "$AGENT_STORAGE_BRANCH"; then
      git -C "$directory" rebase --abort >/dev/null 2>&1 || true
      sleep "$((attempt * 2))"
      continue
    fi
    if git -C "$directory" -c credential.helper= push -q origin "HEAD:$AGENT_STORAGE_BRANCH"; then
      echo "Private encrypted GitHub storage updated."
      return 0
    fi
    sleep "$((attempt * 2))"
  done
  echo "::error::Could not persist agent data to PRIVATE storage branch." >&2
  return 1
}
