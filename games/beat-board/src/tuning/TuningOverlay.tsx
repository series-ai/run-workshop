import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { Button, Panel } from '@modules/ui/skin/semantic'
import {
  listRegisteredTunables,
  subscribeToTuningRegistry,
} from './registry'
import type { TunableDescriptor } from './registry'
import {
  loadTuningOverlayPreference,
  subscribeToTuningOverlayState,
  getTuningOverlayState,
} from './state'
import { NumberControl } from './controls/NumberControl'
import { BooleanControl } from './controls/BooleanControl'
import { StringControl } from './controls/StringControl'
import { ColorControl } from './controls/ColorControl'
import { Vec3Control } from './controls/Vec3Control'

interface FolderNode {
  path: string
  name: string
  children: Map<string, FolderNode>
  descriptors: TunableDescriptor[]
}

function createFolderNode(path: string, name: string): FolderNode {
  return {
    path,
    name,
    children: new Map(),
    descriptors: [],
  }
}

function buildFolderTree(descriptors: TunableDescriptor[]): FolderNode {
  const root = createFolderNode('', '')

  descriptors.forEach((descriptor) => {
    if (descriptor.enabled === false) return

    const segments = descriptor.folder
      .split('/')
      .map((segment) => segment.trim())
      .filter((segment) => segment.length > 0)

    if (segments.length === 0) {
      root.descriptors.push(descriptor)
      return
    }

    let currentNode = root
    let currentPath = ''
    segments.forEach((segment, index) => {
      currentPath = currentPath === '' ? segment : `${currentPath}/${segment}`
      let next = currentNode.children.get(segment)
      if (!next) {
        next = createFolderNode(currentPath, segment)
        currentNode.children.set(segment, next)
      }
      if (index === segments.length - 1) {
        next.descriptors.push(descriptor)
      }
      currentNode = next
    })
  })

  return root
}

function renderControl(descriptor: TunableDescriptor) {
  if (descriptor.type === 'number') {
    return <NumberControl key={descriptor.id} descriptor={descriptor} />
  }
  if (descriptor.type === 'boolean') {
    return <BooleanControl key={descriptor.id} descriptor={descriptor} />
  }
  if (descriptor.type === 'string') {
    return <StringControl key={descriptor.id} descriptor={descriptor} />
  }
  if (descriptor.type === 'color') {
    return <ColorControl key={descriptor.id} descriptor={descriptor} />
  }
  if (descriptor.type === 'vec3') {
    return <Vec3Control key={descriptor.id} descriptor={descriptor} />
  }
  return null
}

interface FolderSectionProps {
  node: FolderNode
  collapsedPaths: Set<string>
  onToggle: (path: string) => void
}

