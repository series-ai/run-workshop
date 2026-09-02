import { useEffect, useRef, useState } from 'react';
import type { AgentDecision } from '@series-inc/rundot-agent';
import { useNpcChat } from '../chat/useNpcChat.ts';
import ChatComposer from './ChatComposer.tsx';
import DecisionTray from './DecisionTray.tsx';
import MessageBubble from './MessageBubble.tsx';

const starters = [
    'What is that tower listening for?',
    'Look around. What has changed tonight?',
    'Help me choose which path to take.',
    'I want to take the signal job.',
];

const connectionLabel = {
    connecting: 'Restoring conversation',
    ready: 'At the fire',
    thinking: 'Mira is thinking',
    conflict: 'Open elsewhere',
    error: 'Connection problem',
} as const;

export default function App() {
    const { state, send, resume, retry, reopen, reset, stop, dismissError } = useNpcChat();
    const [showReset, setShowReset] = useState(false);
    const endRef = useRef<HTMLDivElement>(null);
    const decisionPending = state.interruptions.length > 0;

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, [state.messages, state.activities, state.interruptions]);

    const decide = async (decisions: AgentDecision[]): Promise<void> => {
        await resume(decisions);
    };

    return (
        <main id="app-frame" className="chat-app">
            <div className="atmosphere" aria-hidden="true">
                <div className="moon" />
                <div className="tower"><span /><span /><span /></div>
                <div className="mist mist-one" />
                <div className="mist mist-two" />
                <div className="fire-glow" />
            </div>

            <section className="chat-panel" aria-label="Conversation with Mira">
                <header className="npc-header">
                    <div className="npc-avatar" aria-hidden="true">
                        <span className="avatar-ring" />
                        <span className="avatar-face">M</span>
                    </div>
                    <div className="npc-title">
                        <div className="eyebrow">EMBERWATCH · SIGNAL KEEPER</div>
                        <h1>Mira</h1>
                        <div className="connection-state" aria-live="polite">
                            <span className={`status-dot status-${state.connection}`} />
                            {connectionLabel[state.connection]}
                        </div>
                    </div>
                    <button
                        className="icon-button"
                        type="button"
                        aria-label="Conversation options"
                        aria-expanded={showReset}
                        onClick={() => setShowReset((value) => !value)}
                    >
                        <span aria-hidden="true">•••</span>
                    </button>
                    {showReset && (
                        <div className="conversation-menu">
                            <p>Start a new conversation with Mira?</p>
                            <div>
                                <button type="button" onClick={() => setShowReset(false)}>Cancel</button>
                                <button
                                    className="danger-action"
                                    type="button"
                                    onClick={() => {
                                        setShowReset(false);
                                        void reset();
                                    }}
                                >
                                    Start over
                                </button>
                            </div>
                        </div>
                    )}
                </header>

                <div className="message-scroll" role="log" aria-live="polite" aria-relevant="additions text">
                    {state.messages.length === 0 && state.connection !== 'connecting' && (
                        <div className="welcome-card">
                            <div className="welcome-mark" aria-hidden="true">⌁</div>
                            <p className="eyebrow">THE FIRE IS STILL WARM</p>
                            <h2>A voice waits in the rain.</h2>
                            <p>
                                Mira keeps watch over an old radio tower. Ask about the marsh,
                                follow a signal, or stay for a quiet story.
                            </p>
                        </div>
                    )}

                    {state.messages.map((message) => (
                        <MessageBubble key={message.id} message={message} />
                    ))}

                    {state.activities.length > 0 && (
                        <div className="activity-list" aria-label="Agent activity">
                            {state.activities.map((activity) => (
                                <div className={`activity activity-${activity.status}`} key={activity.id}>
                                    <span className="activity-icon" aria-hidden="true">
                                        {activity.status === 'running' ? '◌' : activity.status === 'error' ? '!' : '✓'}
                                    </span>
                                    {activity.label}
                                </div>
                            ))}
                        </div>
                    )}

                    {state.interruptions.length > 0 && (
                        <DecisionTray
                            interruptions={state.interruptions}
                            disabled={state.connection === 'thinking'}
                            onSubmit={decide}
                        />
                    )}

                    {state.connection === 'connecting' && (
                        <div className="restore-state">
                            <span className="spinner" aria-hidden="true" />
                            Restoring the campfire…
                        </div>
                    )}
                    <div ref={endRef} />
                </div>

                {state.connection === 'conflict' && (
                    <div className="notice notice-conflict" role="alert">
                        <div>
                            <strong>This chat moved in another tab.</strong>
                            <span>Reload the latest messages before you continue.</span>
                        </div>
                        <button type="button" onClick={() => void reopen()}>Load latest</button>
                    </div>
                )}

                {state.connection === 'error' && (
                    <div className="notice notice-error" role="alert">
                        <div>
                            <strong>Mira lost the signal.</strong>
                            <span>{state.errorMessage}</span>
                        </div>
                        <div className="notice-actions">
                            <button type="button" onClick={dismissError}>Dismiss</button>
                            <button type="button" onClick={() => void retry()}>Try again</button>
                        </div>
                    </div>
                )}

                {state.messages.length === 0 && state.connection === 'ready' && (
                    <div className="starter-row" aria-label="Conversation starters">
                        {starters.map((starter) => (
                            <button type="button" key={starter} onClick={() => void send(starter)}>
                                {starter}
                            </button>
                        ))}
                    </div>
                )}

                <ChatComposer
                    busy={state.connection === 'thinking'}
                    disabled={
                        state.connection === 'connecting' ||
                        state.connection === 'conflict' ||
                        decisionPending
                    }
                    disabledPlaceholder={decisionPending
                        ? 'Answer Mira above'
                        : 'Load the latest conversation first'}
                    onSend={send}
                    onStop={stop}
                />
            </section>
        </main>
    );
}
