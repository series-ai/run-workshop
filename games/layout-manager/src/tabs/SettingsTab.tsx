import { useState, useEffect } from 'react';
import RundotGameAPI from '@series-inc/rundot-game-sdk/api';
import { Card } from '../components/Card';

export const SettingsTab: React.FC = () => {
  const [userId, setUserId] = useState<string | null>(null);
  const [device, setDevice] = useState<ReturnType<typeof RundotGameAPI.system.getDevice> | null>(
    null,
  );
  const [environment, setEnvironment] = useState<ReturnType<
    typeof RundotGameAPI.system.getEnvironment
  > | null>(null);

  useEffect(() => {
    const loadData = async (): Promise<void> => {
      try {
        setDevice(RundotGameAPI.system.getDevice());
        setEnvironment(RundotGameAPI.system.getEnvironment());

        const profile = await RundotGameAPI.getProfile();
        setUserId(profile.id);
      } catch (error) {
        RundotGameAPI.error('[SettingsTab] Error loading SDK data:', error);
      }
    };

    loadData();
  }, []);

  if (!device || !environment) {
    return (
      <Card title="Loading...">
        <p style={{ fontSize: '13px', textAlign: 'center' }}>Loading device info...</p>
      </Card>
    );
  }

  return (
    <>
      <Card title="Device Info">
        <div className="info-item">
          <span className="info-label">Platform:</span>
          <span className="info-value">{environment.platform}</span>
        </div>
        <div className="info-item">
          <span className="info-label">Screen:</span>
          <span className="info-value">
            {device.screenSize.width} × {device.screenSize.height}
          </span>
        </div>
        <div className="info-item">
          <span className="info-label">Orientation:</span>
          <span className="info-value">{device.orientation}</span>
        </div>
        <div className="info-item">
          <span className="info-label">Haptics:</span>
          <span className="info-value">{device.hapticsEnabled ? 'Enabled' : 'Disabled'}</span>
        </div>
      </Card>

      <Card title="Environment">
        <div className="info-item">
          <span className="info-label">Mock Mode:</span>
          <span className="info-value">{RundotGameAPI.isMock() ? 'Yes' : 'No'}</span>
        </div>
        <div className="info-item">
          <span className="info-label">Development:</span>
          <span className="info-value">{environment.isDevelopment ? 'Yes' : 'No'}</span>
        </div>
        <div className="info-item">
          <span className="info-label">Platform Version:</span>
          <span className="info-value">{environment.platformVersion}</span>
        </div>
        <div className="info-item">
          <span className="info-label">User ID:</span>
          <span className="info-value">{userId || 'N/A'}</span>
        </div>
      </Card>
    </>
  );
};
