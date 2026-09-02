import { useMemo, useRef, useState } from 'react';
import type { AgentDecision, AgentInterruption } from '@series-inc/rundot-agent';

interface DecisionTrayProps {
    interruptions: AgentInterruption[];
    disabled: boolean;
    onSubmit(decisions: AgentDecision[]): Promise<void>;
}

type Choice = 'approve' | 'reject';

export default function DecisionTray({ interruptions, disabled, onSubmit }: DecisionTrayProps) {
    const [choices, setChoices] = useState<Record<string, Choice>>({});
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const submittingRef = useRef(false);
    const [submitting, setSubmitting] = useState(false);
    const needsApproval = interruptions.some((item) => item.kind === 'tool_approval');
    const blocked = disabled || submitting;

    const complete = useMemo(() => interruptions.every((item) => item.kind === 'ask_user'
        ? (answers[item.id]?.trim().length ?? 0) > 0
        : choices[item.id] !== undefined), [answers, choices, interruptions]);

    const submit = async (): Promise<void> => {
        if (!complete || disabled || submittingRef.current) return;
        submittingRef.current = true;
        setSubmitting(true);
        const decisions: AgentDecision[] = interruptions.map((item) => {
            const decisionId = `decision-${crypto.randomUUID()}`;
            if (item.kind === 'ask_user') {
                return {
                    interruptionId: item.id,
                    decisionId,
                    type: 'respond',
                    response: answers[item.id]?.trim() ?? '',
                };
            }
            return choices[item.id] === 'approve'
                ? { interruptionId: item.id, decisionId, type: 'approve' }
                : {
                    interruptionId: item.id,
                    decisionId,
                    type: 'reject',
                    reason: 'The player declined this action.',
                };
        });
        try {
            await onSubmit(decisions);
        } finally {
            submittingRef.current = false;
            setSubmitting(false);
        }
    };

    return (
        <section className="decision-tray" aria-label="Mira needs your input">
            <div className="decision-heading">
                <span aria-hidden="true">✦</span>
                <div>
                    <p className="eyebrow">{needsApproval ? 'CONFIRM ACTION' : 'YOUR CHOICE'}</p>
                    <h2>{needsApproval ? 'Mira wants to act' : 'Mira needs your answer'}</h2>
                </div>
            </div>
            {interruptions.map((item) => (
                <div className="decision-card" key={item.id}>
                    <p className="decision-prompt">
                        {item.prompt ?? (item.kind === 'tool_approval'
                            ? `Allow “${item.toolName.replaceAll('_', ' ')}”?`
                            : 'What would you like to say?')}
                    </p>
                    {item.kind === 'ask_user' ? (
                        <input
                            value={answers[item.id] ?? ''}
                            placeholder="Type your answer"
                            aria-label="Answer Mira"
                            disabled={blocked}
                            onChange={(event) => setAnswers((current) => ({
                                ...current,
                                [item.id]: event.target.value,
                            }))}
                        />
                    ) : (
                        <div className="choice-row">
                            <button
                                type="button"
                                disabled={blocked}
                                className={choices[item.id] === 'reject' ? 'selected' : ''}
                                onClick={() => setChoices((current) => ({ ...current, [item.id]: 'reject' }))}
                            >
                                Not now
                            </button>
                            <button
                                type="button"
                                disabled={blocked}
                                className={choices[item.id] === 'approve' ? 'selected primary-choice' : 'primary-choice'}
                                onClick={() => setChoices((current) => ({ ...current, [item.id]: 'approve' }))}
                            >
                                Allow
                            </button>
                        </div>
                    )}
                    <details>
                        <summary>Action details</summary>
                        <pre>{JSON.stringify(item.input, null, 2)}</pre>
                    </details>
                </div>
            ))}
            <button
                className="continue-button"
                type="button"
                disabled={!complete || blocked}
                onClick={() => { void submit(); }}
            >
                Continue conversation
            </button>
        </section>
    );
}
