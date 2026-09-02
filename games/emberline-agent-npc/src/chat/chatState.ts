import type { AgentInterruption } from '@series-inc/rundot-agent';

export type ChatConnection =
    | 'connecting'
    | 'ready'
    | 'thinking'
    | 'conflict'
    | 'error';

export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    text: string;
    createdAt: number;
    status: 'complete' | 'streaming' | 'error';
}

export interface ChatActivity {
    id: string;
    label: string;
    status: 'running' | 'complete' | 'error';
}

export interface ChatState {
    connection: ChatConnection;
    messages: ChatMessage[];
    activities: ChatActivity[];
    interruptions: AgentInterruption[];
    activeAssistantId: string | null;
    errorMessage: string | null;
    lastPrompt: string | null;
}

export type ChatAction =
    | { type: 'connecting' }
    | { type: 'ready'; messages: ChatMessage[]; interruptions?: AgentInterruption[] }
    | { type: 'user_submitted'; message: ChatMessage }
    | { type: 'assistant_started'; message: ChatMessage }
    | { type: 'text_delta'; delta: string }
    | { type: 'stream_reset' }
    | { type: 'assistant_finished'; text: string; interruptions: AgentInterruption[] }
    | { type: 'activity_started'; id: string; label: string }
    | { type: 'activity_finished'; id: string; failed: boolean }
    | { type: 'status'; label: string }
    | { type: 'conflict' }
    | { type: 'failed'; message: string }
    | { type: 'dismiss_error' };

export const initialChatState: ChatState = {
    connection: 'connecting',
    messages: [],
    activities: [],
    interruptions: [],
    activeAssistantId: null,
    errorMessage: null,
    lastPrompt: null,
};

const updateActiveAssistant = (
    state: ChatState,
    update: (message: ChatMessage) => ChatMessage,
): ChatMessage[] => state.messages.map((message) =>
    message.id === state.activeAssistantId ? update(message) : message,
);

const failActiveAssistant = (state: ChatState): ChatMessage[] => {
    const active = state.messages.find((message) => message.id === state.activeAssistantId);
    if (active?.text === '') {
        return state.messages.filter((message) => message.id !== state.activeAssistantId);
    }
    return updateActiveAssistant(state, (message) => ({ ...message, status: 'error' }));
};

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
    switch (action.type) {
        case 'connecting':
            return { ...state, connection: 'connecting', errorMessage: null };
        case 'ready':
            return {
                ...initialChatState,
                connection: 'ready',
                messages: action.messages,
                interruptions: action.interruptions ?? [],
            };
        case 'user_submitted':
            return {
                ...state,
                connection: 'thinking',
                messages: [...state.messages, action.message],
                activities: [],
                interruptions: [],
                errorMessage: null,
                lastPrompt: action.message.text,
            };
        case 'assistant_started':
            return {
                ...state,
                connection: 'thinking',
                messages: [...state.messages, action.message],
                activeAssistantId: action.message.id,
                activities: [],
                interruptions: [],
                errorMessage: null,
            };
        case 'text_delta':
            return {
                ...state,
                messages: updateActiveAssistant(state, (message) => ({
                    ...message,
                    text: message.text + action.delta,
                })),
            };
        case 'stream_reset':
            return {
                ...state,
                messages: updateActiveAssistant(state, (message) => ({ ...message, text: '' })),
            };
        case 'assistant_finished':
            if (
                action.interruptions.length > 0 &&
                state.messages.find((message) => message.id === state.activeAssistantId)?.text === '' &&
                action.text === ''
            ) {
                return {
                    ...state,
                    connection: 'ready',
                    messages: state.messages.filter((message) => message.id !== state.activeAssistantId),
                    activeAssistantId: null,
                    interruptions: action.interruptions,
                };
            }
            return {
                ...state,
                connection: 'ready',
                messages: updateActiveAssistant(state, (message) => ({
                    ...message,
                    text: message.text || action.text,
                    status: 'complete',
                })),
                activeAssistantId: null,
                interruptions: action.interruptions,
            };
        case 'activity_started':
            return {
                ...state,
                activities: [
                    ...state.activities.filter((item) => item.id !== action.id),
                    { id: action.id, label: action.label, status: 'running' },
                ],
            };
        case 'activity_finished':
            return {
                ...state,
                activities: state.activities.map((item) => item.id === action.id
                    ? { ...item, status: action.failed ? 'error' : 'complete' }
                    : item),
            };
        case 'status':
            return {
                ...state,
                activities: [
                    ...state.activities,
                    { id: `status-${state.activities.length}`, label: action.label, status: 'running' },
                ],
            };
        case 'conflict':
            return {
                ...state,
                connection: 'conflict',
                activeAssistantId: null,
                errorMessage: 'This conversation continued in another tab or device.',
                messages: failActiveAssistant(state),
            };
        case 'failed':
            return {
                ...state,
                connection: 'error',
                activeAssistantId: null,
                errorMessage: action.message,
                messages: failActiveAssistant(state),
            };
        case 'dismiss_error':
            return { ...state, connection: 'ready', errorMessage: null };
    }
}
