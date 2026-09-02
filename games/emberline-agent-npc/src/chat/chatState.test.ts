import { describe, expect, it } from 'vitest';
import type { AgentInterruption } from '@series-inc/rundot-agent';
import { chatReducer, initialChatState, type ChatMessage } from './chatState.ts';

const assistant = (): ChatMessage => ({
    id: 'assistant-1',
    role: 'assistant',
    text: '',
    createdAt: 1,
    status: 'streaming',
});

describe('chatReducer', () => {
    it('builds one streaming assistant message from ordered deltas', () => {
        const started = chatReducer(initialChatState, {
            type: 'assistant_started',
            message: assistant(),
        });
        const first = chatReducer(started, { type: 'text_delta', delta: 'Meet me ' });
        const second = chatReducer(first, { type: 'text_delta', delta: 'by the fire.' });
        const finished = chatReducer(second, {
            type: 'assistant_finished',
            text: 'fallback',
            interruptions: [],
        });

        expect(finished.messages).toEqual([
            expect.objectContaining({ text: 'Meet me by the fire.', status: 'complete' }),
        ]);
        expect(finished.connection).toBe('ready');
    });

    it('clears streamed text when a provider retry resets the stream', () => {
        const started = chatReducer(initialChatState, {
            type: 'assistant_started',
            message: assistant(),
        });
        const partial = chatReducer(started, { type: 'text_delta', delta: 'partial' });
        const reset = chatReducer(partial, { type: 'stream_reset' });

        expect(reset.messages[0]?.text).toBe('');
    });

    it('turns a storage conflict into a recoverable tab-conflict state', () => {
        const started = chatReducer(initialChatState, {
            type: 'assistant_started',
            message: assistant(),
        });
        const conflicted = chatReducer(started, { type: 'conflict' });

        expect(conflicted.connection).toBe('conflict');
        expect(conflicted.errorMessage).toContain('another tab');
        expect(conflicted.messages).toEqual([]);
    });

    it('keeps partial text when a conflict stops a stream', () => {
        const started = chatReducer(initialChatState, {
            type: 'assistant_started',
            message: assistant(),
        });
        const partial = chatReducer(started, { type: 'text_delta', delta: 'I can still' });
        const conflicted = chatReducer(partial, { type: 'conflict' });

        expect(conflicted.messages).toEqual([
            expect.objectContaining({ text: 'I can still', status: 'error' }),
        ]);
    });

    it('removes an empty assistant placeholder when the agent needs input', () => {
        const started = chatReducer(initialChatState, {
            type: 'assistant_started',
            message: assistant(),
        });
        const interruption: AgentInterruption = {
            id: 'question-1',
            kind: 'ask_user',
            runId: 'run-1',
            toolCallId: 'call-1',
            toolName: 'ask_user',
            input: {},
            prompt: 'Which route?',
            createdAt: 1,
            status: 'pending',
        };
        const interrupted = chatReducer(started, {
            type: 'assistant_finished',
            text: '',
            interruptions: [interruption],
        });

        expect(interrupted.messages).toEqual([]);
        expect(interrupted.interruptions).toEqual([interruption]);
    });

    it('restores pending decisions with the durable transcript', () => {
        const interruption: AgentInterruption = {
            id: 'question-2',
            kind: 'ask_user',
            runId: 'run-2',
            toolCallId: 'call-2',
            toolName: 'ask_user',
            input: {},
            prompt: 'Which route?',
            createdAt: 2,
            status: 'pending',
        };
        const ready = chatReducer(initialChatState, {
            type: 'ready',
            messages: [],
            interruptions: [interruption],
        });

        expect(ready.interruptions).toEqual([interruption]);
        expect(ready.connection).toBe('ready');
    });
});
