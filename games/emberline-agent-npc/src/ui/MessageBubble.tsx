import type { ChatMessage } from '../chat/chatState.ts';

const time = (timestamp: number): string => new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
}).format(timestamp);

export default function MessageBubble({ message }: { message: ChatMessage }) {
    const isNpc = message.role === 'assistant';
    const content = message.text || (message.status === 'streaming' ? (
        <span className="typing-indicator" role="status" aria-label="Mira is thinking">
            <span className="typing-dot" aria-hidden="true" />
            <span className="typing-dot" aria-hidden="true" />
            <span className="typing-dot" aria-hidden="true" />
        </span>
    ) : 'No reply');

    return (
        <article className={`message-row message-${message.role}`}>
            {isNpc && <div className="message-avatar" aria-hidden="true">M</div>}
            <div className={`message-bubble bubble-${message.status}`}>
                {isNpc && <div className="message-author">Mira</div>}
                <p>{content}</p>
                <time dateTime={new Date(message.createdAt).toISOString()}>
                    {time(message.createdAt)}
                </time>
            </div>
        </article>
    );
}
