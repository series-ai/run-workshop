import { afterEach, beforeEach, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// @testing-library/react v16 defaults to StrictMode which double-renders,
// causing "Found multiple elements" failures. Disable for compatibility.
configure({ reactStrictMode: false });

// URL.createObjectURL — jsdom doesn't implement it; needed by the preload runtime
Object.defineProperty(URL, 'createObjectURL', {
  writable: true,
  value: vi.fn((_blob: Blob) => 'blob:mock/asset'),
});
Object.defineProperty(URL, 'revokeObjectURL', {
  writable: true,
  value: vi.fn(),
});

// requestAnimationFrame — needed by R3F components
vi.stubGlobal(
  'requestAnimationFrame',
  vi.fn((callback: FrameRequestCallback) => setTimeout(() => callback(performance.now()), 16) as unknown as number),
);
vi.stubGlobal('cancelAnimationFrame', vi.fn((id: number) => clearTimeout(id)));

// ResizeObserver — jsdom doesn't implement it; react-use-measure throws
// without a polyfill, which cascades through @react-three/fiber's Canvas
// mount path. Stub once here since R3F ships in the baseline template.
if (typeof globalThis.ResizeObserver === 'undefined') {
  class MockResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  vi.stubGlobal('ResizeObserver', MockResizeObserver);
}

// RundotAPI — vi.mock() is correct here; the SDK's SandboxHost requires
// Firebase + browser infrastructure that doesn't work in jsdom. Pattern
// matches teahouse/src/__tests__/setup.ts in venus-content.
vi.mock('@series-inc/rundot-game-sdk/api', () => ({
  default: {
    isMock: () => true,
    initializeAsync: vi.fn().mockResolvedValue({ initializeAsleep: false }),
    getProfile: vi.fn().mockReturnValue({ id: 'mock_user', username: 'MockUser', isAnonymous: false }),
    isAvailable: vi.fn().mockReturnValue(true),
    error: vi.fn(),
    log: vi.fn(),
    warn: vi.fn(),
    triggerHapticAsync: vi.fn().mockResolvedValue(undefined),
    getLocale: vi.fn().mockReturnValue('en-US'),
    getLanguageCode: vi.fn().mockReturnValue('en'),
    requestTimeAsync: vi.fn().mockResolvedValue({
      serverTime: Date.now(),
      localTime: Date.now(),
      timezoneOffset: 0,
      formattedTime: new Date().toISOString(),
      locale: 'en-US',
    }),
    formatTime: vi.fn().mockReturnValue(''),
    formatNumber: vi.fn().mockReturnValue('0'),
    getFutureTimeAsync: vi.fn().mockResolvedValue(Date.now()),
    getExperiment: vi.fn().mockResolvedValue(null),
    getFeatureFlag: vi.fn().mockResolvedValue(false),
    getFeatureGate: vi.fn().mockResolvedValue(false),
    pushAppAsync: vi.fn().mockResolvedValue(undefined),
    popAppAsync: vi.fn().mockResolvedValue(undefined),
    getStackInfo: vi.fn().mockReturnValue({ isInStack: false, stackPosition: 0 }),
    requestPopOrQuit: vi.fn().mockResolvedValue(true),
    cdn: {
      fetchAsset: vi.fn().mockResolvedValue(new Blob(['mock'])),
      resolveAssetUrl: vi.fn().mockReturnValue('https://cdn.mock/asset'),
      resolveAvatarAssetUrl: vi.fn().mockReturnValue('https://cdn.mock/avatar/asset'),
      resolveSharedLibUrl: vi.fn().mockReturnValue('https://cdn.mock/shared/lib'),
      getAssetCdnBaseUrl: vi.fn().mockReturnValue('https://cdn.mock/'),
      fetchFromCdn: vi.fn().mockResolvedValue(new Blob(['mock'])),
    },
    appStorage: {
      getItem: vi.fn().mockResolvedValue(null),
      setItem: vi.fn().mockResolvedValue(undefined),
      removeItem: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn().mockResolvedValue(undefined),
      length: vi.fn().mockResolvedValue(0),
      key: vi.fn().mockResolvedValue(null),
      getAllItems: vi.fn().mockResolvedValue([]),
      getAllData: vi.fn().mockResolvedValue({}),
      setMultipleItems: vi.fn().mockResolvedValue(undefined),
      removeMultipleItems: vi.fn().mockResolvedValue(undefined),
    },
    deviceCache: {
      getItem: vi.fn().mockResolvedValue(null),
      setItem: vi.fn().mockResolvedValue(undefined),
      removeItem: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn().mockResolvedValue(undefined),
      length: vi.fn().mockResolvedValue(0),
      key: vi.fn().mockResolvedValue(null),
    },
    globalStorage: {
      getItem: vi.fn().mockResolvedValue(null),
      setItem: vi.fn().mockResolvedValue(undefined),
      removeItem: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn().mockResolvedValue(undefined),
      length: vi.fn().mockResolvedValue(0),
      key: vi.fn().mockResolvedValue(null),
    },
    analytics: {
      recordCustomEvent: vi.fn(),
      trackFunnelStep: vi.fn(),
    },
    ads: {
      isRewardedAdReadyAsync: vi.fn().mockResolvedValue(true),
      showRewardedAdAsync: vi.fn().mockResolvedValue(true),
      showInterstitialAd: vi.fn().mockResolvedValue(true),
    },
    iap: {
      getHardCurrencyBalance: vi.fn().mockResolvedValue(0),
      getCurrencyIcon: vi.fn().mockResolvedValue({ base64Data: '' }),
      spendCurrency: vi.fn().mockResolvedValue({ success: true }),
      openStore: vi.fn().mockResolvedValue({ purchased: false, newBalance: 0 }),
      isUserSubscribed: vi.fn().mockResolvedValue(false),
      getSubscriptions: vi.fn().mockResolvedValue({}),
      purchaseSubscription: vi.fn().mockResolvedValue({ success: false }),
      hasUserMadePurchase: vi.fn().mockResolvedValue(false),
    },
    entitlements: {
      listEntitlements: vi.fn().mockResolvedValue([]),
      getQuantity: vi.fn().mockResolvedValue(0),
      consumeEntitlement: vi.fn().mockResolvedValue({
        entitlementId: 'mock_entitlement',
        userId: 'mock_user',
        gameId: 'mock_game',
        itemId: '',
        quantity: 0,
        consumable: true,
        status: 'active',
        expiresAt: null,
        createdAt: 0,
        updatedAt: 0,
        revokedAt: null,
      }),
      getLedger: vi.fn().mockResolvedValue([]),
    },
    leaderboard: {
      createScoreToken: vi.fn().mockResolvedValue({
        token: 'mock_token',
        startTime: 0,
        expiresAt: 300000,
        sealingNonce: null,
        sealingSecret: null,
        mode: 'default',
      }),
      submitScore: vi.fn().mockResolvedValue({ accepted: true, rank: null }),
      getPodiumScores: vi.fn().mockResolvedValue({
        variant: 'highlight',
        entries: [],
        totalEntries: 0,
        periodInstance: '',
        playerRank: null,
        context: {},
      }),
      getPagedScores: vi.fn().mockResolvedValue({
        variant: 'standard',
        entries: [],
        totalEntries: 0,
        periodInstance: '',
        playerRank: null,
      }),
      getMyRank: vi.fn().mockResolvedValue({
        rank: null,
        score: 0,
        totalPlayers: 0,
        percentile: undefined,
        trustScore: 1,
        periodInstance: '',
      }),
    },
    simulation: {
      isEnabled: vi.fn().mockReturnValue(false),
      getStateAsync: vi.fn().mockResolvedValue({ entities: {}, activeRuns: [], disabledRecipes: [] }),
      getConfigAsync: vi.fn().mockResolvedValue({}),
      executeRecipeAsync: vi.fn().mockResolvedValue({ success: true, runId: 'mock_run' }),
      getActiveRunsAsync: vi.fn().mockResolvedValue([]),
      collectRecipeAsync: vi.fn().mockResolvedValue({ success: true, runId: 'mock_run', rewards: {}, message: '' }),
      executeScopedRecipeAsync: vi.fn().mockResolvedValue({ success: true, message: '' }),
      triggerRecipeChainAsync: vi.fn().mockResolvedValue({ success: true }),
      getAvailableRecipesAsync: vi.fn().mockResolvedValue({ success: true, recipes: [] }),
      getRecipeRequirementsAsync: vi.fn().mockResolvedValue({}),
      getBatchRecipeRequirementsAsync: vi.fn().mockResolvedValue({ success: true, results: [] }),
      resolveFieldValueAsync: vi.fn().mockResolvedValue(null),
      getEntityMetadataAsync: vi.fn().mockResolvedValue({}),
      subscribeAsync: vi.fn().mockResolvedValue(() => {}),
      resetStateAsync: vi.fn().mockResolvedValue({ success: true, clearedRuns: 0, clearedSlots: 0, recipeExecuted: null }),
    },
    rooms: {
      createRoomAsync: vi.fn().mockResolvedValue({ roomId: 'mock_room' }),
      joinOrCreateRoomAsync: vi.fn().mockResolvedValue({ action: 'created', room: { roomId: 'mock_room' }, playersJoined: 1 }),
      joinRoomByCodeAsync: vi.fn().mockResolvedValue({ roomId: 'mock_room' }),
      getUserRoomsAsync: vi.fn().mockResolvedValue([]),
      subscribeAsync: vi.fn().mockResolvedValue(() => {}),
      updateRoomDataAsync: vi.fn().mockResolvedValue(undefined),
      getRoomDataAsync: vi.fn().mockResolvedValue({}),
      sendRoomMessageAsync: vi.fn().mockResolvedValue('mock_message_id'),
      leaveRoomAsync: vi.fn().mockResolvedValue(undefined),
      kickPlayerAsync: vi.fn().mockResolvedValue(undefined),
      startRoomGameAsync: vi.fn().mockResolvedValue(undefined),
      proposeMoveAsync: vi.fn().mockResolvedValue({ proposedMoveId: 'mock_move_id' }),
      validateMoveAsync: vi.fn().mockResolvedValue({ success: true, moveId: 'mock_move', isValid: true }),
    },
    system: {
      getSafeArea: vi.fn().mockReturnValue({ top: 0, bottom: 0, left: 0, right: 0 }),
      getDevice: vi.fn().mockReturnValue({
        screenSize: { width: 390, height: 844 },
        viewportSize: { width: 390, height: 844 },
        orientation: 'portrait',
        pixelRatio: 2,
        fontScale: 1,
        deviceType: 'phone',
        hapticsEnabled: false,
        haptics: { supported: false, enabled: false },
      }),
      getEnvironment: vi.fn().mockReturnValue({
        platform: 'web',
        isDevelopment: true,
        platformVersion: '1.0.0',
        capabilities: { ads: true, purchases: true },
      }),
      isMobile: vi.fn().mockReturnValue(false),
      isWeb: vi.fn().mockReturnValue(true),
    },
    popups: {
      showToast: vi.fn().mockResolvedValue(true),
    },
    notifications: {
      scheduleAsync: vi.fn().mockResolvedValue('mock_notification_id'),
      cancelNotification: vi.fn().mockResolvedValue(true),
      getAllScheduledLocalNotifications: vi.fn().mockResolvedValue([]),
      isLocalNotificationsEnabled: vi.fn().mockResolvedValue(true),
      setLocalNotificationsEnabled: vi.fn().mockResolvedValue(true),
    },
    lifecycles: {
      onAwake: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
      onSleep: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
      onPause: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
      onResume: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
      onQuit: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
    },
    social: {
      shareLinkAsync: vi.fn().mockResolvedValue({ shareUrl: 'https://mock.share/link', shareLinkId: 'mock-share-link-id' }),
      createQRCodeAsync: vi.fn().mockResolvedValue({ shareUrl: 'https://mock.share/link', qrCode: 'data:image/png;base64,mock', shareLinkId: 'mock-share-link-id' }),
      addShareClickDataAsync: vi.fn().mockResolvedValue(undefined),
      getShareClicksAsync: vi.fn().mockResolvedValue({ clicks: [], truncated: false }),
      getMyShareClickDataAsync: vi.fn().mockResolvedValue(null),
    },
    ai: {
      requestChatCompletionAsync: vi.fn().mockResolvedValue({ content: '', model: '', usage: {} }),
      getAvailableCompletionModels: vi.fn().mockResolvedValue([]),
    },
    ugc: {
      create: vi.fn().mockResolvedValue({ id: 'mock_ugc' }),
      update: vi.fn().mockResolvedValue({ id: 'mock_ugc' }),
      delete: vi.fn().mockResolvedValue(undefined),
      get: vi.fn().mockResolvedValue(null),
      listMine: vi.fn().mockResolvedValue({ entries: [] }),
      browse: vi.fn().mockResolvedValue({ entries: [] }),
      like: vi.fn().mockResolvedValue(undefined),
      unlike: vi.fn().mockResolvedValue(undefined),
      recordUse: vi.fn().mockResolvedValue(undefined),
      report: vi.fn().mockResolvedValue(undefined),
    },
    imageGen: {
      generate: vi.fn().mockResolvedValue({ imageUrl: 'https://mock.image/gen.png', prompt: '' }),
    },
    preloader: {
      showLoadScreen: vi.fn().mockResolvedValue(undefined),
      hideLoadScreen: vi.fn().mockResolvedValue(undefined),
      setLoaderText: vi.fn().mockResolvedValue(undefined),
      setLoaderProgress: vi.fn().mockResolvedValue(undefined),
    },
    sharedAssets: {
      loadAssetsBundle: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
    },
    app: {
      getMyRole: vi.fn().mockResolvedValue('none'),
      resolveLaunchIntent: vi.fn().mockResolvedValue({ kind: 'none', params: {} }),
    },
    context: {
      initializeAsleep: false,
      launchParams: undefined,
      shareParams: undefined,
      notificationParams: undefined,
      shareLinkId: undefined,
    },
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

// @testing-library/react v16 does not auto-cleanup in vitest.
// Without this, rendered DOM from one test leaks into the next,
// causing "Found multiple elements" failures.
afterEach(() => {
  cleanup();
});
