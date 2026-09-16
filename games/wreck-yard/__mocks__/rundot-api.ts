import { vi } from 'vitest';

const RundotAPI = {
  initializeAsync: vi.fn(async () => ({ initializeAsleep: false })),
  realtime: { boundary: 'realtime-mock' },
  preloader: { showLoadScreen: vi.fn(), hideLoadScreen: vi.fn() },
};

export default RundotAPI;
