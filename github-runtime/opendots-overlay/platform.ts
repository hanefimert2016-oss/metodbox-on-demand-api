import { ComputerService } from './computer-service.js';
import { ConnectionService } from './connections.js';
import { PageService } from './page-service.js';
import { randomUUID } from 'node:crypto';
import {
  CopilotKitIntelligence,
  CopilotRuntime,
  createCopilotHonoHandler,
  type CopilotHonoApp,
} from '@copilotkit/runtime/v2';
import { createSlackChannel } from './slack-channel.js';
export { slackIdentity } from './slack-channel.js';
import { Store } from './store.js';
import { WorkspaceStore } from './workspace.js';
import { DotAgent } from './dot-agent.js';
import { runThreadTurn } from './headless.js';
import {
  setupStatus,
  type PlatformConfig,
} from './platform-config.js';
import { validateRuntimeScope } from './runtime-scope.js';
import { learningSelector } from './learning.js';
import { SetupTelemetry } from './setup-telemetry.js';
import { ThreadHub, type StoredThreadMessage } from './threadhub.js';

export class Platform {
  private channelStartupFailed = false;
  readonly setupTelemetry: SetupTelemetry;
  readonly pages: PageService;
  readonly computers: ComputerService;
  readonly connections: ConnectionService;
  readonly threadHub: ThreadHub;
  readonly intelligence?: CopilotKitIntelligence;
  readonly handler: CopilotHonoApp;

  constructor(
    readonly store: Store,
    readonly workspace: WorkspaceStore,
    readonly config: PlatformConfig,
  ) {
    this.setupTelemetry = new SetupTelemetry(store);
    this.computers = new ComputerService(
      workspace,
      config,
      () => store.settings().paused,
    );
    this.connections = new ConnectionService(workspace.connections);

    this.threadHub = new ThreadHub(
      config.threadHubUrl ?? '',
      config.threadHubToken ?? '',
    );

    this.pages = new PageService(workspace, () => this.threadHub);

    // Intelligence is optional in this fork. When a key is deliberately
    // configured it can still power Slack/Learning, but normal web
    // conversations persist through our own encrypted ThreadHub.
    if (config.intelligenceKey) {
      this.intelligence = new CopilotKitIntelligence({
        apiKey: config.intelligenceKey,
        apiUrl: config.intelligenceApiUrl,
        wsUrl: config.intelligenceWsUrl,
        getLearningContainerId: learningSelector(
          workspace,
          config.slackDotId ?? workspace.dots()[0]?.id,
        ),
      });
    }

    const channels = [];
    if (
      this.intelligence &&
      config.slackChannel &&
      config.slackTeam &&
      config.slackUsers.length
    ) {
      const dotId = config.slackDotId ?? workspace.dots()[0].id;
      if (!workspace.dot(dotId))
        throw new Error('SLACK_DOT_ID does not identify an existing Dot.');
      const slack = createSlackChannel({
        name: config.slackChannel,
        config,
        ownerId: workspace.ownerId,
        paused: () => store.settings().paused,
        agent: () =>
          new DotAgent(
            store,
            workspace,
            config,
            dotId,
            true,
            this.setupTelemetry,
          ),
      });
      channels.push(slack);
    }

    const agents = async () =>
      Object.fromEntries(
        workspace
          .dots()
          .map((dot) => [
            dot.id,
            new DotAgent(
              store,
              workspace,
              config,
              dot.id,
              false,
              this.setupTelemetry,
            ),
          ]),
      );

    // No Intelligence key => CopilotKit's plain SSE runtime. This is the key
    // to making normal OpenDots chat independent from CopilotKit Intelligence.
    // Thread durability is handled separately by ThreadHub.
    const runtime = this.intelligence
      ? new CopilotRuntime({
          intelligence: this.intelligence,
          telemetryId: this.setupTelemetry.identity,
          telemetryProperties: this.setupTelemetry.metadata,
          identifyUser: async () => ({
            id: workspace.ownerId,
            name: 'OpenDots owner',
          }),
          agents,
          channels,
          generateThreadNames: false,
        })
      : new CopilotRuntime({
          telemetryId: this.setupTelemetry.identity,
          telemetryProperties: this.setupTelemetry.metadata,
          agents,
        });

    this.handler = createCopilotHonoHandler({
      runtime,
      basePath: '/api/copilotkit',
      cors: { origin: [] },
    });
  }

