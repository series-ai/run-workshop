import { useCallback, useEffect, useReducer, useRef } from 'react';
import type {
    AgentDecision,
    AgentEvent,
    AgentRunResult,
    AgentSession,
} from '@series-inc/rundot-agent';
import {
    displayMessages,
    errorCode,
    getNpcRuntime,
    reopenNpcRuntime,
    resetNpcRuntime,
} from '../agent/npcAgent.ts';
import {
    chatReducer,
    initialChatState,
    type ChatMessage,
} from './chatState.ts';

const id = (prefix: string): string => `${prefix}-${crypto.randomUUID()}`;

const toolLabel = (name: string): string => ({
    look_around: 'Checking the camp',
    accept_quest: 'Adding the quest',
    ask_user: 'Waiting for your answer',
}[name] ?? `Using ${name.replaceAll('_', ' ')}`);

export function useNpcChat() {
    const [state, dispatch] = useReducer(chatReducer, initialChatState);
    const sessionRef = useRef<AgentSession | null>(null);
    const abortRef = useRef<AbortController | null>(null);
    const lastPromptRef = useRef<string | null>(null);

    const loadRuntime = useCallback(async (reopen: boolean): Promise<void> => {
        dispatch({ type: 'connecting' });
        try {
            const runtime = reopen ? await reopenNpcRuntime() : await getNpcRuntime();
            sessionRef.current = runtime.session;
            const messages = displayMessages(await runtime.session.getMessages());
            dispatch({
                type: 'ready',
                messages,
                interruptions: runtime.session.state.interruptions
                    .filter((item) => item.status === 'pending'),
            });
        } catch (error) {
            dispatch({
                type: 'failed',
                message: error instanceof Error ? error.message : 'The conversation could not open.',
            });
        }
    }, []);

    useEffect(() => {
        void loadRuntime(false);
        const pause = () => abortRef.current?.abort('The RUN host paused the game.');
        window.addEventListener('run-agent-pause', pause);
        return () => window.removeEventListener('run-agent-pause', pause);
    }, [loadRuntime]);

    const applyEvent = useCallback((event: AgentEvent): void => {
        switch (event.type) {
            case 'text_delta':
                dispatch({ type: 'text_delta', delta: event.delta });
                break;
            case 'model_stream_reset':
                dispatch({ type: 'stream_reset' });
                break;
            case 'tool_started':
                dispatch({
                    type: 'activity_started',
                    id: event.callId,
                    label: toolLabel(event.toolName),
                });
                break;
            case 'tool_finished':
                dispatch({
                    type: 'activity_finished',
                    id: event.callId,
                    failed: event.isError,
                });
                break;
            case 'retry_scheduled':
                dispatch({ type: 'status', label: `Retrying · attempt ${event.attempt}` });
                break;
            case 'model_fallback':
                dispatch({ type: 'status', label: 'Switching model' });
                break;
            case 'compaction_started':
                dispatch({
                    type: 'activity_started',
                    id: 'compaction',
                    label: 'Summarizing older messages',
                });
                break;
            case 'compaction_finished':
                dispatch({ type: 'activity_finished', id: 'compaction', failed: false });
                break;
            case 'compaction_failed':
                dispatch({ type: 'activity_finished', id: 'compaction', failed: true });
                break;
            default:
                break;
        }
    }, []);

    const run = useCallback(async (
        action: (session: AgentSession, signal: AbortSignal) => Promise<AgentRunResult>,
    ): Promise<void> => {
        dispatch({
            type: 'assistant_started',
            message: {
                id: id('assistant'),
                role: 'assistant',
                text: '',
                createdAt: Date.now(),
                status: 'streaming',
            },
        });
        const controller = new AbortController();
        abortRef.current = controller;
        try {
            const session = sessionRef.current ?? (await getNpcRuntime()).session;
            sessionRef.current = session;
            const unsubscribe = session.subscribe(applyEvent);
            let result: AgentRunResult;
            try {
                result = await action(session, controller.signal);
            } finally {
                unsubscribe();
            }
            if (result.finishReason === 'error') {
                dispatch({
                    type: 'failed',
                    message: result.error?.message ?? 'Mira could not answer.',
                });
                return;
            }
            dispatch({
                type: 'assistant_finished',
                text: result.text,
                interruptions: result.interruptions,
            });
        } catch (error) {
            if (errorCode(error) === 'CONFLICT') {
                dispatch({ type: 'conflict' });
            } else if (controller.signal.aborted) {
                dispatch({ type: 'assistant_finished', text: 'Stopped.', interruptions: [] });
            } else {
                dispatch({
                    type: 'failed',
                    message: error instanceof Error ? error.message : 'Mira could not answer.',
                });
            }
        } finally {
            if (abortRef.current === controller) abortRef.current = null;
        }
    }, [applyEvent]);

    const send = useCallback(async (text: string): Promise<void> => {
        const prompt = text.trim();
        if (!prompt || state.connection === 'thinking') return;
        lastPromptRef.current = prompt;
        const message: ChatMessage = {
            id: id('user'),
            role: 'user',
            text: prompt,
            createdAt: Date.now(),
            status: 'complete',
        };
        dispatch({ type: 'user_submitted', message });
        await run((session, signal) => session.send({ text: prompt }, { signal }));
    }, [run, state.connection]);

    const resume = useCallback(async (decisions: AgentDecision[]): Promise<void> => {
        if (decisions.length === 0 || state.connection === 'thinking') return;
        await run((session, signal) => session.resume(decisions, { signal }));
    }, [run, state.connection]);

    const retry = useCallback(async (): Promise<void> => {
        if (lastPromptRef.current) await send(lastPromptRef.current);
    }, [send]);

    const reopen = useCallback(async (): Promise<void> => loadRuntime(true), [loadRuntime]);

    const reset = useCallback(async (): Promise<void> => {
        abortRef.current?.abort('Conversation reset.');
        dispatch({ type: 'connecting' });
        try {
            const runtime = await resetNpcRuntime();
            sessionRef.current = runtime.session;
            lastPromptRef.current = null;
            dispatch({ type: 'ready', messages: [] });
        } catch (error) {
            dispatch({
                type: 'failed',
                message: error instanceof Error ? error.message : 'The conversation could not reset.',
            });
        }
    }, []);

    return {
        state,
        send,
        resume,
        retry,
        reopen,
        reset,
        stop: () => abortRef.current?.abort('Stopped by the player.'),
        dismissError: () => dispatch({ type: 'dismiss_error' }),
    };
}
