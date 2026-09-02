import { useRef, useState, type KeyboardEvent } from 'react';

interface ChatComposerProps {
    busy: boolean;
    disabled: boolean;
    disabledPlaceholder: string;
    onSend(text: string): Promise<void>;
    onStop(): void;
}

export default function ChatComposer({
    busy,
    disabled,
    disabledPlaceholder,
    onSend,
    onStop,
}: ChatComposerProps) {
    const [text, setText] = useState('');
    const inputRef = useRef<HTMLTextAreaElement>(null);

    const submit = (currentText = text): void => {
        const value = currentText.trim();
        if (!value || busy || disabled) return;
        setText('');
        void onSend(value).finally(() => inputRef.current?.focus());
    };

    const keyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            submit(event.currentTarget.value);
        }
    };

    return (
        <footer className="composer-wrap">
            <div className={`composer ${disabled ? 'composer-disabled' : ''}`}>
                <textarea
                    ref={inputRef}
                    rows={1}
                    value={text}
                    disabled={disabled}
                    maxLength={1_200}
                    aria-label="Message Mira"
                    placeholder={disabled ? disabledPlaceholder : 'Say something…'}
                    onChange={(event) => setText(event.target.value)}
                    onKeyDown={keyDown}
                />
                {busy ? (
                    <button className="send-button stop-button" type="button" onClick={onStop} aria-label="Stop response">
                        <span aria-hidden="true" />
                    </button>
                ) : (
                    <button
                        className="send-button"
                        type="button"
                        disabled={disabled || text.trim() === ''}
                        onClick={() => submit()}
                        aria-label="Send message"
                    >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="m4 12 15-7-4.5 14-3-5.5L4 12Zm7.5 1.5L19 5" />
                        </svg>
                    </button>
                )}
            </div>
            <p>Mira can use game tools. Important actions ask first.</p>
        </footer>
    );
}
