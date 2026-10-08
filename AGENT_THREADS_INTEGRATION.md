# Metodbox API + OpenDots ThreadHub + Dedicated Agent PCs

## What is the MAIN repository?

**Public control/code repo:** `hanefimert2016-oss/metodbox-on-demand-api`

**Private encrypted data repo:** `hanefimert2016-oss/ai-application-suite-1` on **`agent-data`** branch.
Data is NOT written to the public control repo by the upgraded launchers.
The older `agent_threads/` code in the private repo was an experimental prototype;
**do not deploy its `mert-agent-threads` Worker or agent-pc workflow**.
The integrated implementation in this repository is canonical.

## Architecture

```text
OpenDots (GitHub Actions runtime)        OpenBot (legacy Intelligence adapter)
   |                  \                    |
   |  SSE/Chat         \ agent PC            | model
   v                    v                   v
Cloudflare Worker: metodbox-direct-api (EXISTING WORKER)
  /v1/chat/completions  --> GPT+ Metodbox gpt-5.1
  /api/threadhub/*      --> AES-GCM encrypted GitHub thread files
  /api/pc/*             --> public repository_dispatch (launch_agent_pc)
                                |
                       github.com/metodbox-on-demand-api
                         GitHub-hosted Ubuntu runner PER AGENT
                           -> OpenBot agent-computer Docker container
                           -> terminal / browser / workspace / temporary tunnel
                           -> encrypted workspace checkpoint
                                |
                                v
              PRIVATE ai-application-suite-1 @ agent-data
              agent-storage/threads/*.enc.json
              agent-storage/pcs/<agent-id>/state.tar.gz.enc
              agent-storage/apps/opendots/state.tar.gz.enc
```

Agent PCs are **ephemeral GitHub-hosted VMs**, not always-on physical PCs.
Different agent IDs can get separate jobs, subject to GitHub concurrency/billing quotas.
Workspaces are restored from encrypted checkpoints if one exists.

The existing `manual-api-server.yml` and ngrok URL remain unchanged.
The existing `cloudflare-direct/src/index.js`, `portal.js`,
`threadhub.js`, `patch-opendots.py`, and OpenDots UI are reused.

## One-time token setup on YOUR Arch Linux PC

You need two distinct **GitHub fine-grained Personal Access Tokens (PATs)**:

1. **PRIVATE data token** restricted to `ai-application-suite-1`, `Contents: Read and write`.
   It is saved in the public control repo **Actions Secrets** as `AGENT_STORAGE_TOKEN`,
   and securely copied into Cloudflare as Worker secret `GITHUB_STORAGE_TOKEN`.
2. **PUBLIC dispatch token** restricted to `metodbox-on-demand-api`, `Contents: Read and write`
   (GitHub requires this to call `repository_dispatch`). It is saved as
   Actions secret `AGENT_DISPATCH_TOKEN` and securely copied to Cloudflare as
   Worker secret `GITHUB_TRIGGER_TOKEN`.

Your existing public repo should already have `API_KEY`, `METODBOX_TOKEN`,
`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`; these are not overwritten.

Run the checked-in local setup script on your own PC:

```bash
sudo pacman -S --needed github-cli openssl
gh auth status || gh auth login --hostname github.com --git-protocol https --web
gh api repos/hanefimert2016-oss/metodbox-on-demand-api/contents/github-runtime/setup-private-storage.sh \
  --jq .content | base64 -d > /tmp/setup-private-storage.sh
less /tmp/setup-private-storage.sh
bash /tmp/setup-private-storage.sh
```

The script prompts for two PATs with echo disabled and uploads them using stdin
(not arguments, not commits). **Never paste tokens into ChatGPT.**

Then in **metodbox-on-demand-api > Actions > Configure Private Thread Storage > Run workflow**:
https://github.com/hanefimert2016-oss/metodbox-on-demand-api/actions/workflows/configure-private-storage.yml

It checks the private data repo, then configures these Cloudflare Worker secrets:

- `GITHUB_STORAGE_TOKEN` (private repo PAT)
- `GITHUB_STORAGE_REPO` = `hanefimert2016-oss/ai-application-suite-1`
- `GITHUB_STORAGE_BRANCH` = `agent-data`
- `GITHUB_LAUNCH_REPO` = `hanefimert2016-oss/metodbox-on-demand-api`
- `GITHUB_TRIGGER_TOKEN` (public repo dispatch PAT)

**Important:** The ThreadHub encryption secret (`STORAGE_ENCRYPTION_KEY` or the existing fallback)
must remain consistent across migrations. Do not rotate it without decrypt/re-encrypt,
or old histories become unreadable.

## Launch apps and separate agent PCs

- **Actions > Launch Copilot App > Run workflow**: select `opendots`.
  It uses `THREADHUB_URL`, `THREADHUB_TOKEN` and our custom fork,
  not paid Intelligence conversation storage.
- **Actions > Agent PC > Run workflow**: give an `agent_id` such as `coder`.
  Alternatively OpenDots calls `POST /api/pc/computers/coder/ensure`
  to schedule that job via `repository_dispatch`.
- `POST /api/pc/computers/coder/stop` requests a graceful stop (next KV poll).
- The agent desktop is accessed through its **authenticated** temporary tunnel;
  its encrypted disk-like workspace checkpoint stays in the private repo.
- The OpenBot GUI still depends on an upstream Intelligence adapter;
  **only OpenDots** has been adapted to our custom ThreadHub. OpenBot migration
  remains separate work.

## Test the existing Worker

```bash
export API_URL="https://metodbox-direct-api.hanefimert2016.workers.dev"
read -rsp 'Metodbox API key: ' API_KEY; echo
curl -fsS "$API_URL/api/threadhub/health" -H "Authorization: Bearer $API_KEY"
curl -fsS "$API_URL/api/threadhub/threads" -H "Authorization: Bearer $API_KEY"
curl -fsS "$API_URL/api/pc/computers" -H "Authorization: Bearer $API_KEY"
unset API_KEY
```

The `health` response should report
`storage: github-encrypted`, `repo: hanefimert2016-oss/ai-application-suite-1`,
and `branch: agent-data` **after** completing the configuration workflow.

The `Test Private Thread and Agent Storage` GitHub Actions workflow includes
mocked GitHub tests verifying that threads go to private storage and computer
dispatches go to the public code repository.

## Boundaries and known limitations

- The private data branch is encrypted for thread JSON by AES-GCM and for
  agent PC backups by OpenSSL AES-256-CBC with PBKDF2 (legacy compatibility).
  AES-CBC lacks an authentication tag; upgrading that backup format is future work.
- GitHub storage is **not an infinite database**: API limits, file-size limits,
  history growth and action compute quotas all apply.
- GitHub-hosted runners terminate after a maximum of 6 hours; workflow timeouts
  are currently configured below that.
- Public GitHub history that already contains old encrypted backups remains
  public. Moving future data to the private repository does not erase prior commits.
- This change does not start, test the live model, or deploy any running computer
  until the required account secrets are configured and a workflow is run.
