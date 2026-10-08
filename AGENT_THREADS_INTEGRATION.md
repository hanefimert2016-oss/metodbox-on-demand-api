# Agent Threads integration — separate private agent infrastructure

The existing on-demand Metodbox OpenAI-compatible API remains untouched in this repository.

A separate *private* repository contains the custom thread/agent PC implementation:
https://github.com/hanefimert2016-oss/ai-application-suite-1/tree/main/agent_threads

Design:
- Existing Metodbox API / Open WebUI forwarding stays here.
- The private `agent_threads` module provides persistent GitHub thread JSON records and a Cloudflare Worker HTTP API.
- Each agent task executes in a separate GitHub-hosted Ubuntu runner via `.github/workflows/agent-pc.yml`.
- Outputs and thread history are stored in the private repository (not in this public one).
- The Cloudflare Worker is deployed separately as `mert-agent-threads`, so it does NOT replace your existing static ngrok API URL.
- An OpenBot/OpenDots client integration adapter is still needed for proprietary thread semantics.

The private repo README lists required secrets, deployment steps and endpoints.
These secrets must be set by the repository administrator; they are not embedded in code.
