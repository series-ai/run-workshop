import type { CSSProperties, HTMLAttributes, ReactNode } from 'react'
import { joinClassName } from './theme/classNames'
import { resolveTicketShellAsset } from './theme/rendererArt'
import { useUiTheme } from './theme/useUiTheme'

export interface SkinTicketProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  title: ReactNode
  subtitle?: ReactNode
  eyebrow?: ReactNode
  targetWidth?: number
}

export function SkinTicket({
  title,
  subtitle,
  eyebrow,
  targetWidth = 240,
  className,
  style,
  ...rest
}: SkinTicketProps) {
  const { rendererVariantId } = useUiTheme()
  const shellImage = resolveTicketShellAsset(rendererVariantId)
  const rendererBacked = Boolean(shellImage)

  return (
    <section
      {...rest}
      className={joinClassName('ui-ticket', className)}
      data-ui-renderer-backed={rendererBacked ? 'true' : 'false'}
      data-ui-renderer-mode={rendererBacked ? 'renderer-art' : 'css-theme'}
      data-ui-skin-role="frame.ticket"
      style={{
        '--ui-ticket-width': `${targetWidth}px`,
        ...style,
      } as CSSProperties}
    >
      {shellImage ? (
        <span className="ui-ticket__art" aria-hidden="true">
          <img alt="" src={shellImage} />
        </span>
      ) : null}
      <div className="ui-ticket__content">
        {eyebrow ? <div className="ui-ticket__eyebrow">{eyebrow}</div> : null}
        <div className="ui-ticket__title">{title}</div>
        {subtitle ? <div className="ui-ticket__subtitle">{subtitle}</div> : null}
      </div>
    </section>
  )
}
