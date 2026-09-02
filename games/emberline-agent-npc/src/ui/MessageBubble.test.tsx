import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import MessageBubble from './MessageBubble.tsx';

describe('MessageBubble', () => {
    it('renders an accessible three-dot indicator while Mira is thinking', () => {
        const markup = renderToStaticMarkup(
            <MessageBubble
                message={{
                    id: 'thinking',
                    role: 'assistant',
                    status: 'streaming',
                    text: '',
                    createdAt: 0,
                }}
            />,
        );

        expect(markup).toContain('aria-label="Mira is thinking"');
        expect(markup.match(/class="typing-dot"/g)).toHaveLength(3);
        expect(markup).not.toContain('···');
    });
});
