export type StoredThreadMessage = Record<string, unknown>;

export interface StoredThread {
  id: string;
  agentId: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: StoredThreadMessage[];
}

export class ThreadHub {
  constructor(
    private baseUrl: string,
    private token: string,
  ) {}

  get configured() {
    return !!(this.baseUrl.trim() && this.token.trim());
  }

  private async request<T>(
    path: string,
    init: RequestInit = {},
    allowMissing = false,
  ): Promise<T | null> {
    const response = await fetch(
      `${this.baseUrl.replace(/\/$/, '')}${path}`,
      {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.token}`,
          ...(init.headers ?? {}),
        },
      },
    );
    if (allowMissing && response.status === 404) return null;
    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `ThreadHub HTTP ${response.status}: ${text.slice(0, 300)}`,
      );
    }
    return (await response.json()) as T;
  }

  async getThread(threadId: string): Promise<StoredThread | null> {
    return this.request<StoredThread>(
      `/threads/${encodeURIComponent(threadId)}`,
      {},
      true,
    );
  }

  async getOrCreateThread(input: {
    threadId: string;
    userId: string;
    agentId: string;
    name: string;
  }) {
    const existing = await this.getThread(input.threadId);
    if (existing) return { thread: existing, created: false };
    const created = await this.request<StoredThread>('/threads', {
      method: 'POST',
      body: JSON.stringify({
        id: input.threadId,
        agentId: input.agentId,
        title: input.name,
      }),
    });
    return { thread: created!, created: true };
  }

  async createThread(input: {
    threadId: string;
    userId: string;
    agentId: string;
    name: string;
  }) {
    return this.getOrCreateThread(input);
  }

  async getThreadMessages(input: { threadId: string; userId: string }) {
    const thread = await this.getThread(input.threadId);
    return { messages: thread?.messages ?? [] };
  }

  async putThreadMessages(
    threadId: string,
    input: {
      agentId?: string;
      title?: string;
      messages: StoredThreadMessage[];
    },
  ) {
    const thread = await this.request<StoredThread>(
      `/threads/${encodeURIComponent(threadId)}`,
      {
        method: 'PUT',
        body: JSON.stringify(input),
      },
    );
    return thread!;
  }

  async listThreads(agentId?: string) {
    const suffix = agentId
      ? `?agent_id=${encodeURIComponent(agentId)}`
      : '';
    const result = await this.request<{
      object: 'list';
      data: Array<{
        id: string;
        agentId: string;
        title: string;
        createdAt: number;
        updatedAt: number;
        messageCount: number;
      }>;
    }>(`/threads${suffix}`);
    return result?.data ?? [];
  }
}
