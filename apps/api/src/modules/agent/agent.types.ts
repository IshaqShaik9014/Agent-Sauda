import type { ToolCallDefinition, ChatMessage } from '@agent-sauda/domain';

export interface AgentToolDeclaration {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface AgentContext {
  merchantId: string;
  merchantName: string;
  merchantSlug: string;
  currency: string;
  conversationId: string;
  actorId?: string;
  messages: ChatMessage[];
}

export interface AgentExecutionResult {
  reply: string;
  toolCallsExecuted: ToolCallDefinition[];
  toolResults: Array<{ toolName: string; result: unknown }>;
}
