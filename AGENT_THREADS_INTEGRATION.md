# Metodbox — ONE GitHub token, no ngrok, custom ThreadHub, per-agent PC

## Fixed repositories

| Purpose | Repository | Branch |
|---|---|---|
| Main code, Cloudflare Worker, GitHub Actions | `hanefimert2016-oss/metodbox-on-demand-api` | `main` |
| Encrypted conversation + agent files ONLY | `hanefimert2016-oss/Metodbox-secret-system` | `agent-data` |

**Do not change the main repository.** The old `ai-application-suite-1` agent_threads experiment is not the canonical implementation.

**IMPORTANT:** Metodbox-secret-system was created as **PUBLIC**. Before running, change it to
**PRIVATE** in its GitHub Settings → General → Danger Zone → Change repository visibility → Private.
The Cloudflare ThreadHub **refuses** to read/write when storage is public. Agent launchers refuse
to clone the public storage repository.

## Existing Cloudflare endpoint — no ngrok required

- Portal login: https://metodbox-direct-api.hanefimert2016.workers.dev/apps
- OpenAI-compatible model API: https://metodbox-direct-api.hanefimert2016.workers.dev/v1
- ThreadHub: `/api/threadhub/threads`
- Agent PC supervisor: `/api/pc/computers`

Login: **username `admin`**, password is **set locally to the requested `2026`** by your terminal.
No login credentials are committed to public source. Session cookies are signed and marked Secure/HttpOnly.
A best-effort IP-based 5-attempt / 15-minute login limit is active. Because 2026 is an easily guessed
password, change it to a strong unique value after initial testing. For broader internet exposure
Cloudflare Access and multi-factor authentication are strongly recommended.

The **existing** Cloudflare Worker is always the front door. The earlier
`manual-api-server.yml` ngrok workflow is legacy and **not needed** for this implementation.
GitHub-hosted OpenDots and per-agent computers still use **cloudflared Quick Tunnels**
(`trycloudflare.com`) to expose ephemeral UI processes; **Cloudflare Quick Tunnels are not ngrok**,
but are temporary addresses and not a production high-availability network.

## One-time local setup on Arch Linux

First, change the **storage** repository to PRIVATE.

Create **ONE** GitHub fine-grained PAT at https://github.com/settings/personal-access-tokens/new:

- Repository access: **Only select repositories**, selecting BOTH
  `metodbox-on-demand-api` and `Metodbox-secret-system`.
- Repository permissions: **Contents — Read and write** (Metadata: Read is automatic).
- This same token performs encrypted GitHub storage operations and dispatches agent jobs.

Existing `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, and `API_KEY` secrets on the
**main repo** are reused. They do not require a new PAT and are not overwritten.

```bash
sudo pacman -S --needed github-cli openssl
gh auth status || gh auth login --web
gh api repos/hanefimert2016-oss/metodbox-on-demand-api/contents/github-runtime/setup-private-storage.sh \
  --jq .content | base64 -d > /tmp/setup-private-storage.sh

# Review what runs locally
less /tmp/setup-private-storage.sh

bash /tmp/setup-private-storage.sh
```

The script asks for **one GitHub PAT** and your portal password in invisible prompts. Enter
`2026` for the requested initial password. It sets the main repo Actions secrets:

- `AGENT_STORAGE_TOKEN`: your single fine-grained PAT
- `PORTAL_PASSWORD`: password entered locally
- `PORTAL_SESSION_SECRET`: randomly generated only if missing
- `STORAGE_ENCRYPTION_KEY`: randomly generated only if missing

**Never rotate STORAGE_ENCRYPTION_KEY without migrating/encrypting previous stored data.**
The portal session secret and encryption secret are independent.

Then open https://github.com/hanefimert2016-oss/metodbox-on-demand-api/actions/workflows/configure-private-storage.yml
and run **Configure Private Thread Storage** once. It checks storage privacy and deploys
these existing Worker secrets using Wrangler:

- `GITHUB_STORAGE_TOKEN`: same one PAT
- `GITHUB_TRIGGER_TOKEN`: same one PAT
- `GITHUB_STORAGE_REPO`: new storage-only repository
- `GITHUB_STORAGE_BRANCH`: `agent-data`
- `GITHUB_LAUNCH_REPO`: unchanged main repository
- `PORTAL_USERNAME`: `admin`
- `PORTAL_PASSWORD`, `PORTAL_SESSION_SECRET`, `STORAGE_ENCRYPTION_KEY`

## What persists

- `agent-storage/threads/*.enc.json`: AES-GCM encrypted thread history
- `agent-storage/pcs/<agent-id>/state.tar.gz.enc`: encrypted PC state snapshots
- `agent-storage/apps/opendots/state.tar.gz.enc`: encrypted OpenDots state

The existing OpenDots fork (`github-runtime/patch-opendots.py`) saves chat histories to
ThreadHub; the `Agent PC` workflow assigns an individual, temporary GitHub-hosted
Ubuntu computer with its own Docker agent-computer container to each `agent_id`.
Start OpenDots from **Launch Copilot App**. OpenBot still has a separate upstream
CopilotKit Intelligence dependency. Neither GitHub runner nor cloudflared tunnel remains
permanently online.

Manual/API tests:
```bash
curl -fsS https://metodbox-direct-api.hanefimert2016.workers.dev/health
# After configuring API_KEY as an environment variable:
curl -fsS -H "Authorization: Bearer $API_KEY" \
  https://metodbox-direct-api.hanefimert2016.workers.dev/api/threadhub/health
```

## Limits and privacy

- GitHub has Git object limits, history-growth costs, API rate limits and runner quotas.
- The encrypted GitHub files cannot be queried as fast as a database. Store the large
  generated artifacts outside GitHub or add dedicated storage later.
- Encryption protects at-rest data but the Worker and agent process can decrypt it.
- Agent PC backups currently use AES-CBC+PBKDF2 for backwards compatibility;
  authenticated encryption is a future improvement.
- The Metodbox model bridge is unchanged. Backend model naming does not prove provider identity.
- Real Cloudflare deployment and live login are **not verified** until the one-PAT
  setup and configuration workflow complete successfully.
