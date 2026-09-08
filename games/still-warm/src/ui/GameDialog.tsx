import { useEffect, useRef, type ReactNode } from "react";

function controls(dialog: HTMLElement): HTMLElement[] {
  return [
    ...dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), summary, a[href], [tabindex]:not([tabindex="-1"])',
    ),
  ].filter((element) => element.getClientRects().length > 0);
}

export function GameDialog({
  label,
  ending = false,
  children,
}: {
  label: string;
  ending?: boolean;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLElement>(null!);
  useEffect(() => {
    const previous = document.activeElement;
    (controls(dialog.current)[0] ?? dialog.current).focus({
      preventScroll: true,
    });
    return () => {
      if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus({ preventScroll: true });
    };
  }, []);

  return (
    <div className={`modal-shade${ending ? " ending" : ""}`}>
      <section
        ref={dialog}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key !== "Tab") return;
          const available = controls(event.currentTarget);
          const first = available[0];
          const last = available.at(-1);
          if (!first || !last) {
            event.preventDefault();
            return;
          }
          if (
            event.shiftKey &&
            (document.activeElement === first ||
              document.activeElement === event.currentTarget)
          ) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        }}
      >
        {children}
      </section>
    </div>
  );
}
