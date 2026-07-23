import RundotGameAPI from '@series-inc/rundot-game-sdk/api';
import { TAB_CONFIG, type TabId } from '../tabs/tabConfig';

interface TabBarProps {
  /**
   * Currently active tab ID
   */
  activeTab: TabId;
  /**
   * Callback when tab is changed
   */
  onTabChange: (tabId: TabId) => void;
}

/**
 * Bottom navigation tab bar component (always visible)
 */
export const TabBar: React.FC<TabBarProps> = ({ activeTab, onTabChange }) => {
  const safeArea = RundotGameAPI.system.getSafeArea();

  return (
    <div className="tab-bar" style={{ paddingBottom: `${safeArea.bottom}px` }}>
      {TAB_CONFIG.map((tab) => (
        <button
          key={tab.id}
          className={`tab ${activeTab === tab.id ? 'active' : ''}`}
          onClick={() => onTabChange(tab.id)}
        >
          <div className="tab-icon">{tab.icon}</div>
          <div className="tab-label">{tab.label}</div>
        </button>
      ))}
    </div>
  );
};
