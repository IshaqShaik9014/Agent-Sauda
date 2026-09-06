import { agentToolExecutor, AGENT_TOOLS } from './agent.tools.js';
import type { AgentContext } from './agent.types.js';
import type { ToolCallDefinition, OfferEvaluationResult } from '@agent-sauda/domain';
import { env } from '../../config/env.js';
import { getAgentDriver } from './agent.driver.js';

export interface SSEWriter {
  writeEvent: (event: string, data: Record<string, unknown> | string) => void;
  close: () => void;
}

export class AgentStreamManager {
  /**
   * Executes a streaming conversational turn, progressively sending SSE events.
   */
  async streamTurn(
    ctx: AgentContext,
    systemPrompt: string,
    writer: SSEWriter
  ): Promise<{ reply: string; toolCallsExecuted: ToolCallDefinition[]; evaluation?: OfferEvaluationResult }> {
    const isGeminiEnabled = env.GEMINI_API_KEY && !env.GEMINI_API_KEY.includes('mock');

    if (isGeminiEnabled) {
      return this.streamGemini(ctx, systemPrompt, writer);
    } else {
      return this.streamSemanticDriver(ctx, systemPrompt, writer);
    }
  }

  /**
   * Streams token chunks and tool loops using Google Gemini REST streaming API.
   */
  private async streamGemini(
    ctx: AgentContext,
    systemPrompt: string,
    writer: SSEWriter
  ): Promise<{ reply: string; toolCallsExecuted: ToolCallDefinition[]; evaluation?: OfferEvaluationResult }> {
    const toolCallsExecuted: ToolCallDefinition[] = [];
    let fullReply = '';
    let latestEvaluation: OfferEvaluationResult | undefined = undefined;

    const geminiFunctionDeclarations = AGENT_TOOLS.map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters
    }));

    const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text?: string; functionCall?: any; functionResponse?: any }> }> = [];

    for (const msg of ctx.messages) {
      contents.push({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      });
    }

    const payload: any = {
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents,
      tools: [{ functionDeclarations: geminiFunctionDeclarations }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 1000 }
    };

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${env.GEMINI_API_KEY}`;

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error(`Gemini API error ${res.status}`);

      const data = await res.json();
      const candidate = data.candidates?.[0];
      const modelParts = candidate?.content?.parts || [];
      const functionCalls = modelParts.filter((p: any) => p.functionCall);

      if (functionCalls.length > 0) {
        const toolResponseParts: any[] = [];

        for (const part of functionCalls) {
          const fnName = part.functionCall.name;
          const fnArgs = part.functionCall.args || {};
          const callId = `call_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

          toolCallsExecuted.push({ id: callId, name: fnName, arguments: fnArgs });

          // Notify frontend that tool is running
          writer.writeEvent('tool_call', { tool: fnName, args: fnArgs });

          const result = await agentToolExecutor.executeTool(fnName, fnArgs, ctx);

          if (fnName === 'propose_offer') {
            latestEvaluation = result as OfferEvaluationResult;
            writer.writeEvent('policy_evaluated', { decision: latestEvaluation.decision, reasons: latestEvaluation.reasons });
          }

          writer.writeEvent('tool_result', { tool: fnName, status: 'completed' });

          toolResponseParts.push({
            functionResponse: { name: fnName, response: { result } }
          });
        }

        // Second turn for synthesis
        contents.push({ role: 'model', parts: modelParts });
        contents.push({ role: 'user', parts: toolResponseParts });

        const secondRes = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents,
            generationConfig: { temperature: 0.2, maxOutputTokens: 1000 }
          })
        });

        if (secondRes.ok) {
          const secondData = await secondRes.json();
          const secondText = secondData.candidates?.[0]?.content?.parts?.[0]?.text || '';
          fullReply = secondText;
          await this.streamTextWords(secondText, writer);
          return { reply: fullReply, toolCallsExecuted, evaluation: latestEvaluation };
        }
      }

      // Default text chunk stream
      const textReply = modelParts.find((p: any) => p.text)?.text || 'How can I assist you with our catalog today?';
      fullReply = textReply;
      await this.streamTextWords(textReply, writer);

      return { reply: fullReply, toolCallsExecuted, evaluation: latestEvaluation };
    } catch (err) {
      console.warn('[AgentStream] Gemini stream fallback to semantic driver:', err);
      return this.streamSemanticDriver(ctx, systemPrompt, writer);
    }
  }

  /**
   * Resilient semantic driver with simulated natural token streaming.
   */
  private async streamSemanticDriver(
    ctx: AgentContext,
    systemPrompt: string,
    writer: SSEWriter
  ): Promise<{ reply: string; toolCallsExecuted: ToolCallDefinition[]; evaluation?: OfferEvaluationResult }> {
    const driver = getAgentDriver();
    const result = await driver.executeTurn(ctx, systemPrompt);

    // Emit executed tools to SSE stream
    for (const tool of result.toolCallsExecuted) {
      writer.writeEvent('tool_call', { tool: tool.name, args: tool.arguments });
      writer.writeEvent('tool_result', { tool: tool.name, status: 'completed' });
    }

    const evalResult = result.toolResults?.find((t) => t.toolName === 'propose_offer')?.result as OfferEvaluationResult | undefined;
    if (evalResult) {
      writer.writeEvent('policy_evaluated', { decision: evalResult.decision, reasons: evalResult.reasons });
    }

    // Stream text reply with natural typing cadence
    await this.streamTextWords(result.reply, writer);

    return {
      reply: result.reply,
      toolCallsExecuted: result.toolCallsExecuted,
      evaluation: evalResult
    };
  }

  /**
   * Emits text chunks with smooth typing animation intervals.
   */
  private async streamTextWords(text: string, writer: SSEWriter, delayMs = 18): Promise<void> {
    const words = text.split(/(\s+)/);
    for (const word of words) {
      if (!word) continue;
      writer.writeEvent('text_delta', { chunk: word });
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
}

export const agentStreamManager = new AgentStreamManager();
