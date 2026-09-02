import type {
    AgentContentPart,
    AgentMessage,
    AgentModelDescriptor,
    AgentModelEvent,
    AgentModelRequest,
    AgentModelResponse,
    AgentModelTransport,
} from '@series-inc/rundot-agent';

const usage = { inputTokens: 12, outputTokens: 18, totalTokens: 30 };
let callSequence = 0;

const textOf = (message: AgentMessage): string => message.content
    .map((part) => (part.type === 'text' ? part.text : ''))
    .join('');

const latestUserText = (request: AgentModelRequest): string => {
    const message = [...request.messages].reverse().find((item) => item.role === 'user');
    return message ? textOf(message) : '';
};

const toolResultReply = (message: AgentMessage): string | null => {
    if (message.role !== 'tool_result') return null;
    if (message.isError && message.toolName === 'accept_quest') {
        return 'Understood. I will leave the signal route unmarked. The work can wait until you are ready.';
    }
    if (message.toolName === 'look_around') {
        return 'The rain has reached the fire line. The tower light now turns east, but the marsh is answering from the west.';
    }
    if (message.toolName === 'accept_quest') {
        return 'Then the signal is yours. I marked the tower route on your map. Come back before the low fog covers the boardwalk.';
    }
    if (message.toolName === 'ask_user') {
        const answer = textOf(message) || 'that route';
        return `Good. We will use ${answer.toLowerCase()}. I will keep the tower light on until you return.`;
    }
    return 'It is done.';
};

const responseFor = (request: AgentModelRequest): AgentModelResponse => {
    const last = request.messages.at(-1);
    const toolReply = last ? toolResultReply(last) : null;
    if (toolReply) {
        return {
            model: request.model,
            content: [{ type: 'text', text: toolReply }],
            finishReason: 'stop',
            usage,
        };
    }

    const prompt = latestUserText(request).toLowerCase();
    let content: AgentContentPart[];
    if (
        prompt.includes('take the signal') ||
        prompt.includes('accept the quest') ||
        prompt.includes('take the job')
    ) {
        content = [{
            type: 'tool_call',
            callId: `offline-call-${++callSequence}`,
            name: 'accept_quest',
            arguments: { questId: 'signal-in-the-fog' },
        }];
    } else if (prompt.includes('choose') || prompt.includes('which path')) {
        content = [{
            type: 'tool_call',
            callId: `offline-call-${++callSequence}`,
            name: 'ask_user',
            arguments: {
                question: 'Which route should we use through the marsh?',
                choices: ['The lit boardwalk', 'The radio pulses'],
            },
        }];
    } else if (prompt.includes('look') || prompt.includes('changed')) {
        content = [{
            type: 'tool_call',
            callId: `offline-call-${++callSequence}`,
            name: 'look_around',
            arguments: {},
        }];
    } else {
        content = [{
            type: 'text',
            text: 'It listens for the old weather beacons. Tonight, one signal returned with a human rhythm. That is why I stayed by the fire.',
        }];
    }

    return {
        model: request.model,
        content,
        finishReason: content.some((part) => part.type === 'tool_call') ? 'tool_calls' : 'stop',
        usage,
    };
};

const assertActive = (signal: AbortSignal): void => {
    if (signal.aborted) throw new DOMException('The request was stopped.', 'AbortError');
};

/** A local transport for the offline sample mode. It does not make network requests. */
export class OfflineNpcTransport implements AgentModelTransport {
    async complete(
        request: AgentModelRequest,
        options: { signal: AbortSignal },
    ): Promise<AgentModelResponse> {
        assertActive(options.signal);
        return responseFor(request);
    }

    async *stream(
        request: AgentModelRequest,
        options: { signal: AbortSignal },
    ): AsyncIterable<AgentModelEvent> {
        const response = responseFor(request);
        for (const part of response.content) {
            assertActive(options.signal);
            if (part.type === 'text') {
                const fragments = part.text.match(/\S+\s*/g) ?? [part.text];
                for (const fragment of fragments) {
                    assertActive(options.signal);
                    yield { type: 'text_delta', delta: fragment };
                    await Promise.resolve();
                }
            } else if (part.type === 'tool_call') {
                yield {
                    type: 'tool_call_delta',
                    index: 0,
                    callId: part.callId,
                    name: part.name,
                    argumentsDelta: JSON.stringify(part.arguments),
                };
            }
        }
        yield { type: 'finish', reason: response.finishReason, usage: response.usage };
    }

    async listModels(): Promise<AgentModelDescriptor[]> {
        return [{ id: 'claude-sonnet-4-6', contextWindow: 200_000, tier: 'standard' }];
    }
}
