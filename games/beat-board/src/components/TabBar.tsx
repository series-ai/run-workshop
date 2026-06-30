import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { NavRail, TabBar as SemanticTabBar } from '@modules/ui/skin';
import { appShellConfig } from '../shell/config';
import { resolveLayoutMode, type LayoutMode } from '../shell/layout';
import { listTabs } from '../shell/navigation';
import { NAVIGATION } from '../tabs/tabConfig';
import {
  useNavigationStore,
  useCurrentScreenId,
  useDesktopNavMode,
} from '../stores/navigationStore';

function getLayoutMode(): LayoutMode {
  if (typeof window === 'undefined') {
    return 'portrait';
  }
  return resolveLayoutMode(window.innerWidth, window.innerHeight, appShellConfig.orientation);
}

export const TabBar: React.FC = () => {
  const [layoutMode, setLayoutMode] = useState<LayoutMode>(getLayoutMode);
  const currentId = useCurrentScreenId();
  const desktopNavMode = useDesktopNavMode();
  const navigateTo = useNavigationStore((s) => s.navigateTo);
  const tabBarGate = useNavigationStore((s) => s.tabBarGate);

  useEffect(() => {
    const handleResize = () => setLayoutMode(getLayoutMode());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const disabled = tabBarGate === 'disabled';
  const items = listTabs(NAVIGATION).map(({ id, screen }) => ({
    id,
    label: screen.label!,
    iconName: screen.iconName!,
    disabled,
  }));

  if (layoutMode === 'landscape') {
    return (
      <NavRail
        activeId={currentId ?? NAVIGATION.initial}
        className={cn(
          'h-full',
          desktopNavMode === 'rail' ? 'template-nav-rail--compact' : 'template-nav-rail--sidebar',
        )}
        items={items}
        onSelect={disabled ? undefined : navigateTo}
      />
    );
  }

  return (
    <SemanticTabBar
      activeId={currentId ?? NAVIGATION.initial}
      items={items}
      onSelect={disabled ? undefined : navigateTo}
    />
  );
};