function FolderSection({ node, collapsedPaths, onToggle }: FolderSectionProps) {
  const isCollapsed = collapsedPaths.has(node.path)
  const childNodes = [...node.children.values()].sort((a, b) =>
    a.name.localeCompare(b.name),
  )

  return (
    <div
      data-testid={`tuning-folder-${node.path}`}
      className="tuning-overlay__folder"
      data-collapsed={isCollapsed ? 'true' : 'false'}
    >
      <button
        type="button"
        className="tuning-overlay__folder-header"
        data-testid={`tuning-folder-toggle-${node.path}`}
        onClick={() => onToggle(node.path)}
        aria-expanded={!isCollapsed}
      >
        <span>{isCollapsed ? '▸' : '▾'}</span> {node.name}
      </button>
      {isCollapsed ? null : (
        <div className="tuning-overlay__folder-body">
          {node.descriptors.map((descriptor) => renderControl(descriptor))}
          {childNodes.map((child) => (
            <FolderSection
              key={child.path}
              node={child}
              collapsedPaths={collapsedPaths}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function useRegisteredTunables(): TunableDescriptor[] {
  const [descriptors, setDescriptors] = useState<TunableDescriptor[]>(() =>
    listRegisteredTunables(),
  )

  useEffect(() => {
    setDescriptors(listRegisteredTunables())
    return subscribeToTuningRegistry(() => {
      setDescriptors(listRegisteredTunables())
    })
  }, [])

  return descriptors
}

function useOverlayVisible(): boolean {
  const [visible, setVisible] = useState<boolean>(
    () => getTuningOverlayState().visible,
  )

  useEffect(() => {
    void loadTuningOverlayPreference()
    setVisible(getTuningOverlayState().visible)
    return subscribeToTuningOverlayState(() => {
      setVisible(getTuningOverlayState().visible)
    })
  }, [])

  return visible
}

interface DragState {
  offsetX: number
  offsetY: number
}

export function TuningOverlay() {
  const visible = useOverlayVisible()
  if (!visible) return null
  return <VisibleOverlay />
}

function VisibleOverlay() {
  const descriptors = useRegisteredTunables()
  const tree = useMemo(() => buildFolderTree(descriptors), [descriptors])
  const rootChildren = useMemo(
    () =>
      [...tree.children.values()].sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
    [tree],
  )

  const [collapsedPaths, setCollapsedPaths] = useState<Set<string>>(
    () => new Set(),
  )
  const toggleCollapsed = useCallback((path: string) => {
    setCollapsedPaths((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }, [])

  const [minimized, setMinimized] = useState<boolean>(false)
  const [position, setPosition] = useState<{ x: number; y: number }>({
    x: 16,
    y: 16,
  })
  const [dragState, setDragState] = useState<DragState | null>(null)

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const target = event.currentTarget
    target.setPointerCapture(event.pointerId)
    setDragState({
      offsetX: event.clientX - position.x,
      offsetY: event.clientY - position.y,
    })
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragState) return
    setPosition({
      x: event.clientX - dragState.offsetX,
      y: event.clientY - dragState.offsetY,
    })
  }

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const target = event.currentTarget
    if (target.hasPointerCapture(event.pointerId)) {
      target.releasePointerCapture(event.pointerId)
    }
    setDragState(null)
  }

  const containerStyle: CSSProperties = {
    position: 'fixed',
    inset: 0,
    pointerEvents: 'none',
    zIndex: 1000,
  }
  const panelStyle: CSSProperties = {
    position: 'absolute',
    left: position.x,
    top: position.y,
    pointerEvents: 'auto',
    minWidth: minimized ? undefined : 280,
    maxWidth: 360,
  }

  if (minimized) {
    return (
      <div style={containerStyle} data-testid="tuning-overlay-container">
        <Panel
          data-testid="tuning-overlay"
          data-minimized="true"
          className="tuning-overlay tuning-overlay--minimized"
          style={panelStyle}
        >
          <button
            type="button"
            data-testid="tuning-overlay-expand"
            onClick={() => setMinimized(false)}
          >
            Tuning
          </button>
        </Panel>
      </div>
    )
  }

  return (
    <div style={containerStyle} data-testid="tuning-overlay-container">
      <Panel
        data-testid="tuning-overlay"
        className="tuning-overlay"
        style={panelStyle}
      >
        <div
          className="tuning-overlay__header"
          data-testid="tuning-overlay-header"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          style={{ cursor: dragState ? 'grabbing' : 'grab' }}
        >
          <span>Tuning</span>
          <Button.Ghost
            data-testid="tuning-overlay-minimize"
            onClick={() => setMinimized(true)}
          >
            —
          </Button.Ghost>
        </div>
        <div className="tuning-overlay__body">
          {descriptors.length === 0 ? (
            <div className="tuning-overlay__empty">No tunables registered</div>
          ) : (
            <>
              {tree.descriptors.map((descriptor) => renderControl(descriptor))}
              {rootChildren.map((child) => (
                <FolderSection
                  key={child.path}
                  node={child}
                  collapsedPaths={collapsedPaths}
                  onToggle={toggleCollapsed}
                />
              ))}
            </>
          )}
        </div>
      </Panel>
    </div>
  )
}