  setup() {
    return setupStatus(
      this.config,
      this.handler.channels?.status().overall ??
        (this.config.slackChannel ? 'setup_required' : 'not_configured'),
      this.channelStartupFailed,
    );
  }

  requireReady() {
    const missing = this.setup().missing;
    if (missing.length)
      throw new Error(`Setup required: ${missing.join(', ')}.`);
  }

  async start() {
    this.setupTelemetry.start();
    if (this.handler.channels) {
      try {
        await this.handler.channels.ready({ timeoutMs: 15000 });
        this.channelStartupFailed = false;
      } catch (error) {
        this.channelStartupFailed = true;
        this.setupTelemetry.capture({
          kind: 'setup_failed',
          step: 'settings',
          error_class: 'channel_start_failed',
        });
        throw error;
      }
    }
  }

  async stop() {
    await this.setupTelemetry.stop();
    await this.handler.channels?.stop();
  }

  async createConversation(dotId: string, title: string) {
    this.requireReady();
    if (!this.workspace.dot(dotId)) throw new Error('Dot not found.');
    const id = randomUUID();
    try {
      await this.threadHub.getOrCreateThread({
        threadId: id,
        userId: this.workspace.ownerId,
        agentId: dotId,
        name: title,
      });
    } catch {
      throw new Error(
        'ThreadHub could not create this conversation. Check the GitHub-backed thread service.',
      );
    }
    return this.workspace.bindThread(id, dotId, title);
  }

  async threadMessages(threadId: string) {
    this.requireReady();
    this.workspace.requireThread(threadId);
    return this.threadHub.getThreadMessages({
      threadId,
      userId: this.workspace.ownerId,
    });
  }

  async saveThreadMessages(
    threadId: string,
    messages: Record<string, unknown>[],
  ) {
    this.requireReady();
    const thread = this.workspace.requireThread(threadId);
    const safeMessages = messages.filter(
      (message): message is StoredThreadMessage =>
        typeof message.role === 'string',
    );
    return this.threadHub.putThreadMessages(threadId, {
      agentId: thread.dotId,
      title: thread.title,
      messages: safeMessages,
    });
  }

  async history(threadId: string): Promise<string> {
    this.requireReady();
    this.workspace.requireThread(threadId);
    const history = await this.threadHub.getThreadMessages({
      threadId,
      userId: this.workspace.ownerId,
    });
    return history.messages
      .filter((message) => ['user', 'assistant'].includes(String(message.role)))
      .slice(-12)
      .map(
        (message) =>
          `${String(message.role)}: ${typeof message.content === 'string' ? message.content : ''}`,
      )
      .join('\n')
      .slice(-12000);
  }

  async handle(request: Request): Promise<Response> {
    let body: unknown;
    if (request.method !== 'GET' && request.method !== 'HEAD')
      body = await request
        .clone()
        .json()
        .catch(() => null);
    try {
      validateRuntimeScope(request, this.workspace, body);
    } catch (error) {
      return Response.json(
        {
          error:
            error instanceof Error
              ? error.message
              : 'Conversation scope denied.',
        },
        { status: 403 },
      );
    }
    return this.handler.fetch(request);
  }

  async turn(
    threadId: string,
    prompt: string,
    signal: AbortSignal,
    metadata?: Record<string, unknown>,
  ): Promise<string> {
    this.requireReady();
    const thread = this.workspace.requireThread(threadId);
    return runThreadTurn(
      this.config.runtimeUrl,
      this.config.ownerToken
        ? { Authorization: `Bearer ${this.config.ownerToken}` }
        : {},
      thread.dotId,
      threadId,
      prompt,
      signal,
      metadata,
    );
  }
}
