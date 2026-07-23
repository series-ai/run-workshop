import { useState, useCallback } from 'react';
import { Link2, ChevronDown, X } from 'lucide-react';
import type { ImageNode, WorkspaceAction } from './types';

interface NodeTreePanelProps {
  images: ImageNode[];
  selectedIds: Set<string>;
  dispatch: React.Dispatch<WorkspaceAction>;
}

function getDisplayName(img: ImageNode): string {
  return img.spriteName?.trim() || img.fileName.replace(/\.[^.]+$/, '');
}

interface TreeNode {
  image: ImageNode;
  children: TreeNode[];
}

function buildTree(images: ImageNode[]): TreeNode[] {
  const byId = new Map(images.map((img) => [img.id, img]));
  const childrenMap = new Map<string, ImageNode[]>();

  for (const img of images) {
    if (img.parentId && byId.has(img.parentId)) {
      const siblings = childrenMap.get(img.parentId) ?? [];
      siblings.push(img);
      childrenMap.set(img.parentId, siblings);
    }
  }

  function buildNode(img: ImageNode): TreeNode {
    const kids = (childrenMap.get(img.id) ?? [])
      .sort((a, b) => a.zIndex - b.zIndex)
      .map(buildNode);
    return { image: img, children: kids };
  }

  // Root nodes: no parent or parent not in images
  const roots = images
    .filter((img) => !img.parentId || !byId.has(img.parentId))
    .filter((img) => img.parentId || childrenMap.has(img.id) || images.some((c) => c.parentId === img.id))
    .sort((a, b) => a.zIndex - b.zIndex)
    .map(buildNode);

  return roots;
}

function TreeNodeItem({
  node,
  depth,
  selectedIds,
  dispatch,
  collapsed,
  onToggle,
}: {
  node: TreeNode;
  depth: number;
  selectedIds: Set<string>;
  dispatch: React.Dispatch<WorkspaceAction>;
  collapsed: Set<string>;
  onToggle: (id: string) => void;
}) {
  const isSelected = selectedIds.has(node.image.id);
  const hasChildren = node.children.length > 0;
  const isCollapsed = collapsed.has(node.image.id);
  const isChild = !!node.image.parentId;

  return (
    <>
      <div
        className={`node-tree-item${isSelected ? ' node-tree-item-selected' : ''}`}
        style={{ paddingLeft: 8 + depth * 16 }}
        onClick={() => dispatch({ type: 'SELECT', id: node.image.id, additive: false })}
      >
        {hasChildren ? (
          <button
            className="node-tree-expand"
            onClick={(e) => { e.stopPropagation(); onToggle(node.image.id); }}
          >
            <ChevronDown size={10} style={{ transform: isCollapsed ? 'rotate(-90deg)' : undefined, transition: 'transform 0.1s' }} />
          </button>
        ) : (
          <span className="node-tree-expand-spacer" />
        )}
        <span className="node-tree-label" title={node.image.fileName}>
          {getDisplayName(node.image)}
        </span>
        {isChild && (
          <>
            <span className="node-tree-badge">{node.image.layerOrder === 'below' ? 'B' : 'A'}</span>
            <button
              className="node-tree-detach"
              onClick={(e) => {
                e.stopPropagation();
                dispatch({ type: 'DETACH_FROM_PARENT', childId: node.image.id });
              }}
              title="Detach from parent"
            >
              <X size={10} />
            </button>
          </>
        )}
      </div>
      {hasChildren && !isCollapsed && node.children.map((child) => (
        <TreeNodeItem
          key={child.image.id}
          node={child}
          depth={depth + 1}
          selectedIds={selectedIds}
          dispatch={dispatch}
          collapsed={collapsed}
          onToggle={onToggle}
        />
      ))}
    </>
  );
}

export function NodeTreePanel({ images, selectedIds, dispatch }: NodeTreePanelProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [minimized, setMinimized] = useState(false);

  const onToggle = useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const tree = buildTree(images);

  // Only show if a selected element is part of a rig
  const hasRelevantSelection = selectedIds.size > 0 && (() => {
    for (const id of selectedIds) {
      const img = images.find((i) => i.id === id);
      if (!img) continue;
      // Selected element is a child
      if (img.parentId) return true;
      // Selected element is a parent
      if (images.some((i) => i.parentId === img.id)) return true;
    }
    return false;
  })();
  if (!hasRelevantSelection) return null;

  return (
    <div className="node-tree-panel" onPointerDown={(e) => e.stopPropagation()}>
      <div className="node-tree-header" onClick={() => setMinimized((v) => !v)}>
        <Link2 size={12} />
        <span>Node Tree</span>
        <ChevronDown size={10} style={{ marginLeft: 'auto', transform: minimized ? 'rotate(-90deg)' : undefined, transition: 'transform 0.1s' }} />
      </div>
      {!minimized && (
        <div className="node-tree-body">
          {tree.map((root) => (
            <TreeNodeItem
              key={root.image.id}
              node={root}
              depth={0}
              selectedIds={selectedIds}
              dispatch={dispatch}
              collapsed={collapsed}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}
