import RundotGameAPI from '@series-inc/rundot-game-sdk/api';
import {
    createAgent,
    createAskUserTool,
    defineAgentTool,
    type Agent,
    type AgentMessage,
    type AgentSession,
    type AgentValidationResult,
} from '@series-inc/rundot-agent';
import {
    createTextGenTransport,
    createVenusSessionStore,
} from '@series-inc/rundot-agent/venus';
import type { ChatMessage } from '../chat/chatState.ts';
import { OfflineNpcTransport } from './offlineNpcTransport.ts';
import { RuntimeCoordinator } from './runtimeCoordinator.ts';

export const NPC_SESSION_ID = 'emberline-mira-v1';

interface QuestInput {
    questId: 'signal-in-the-fog';
}

interface NpcRuntime {
    agent: Agent;
    session: AgentSession;
}

const validateQuest = (input: unknown): AgentValidationResult<QuestInput> => {
    if (
        typeof input === 'object' &&
        input !== null &&
        'questId' in input &&
        input.questId === 'signal-in-the-fog'
    ) {
        return { success: true, value: { questId: 'signal-in-the-fog' } };
    }
    return {
        success: false,
        issues: [{ path: 'questId', message: 'Expected signal-in-the-fog' }],
    };
};

const noInput = (input: unknown): AgentValidationResult<Record<string, never>> => {
    if (typeof input === 'object' && input !== null && Object.keys(input).length === 0) {
        return { success: true, value: {} };
    }
    return { success: false, issues: [{ path: 'root', message: 'Expected no input' }] };
};

const world = {
    location: 'Emberwatch camp, at the edge of the listening marsh',
    weather: 'A warm rain is starting',
    localTime: 'Late evening',
    nearby: ['Mira the signal keeper', 'a low campfire', 'a silent radio tower'],
    openQuest: 'signal-in-the-fog',
};

const createNpc = (): Agent => createAgent({
    model: import.meta.env.MODE === 'offline'
        ? new OfflineNpcTransport()
        : createTextGenTransport(RundotGameAPI.textGen, {
            mode: 'open',
            modelClass: 'standard',
        }),
    models: [{
        id: 'claude-sonnet-4-6',
        contextWindow: 200_000,
        tier: 'standard',
    }],
    instructions: [
        'You are Mira, the signal keeper at Emberwatch camp.',
        'Speak with warmth, restraint, and specific knowledge of the marsh.',
        'Keep most replies under three short paragraphs.',
        'Use look_around when the player asks about the current scene.',
        'Use ask_user when one clear player choice is needed.',
        'Use accept_quest only after the player clearly asks to take the quest.',
        'Never claim that a game action happened unless its tool result says it happened.',
    ].join(' '),
    tools: {
        look_around: defineAgentTool({
            description: 'Read the current scene around Mira and the player.',
            inputSchema: {
                type: 'object',
                properties: {},
                additionalProperties: false,
            },
            validate: noInput,
            execute: () => world,
        }),
        accept_quest: defineAgentTool<QuestInput, { accepted: true; title: string }>({
            description: 'Accept Mira’s signal-in-the-fog quest for the player.',
            inputSchema: {
                type: 'object',
                properties: {
                    questId: { type: 'string', const: 'signal-in-the-fog' },
                },
                required: ['questId'],
                additionalProperties: false,
            },
            validate: validateQuest,
            approval: 'always',
            idempotency: 'none',
            execute: () => ({ accepted: true, title: 'Signal in the Fog' }),
        }),
        ask_user: createAskUserTool({
            description: 'Ask the player one short question before continuing.',
        }),
    },
    store: createVenusSessionStore(RundotGameAPI.appStorage, {
        namespace: 'agent-reference/emberline',
        concurrency: 'compare_and_swap',
    }),
    concurrency: 'reject',
    maxTurns: 12,
});

const isConflict = (error: unknown): boolean =>
    typeof error === 'object' && error !== null && 'code' in error && error.code === 'CONFLICT';

const openOrCreate = async (agent: Agent): Promise<AgentSession> => {
    const exists = (await agent.listSessions()).some((item) => item.id === NPC_SESSION_ID);
    if (exists) return agent.openSession(NPC_SESSION_ID);
    try {
        return await agent.createSession({ id: NPC_SESSION_ID, name: 'Mira at Emberwatch' });
    } catch (error) {
        if (!isConflict(error)) throw error;
        return agent.openSession(NPC_SESSION_ID);
    }
};

const createRuntime = async (): Promise<NpcRuntime> => {
    const agent = createNpc();
    const session = await openOrCreate(agent);
    return { agent, session };
};

const runtimeCoordinator = new RuntimeCoordinator<NpcRuntime>({
    create: createRuntime,
    close: runtime => runtime.session.close(),
    remove: runtime => runtime.agent.deleteSession(NPC_SESSION_ID),
});

export const getNpcRuntime = (): Promise<NpcRuntime> => runtimeCoordinator.get();

export const reopenNpcRuntime = (): Promise<NpcRuntime> => runtimeCoordinator.reopen();

export const resetNpcRuntime = (): Promise<NpcRuntime> => runtimeCoordinator.reset();

const contentText = (message: AgentMessage): string => message.content
    .map((part) => (part.type === 'text' ? part.text : ''))
    .join('');

export const displayMessages = (messages: AgentMessage[]): ChatMessage[] => messages
    .filter((message) => message.role === 'user' || message.role === 'assistant')
    .map((message, index) => ({
        id: `history-${index}`,
        role: message.role as 'user' | 'assistant',
        text: contentText(message),
        createdAt: message.timestamp,
        status: 'complete' as const,
    }))
    .filter((message) => message.text.trim() !== '');

export const errorCode = (error: unknown): string | null =>
    typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string'
        ? error.code
        : null;
