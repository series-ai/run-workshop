// Stub module for @series-inc/rundot-game-sdk/api
// This file exists so that vite/vitest can statically resolve the import.
// The actual mock is configured in vitest.setup.ts via vi.mock().

export interface LeaderboardEntry {
  profileId: string
  username: string
  avatarUrl: string | null
  score: number
  duration: number
  submittedAt: number
  rank: number | null
}

export interface LeaderboardState {
  entries: LeaderboardEntry[]
  myRank: number | null
  totalPlayers: number
  periodInstance: string | null
  isLoading: boolean
  lastSubmitAccepted: boolean | null
}

export interface ShareClickData {
  clickerProfileId: string
  metadata: Record<string, string>
  createdAt: number
  updatedAt: number
}

const RundotAPI = {
  isMock: (): boolean => true,
  initializeAsync: (_options?: {
    helpText?: string
    hardDisableMock?: boolean
    mock?: Record<string, unknown>
    usePreloader?: boolean
    launchParams?: Record<string, string>
    shareParams?: Record<string, string>
    notificationParams?: Record<string, string>
  }): Promise<{
    initializeAsleep: boolean
    launchParams?: Record<string, string>
    shareParams?: Record<string, string>
    notificationParams?: Record<string, string>
  }> => Promise.resolve({ initializeAsleep: false }),
  getProfile: (): {
    id: string
    username: string
    name?: string
    avatarUrl?: string | null
    isAnonymous?: boolean
  } => ({ id: 'mock_user', username: 'MockUser', isAnonymous: false }),
  isAvailable: (): boolean => true,
  error: (_message: string, ..._args: unknown[]): void => undefined,
  log: (_message: string, ..._args: unknown[]): void => undefined,
  warn: (_message: string, ..._args: unknown[]): void => undefined,
  logging: {
    logDebug: (_message: string, _context?: Record<string, unknown>): void => undefined,
    logError: (_message: string, _context?: Record<string, unknown>): void => undefined,
  },
  triggerHapticAsync: (_style: string): Promise<void> => Promise.resolve(undefined),
  getLocale: (): string => 'en-US',
  getLanguageCode: (): string => 'en',
  requestTimeAsync: (): Promise<{
    serverTime: number
    localTime: number
    timezoneOffset: number
    formattedTime: string
    locale: string
  }> => Promise.resolve({
    serverTime: Date.now(),
    localTime: Date.now(),
    timezoneOffset: 0,
    formattedTime: new Date().toISOString(),
    locale: 'en-US',
  }),
  formatTime: (_timestamp: number, _options?: unknown): string => '',
  formatNumber: (_value: number, _options?: Intl.NumberFormatOptions): string => '0',
  getFutureTimeAsync: (_options: {
    days?: number
    hours?: number
    minutes?: number
    timeOfDay?: { hour: number; minute: number; second: number }
    timezone?: unknown
  }): Promise<number> => Promise.resolve(Date.now()),
  getExperiment: (_options: { experimentName: string }): Promise<unknown> =>
    Promise.resolve(null),
  getFeatureFlag: (_options: { flagName: string }): Promise<unknown> =>
    Promise.resolve(false),
  getFeatureGate: (_options: { gateName: string }): Promise<unknown> =>
    Promise.resolve(false),
  pushAppAsync: (
    _appId: string,
    _options?: { contextData?: unknown; appParams?: unknown },
  ): Promise<unknown> => Promise.resolve(undefined),
  popAppAsync: (): Promise<void> => Promise.resolve(undefined),
  getStackInfo: (): { isInStack: boolean; stackPosition: number } => ({
    isInStack: false,
    stackPosition: 0,
  }),
  requestPopOrQuit: (
    _options?: { reason?: string; forceClose?: boolean },
  ): Promise<boolean> => Promise.resolve(true),

  cdn: {
    fetchAsset: (_assetPath: string, _options?: { timeout?: number }): Promise<Blob> =>
      Promise.resolve(new Blob(['mock'])),
    resolveAssetUrl: (_subPath: string): string => `https://cdn.mock/${_subPath}`,
    resolveAvatarAssetUrl: (_subPath: string): string => `https://cdn.mock/avatar/${_subPath}`,
    resolveSharedLibUrl: (_subPath: string): string => `https://cdn.mock/shared/${_subPath}`,
    getAssetCdnBaseUrl: (): string => 'https://cdn.mock/',
    fetchFromCdn: (_subPath: string, _options?: { timeout?: number }): Promise<Blob> =>
      Promise.resolve(new Blob(['mock'])),
  },

  appStorage: {
    getItem: (_key: string): Promise<string | null> => Promise.resolve(null),
    setItem: (_key: string, _value: string): Promise<void> => Promise.resolve(undefined),
    removeItem: (_key: string): Promise<void> => Promise.resolve(undefined),
    clear: (): Promise<void> => Promise.resolve(undefined),
    length: (): Promise<number> => Promise.resolve(0),
    key: (_index: number): Promise<string | null> => Promise.resolve(null),
    getAllItems: (): Promise<string[]> => Promise.resolve([]),
    getAllData: (): Promise<Record<string, string>> => Promise.resolve({}),
    setMultipleItems: (_items: { key: string; value: string }[]): Promise<void> =>
      Promise.resolve(undefined),
    removeMultipleItems: (_keys: string[]): Promise<void> => Promise.resolve(undefined),
  },

  deviceCache: {
    getItem: (_key: string): Promise<string | null> => Promise.resolve(null),
    setItem: (_key: string, _value: string): Promise<void> => Promise.resolve(undefined),
    removeItem: (_key: string): Promise<void> => Promise.resolve(undefined),
    clear: (): Promise<void> => Promise.resolve(undefined),
    length: (): Promise<number> => Promise.resolve(0),
    key: (_index: number): Promise<string | null> => Promise.resolve(null),
  },

  globalStorage: {
    getItem: (_key: string): Promise<string | null> => Promise.resolve(null),
    setItem: (_key: string, _value: string): Promise<void> => Promise.resolve(undefined),
    removeItem: (_key: string): Promise<void> => Promise.resolve(undefined),
    clear: (): Promise<void> => Promise.resolve(undefined),
    length: (): Promise<number> => Promise.resolve(0),
    key: (_index: number): Promise<string | null> => Promise.resolve(null),
  },

  analytics: {
    recordCustomEvent: (_name: string, _props?: Record<string, unknown>): void => undefined,
    trackFunnelStep: (
      _step: number,
      _stepName: string,
      _funnelName?: string,
      _funnelOrder?: number,
    ): void => undefined,
  },

  ads: {
    isRewardedAdReadyAsync: (): Promise<boolean> => Promise.resolve(true),
    showRewardedAdAsync: (
      _options?: { adDisplayId?: string; adDisplayName?: string },
    ): Promise<boolean> => Promise.resolve(true),
    showInterstitialAd: (
      _options?: { adDisplayId?: string; adDisplayName?: string },
    ): Promise<boolean> => Promise.resolve(true),
  },

  iap: {
    getHardCurrencyBalance: (): Promise<number> => Promise.resolve(0),
    getCurrencyIcon: (): Promise<{ base64Data: string }> =>
      Promise.resolve({ base64Data: '' }),
    spendCurrency: (
      _productId: string,
      _amount: number,
      _options?: { screenName?: string },
    ): Promise<{ success: boolean; newBalance: number }> =>
      Promise.resolve({ success: true, newBalance: 0 }),
    openStore: (): Promise<void> => Promise.resolve(undefined),
    isUserSubscribed: (_tier: string): Promise<boolean> => Promise.resolve(false),
    getSubscriptions: (
      _tier?: string,
    ): Promise<Record<string, Array<{ interval: string; price: number; currencyCode: string; description: string }>>> =>
      Promise.resolve({}),
    purchaseSubscription: (
      _tier: string,
      _interval: string,
    ): Promise<{ success: boolean }> => Promise.resolve({ success: false }),
    hasUserMadePurchase: (): Promise<boolean> => Promise.resolve(false),
  },

  entitlements: {
    listEntitlements: (): Promise<never[]> => Promise.resolve([]),
    getQuantity: (_itemId: string): Promise<number> => Promise.resolve(0),
    consumeEntitlement: (
      _itemId: string,
      _quantity: number,
      _callback?: (entitlement: unknown, referenceId: string) => void,
      _reason?: string,
      _referenceId?: string,
    ): Promise<{
      entitlementId: string
      userId: string
      gameId: string
      itemId: string
      quantity: number
      consumable: boolean
      status: string
      expiresAt: number | null
      createdAt: number
      updatedAt: number
      revokedAt: number | null
    }> =>
      Promise.resolve({
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
    getLedger: (
      _itemId?: string,
      _limit?: number,
      _startAfter?: number,
    ): Promise<never[]> => Promise.resolve([]),
  },

  leaderboard: {
    createScoreToken: (
      _mode?: string,
    ): Promise<{
      token: string
      startTime: number
      expiresAt: number
      sealingNonce?: string | null
      sealingSecret?: string | null
      mode: string
    }> =>
      Promise.resolve({
        token: 'mock_token',
        startTime: Date.now(),
        expiresAt: Date.now() + 300000,
        sealingNonce: null,
        sealingSecret: null,
        mode: 'default',
      }),
    submitScore: (_params: {
      token?: string
      score: number
      duration: number
      mode?: string
      telemetry?: Record<string, unknown>
      metadata?: Record<string, unknown>
    }): Promise<{
      accepted: boolean
      rank?: number | null
      zScore?: number | null
      isAnomaly?: boolean
    }> => Promise.resolve({ accepted: true, rank: null }),
    getPodiumScores: (_params?: {
      topCount?: number
      contextAhead?: number
      contextBehind?: number
      mode?: string
      period?: string
    }): Promise<{
      variant: string
      entries: LeaderboardEntry[]
      totalEntries: number
      periodInstance: string
      playerRank: number | null
      context: unknown
    }> =>
      Promise.resolve({
        variant: 'highlight',
        entries: [],
        totalEntries: 0,
        periodInstance: '',
        playerRank: null,
        context: {},
      }),
    getPagedScores: (_params?: {
      mode?: string
      period?: string
      cursor?: string | null
      limit?: number
      variant?: string
      topCount?: number
    }): Promise<{
      variant: string
      entries: LeaderboardEntry[]
      nextCursor?: string | null
      totalEntries: number
      playerRank: number | null
      periodInstance: string
    }> =>
      Promise.resolve({
        variant: 'standard',
        entries: [],
        totalEntries: 0,
        periodInstance: '',
        playerRank: null,
      }),
    getMyRank: (_options?: {
      mode?: string
      period?: string
      periodDate?: number | string
    }): Promise<{
      rank: number | null
      score?: number
      totalPlayers: number
      percentile?: number
      trustScore: number
      periodInstance: string
    }> =>
      Promise.resolve({
        rank: null,
        score: 0,
        totalPlayers: 0,
        percentile: undefined,
        trustScore: 1,
        periodInstance: '',
      }),
  },

  simulation: {
    isEnabled: (): boolean => false,
    getStateAsync: (_roomId?: string): Promise<Record<string, unknown>> =>
      Promise.resolve({ entities: {}, activeRuns: [], disabledRecipes: [] }),
    getConfigAsync: (_roomId?: string): Promise<Record<string, unknown>> =>
      Promise.resolve({}),
    executeRecipeAsync: (
      _recipeId: string,
      _inputs?: Record<string, unknown>,
      _opts?: {
        roomId?: string
        batchAmount?: number
        allowPartialBatch?: boolean
        entity?: string
        nonce?: string
      },
    ): Promise<{ success: boolean; runId?: string; outputs?: Record<string, unknown> }> =>
      Promise.resolve({ success: true, runId: 'mock_run' }),
    getActiveRunsAsync: (
      _opts?: { roomId?: string },
    ): Promise<unknown[]> => Promise.resolve([]),
    collectRecipeAsync: (
      _runId: string,
    ): Promise<{
      success: boolean
      runId: string
      rewards: Record<string, unknown>
      message: string
    }> =>
      Promise.resolve({ success: true, runId: 'mock_run', rewards: {}, message: '' }),
    executeScopedRecipeAsync: (
      _recipeId: string,
      _entity: string,
      _inputs?: Record<string, unknown>,
      _opts?: { roomId?: string },
    ): Promise<{ success: boolean; message: string }> =>
      Promise.resolve({ success: true, message: '' }),
    triggerRecipeChainAsync: (
      _recipeId: string,
      _opts?: { roomId?: string; context?: Record<string, unknown> },
    ): Promise<{ success: boolean }> => Promise.resolve({ success: true }),
    getAvailableRecipesAsync: (
      _opts?: { roomId?: string; includeActorRecipes?: boolean },
    ): Promise<{ success: boolean; recipes: unknown[] }> =>
      Promise.resolve({ success: true, recipes: [] }),
    getRecipeRequirementsAsync: (_recipe: unknown): Promise<unknown> =>
      Promise.resolve({}),
    getBatchRecipeRequirementsAsync: (
      _recipes: unknown[],
    ): Promise<{ success: boolean; results: unknown[] }> =>
      Promise.resolve({ success: true, results: [] }),
    resolveFieldValueAsync: (
      _entityId: string,
      _fieldPath: string,
      _entity?: string,
    ): Promise<unknown> => Promise.resolve(null),
    getEntityMetadataAsync: (
      _entityId: string,
    ): Promise<Record<string, unknown>> => Promise.resolve({}),
    subscribeAsync: (_options: unknown): Promise<() => void> =>
      Promise.resolve(() => {}),
    resetStateAsync: (
      _options?: { initializeRecipe?: string },
    ): Promise<{
      success: boolean
      clearedRuns: number
      clearedSlots: number
      recipeExecuted: string | null
    }> =>
      Promise.resolve({
        success: true,
        clearedRuns: 0,
        clearedSlots: 0,
        recipeExecuted: null,
      }),
  },

  realtime: {
    createRoom: <P = unknown>(_roomType: string): Promise<{
      roomCode: string; playerId: string; locked: boolean; latency: number;
      connectionState: string; on: (_events: Record<string, unknown>) => void;
      send: (_message: P) => void; leave: () => void; getServerTime: () => number;
    }> => Promise.resolve({
      roomCode: 'MOCK01', playerId: 'mock_user', locked: false, latency: 20,
      connectionState: 'connected', on: () => {}, send: () => {}, leave: () => {},
      getServerTime: () => Date.now(),
    }),
    joinOrCreateRoom: <P = unknown>(_roomType: string): Promise<{
      roomCode: string; playerId: string; locked: boolean; latency: number;
      connectionState: string; on: (_events: Record<string, unknown>) => void;
      send: (_message: P) => void; leave: () => void; getServerTime: () => number;
    }> => Promise.resolve({
      roomCode: 'MOCK01', playerId: 'mock_user', locked: false, latency: 20,
      connectionState: 'connected', on: () => {}, send: () => {}, leave: () => {},
      getServerTime: () => Date.now(),
    }),
    joinRoomByCode: <P = unknown>(_code: string): Promise<{
      roomCode: string; playerId: string; locked: boolean; latency: number;
      connectionState: string; on: (_events: Record<string, unknown>) => void;
      send: (_message: P) => void; leave: () => void; getServerTime: () => number;
    }> => Promise.resolve({
      roomCode: 'MOCK01', playerId: 'mock_user', locked: false, latency: 20,
      connectionState: 'connected', on: () => {}, send: () => {}, leave: () => {},
      getServerTime: () => Date.now(),
    }),
  },

  rooms: {
    createRoomAsync: (_options?: unknown): Promise<unknown> =>
      Promise.resolve({ roomId: 'mock_room' }),
    joinOrCreateRoomAsync: (
      _options: unknown,
    ): Promise<{ action: string; room: unknown; playersJoined: number }> =>
      Promise.resolve({
        action: 'created',
        room: { roomId: 'mock_room' },
        playersJoined: 1,
      }),
    joinRoomByCodeAsync: (_roomCode: string): Promise<unknown> =>
      Promise.resolve({ roomId: 'mock_room' }),
    getUserRoomsAsync: (_options?: unknown): Promise<unknown[]> =>
      Promise.resolve([]),
    subscribeAsync: (
      _room: unknown,
      _options?: unknown,
    ): Promise<() => void> => Promise.resolve(() => {}),
    updateRoomDataAsync: (
      _room: unknown,
      _updates: Record<string, unknown>,
      _options?: unknown,
    ): Promise<void> => Promise.resolve(undefined),
    getRoomDataAsync: (_room: unknown): Promise<Record<string, unknown>> =>
      Promise.resolve({}),
    sendRoomMessageAsync: (
      _room: unknown,
      _message: unknown,
    ): Promise<string> => Promise.resolve('mock_message_id'),
    leaveRoomAsync: (_room: unknown): Promise<void> =>
      Promise.resolve(undefined),
    kickPlayerAsync: (
      _room: unknown,
      _targetProfileId: string,
      _options?: unknown,
    ): Promise<void> => Promise.resolve(undefined),
    startRoomGameAsync: (
      _room: unknown,
      _options?: unknown,
    ): Promise<void> => Promise.resolve(undefined),
    proposeMoveAsync: (
      _room: unknown,
      _request: unknown,
    ): Promise<{ proposedMoveId: string }> =>
      Promise.resolve({ proposedMoveId: 'mock_move_id' }),
    validateMoveAsync: (
      _room: unknown,
      _moveId: string,
      _verdict: unknown,
    ): Promise<{
      success: boolean
      moveId: string
      isValid: boolean
      reason?: string | null
    }> =>
      Promise.resolve({
        success: true,
        moveId: 'mock_move',
        isValid: true,
      }),
  },

  system: {
    getSafeArea: (): {
      top: number
      bottom: number
      left: number
      right: number
    } => ({ top: 0, bottom: 0, left: 0, right: 0 }),
    getDevice: (): {
      screenSize: { width: number; height: number }
      viewportSize: { width: number; height: number }
      orientation: string
      pixelRatio: number
      fontScale: number
      deviceType: string
      hapticsEnabled: boolean
      haptics: { supported: boolean; enabled: boolean }
    } => ({
      screenSize: { width: 390, height: 844 },
      viewportSize: { width: 390, height: 844 },
      orientation: 'portrait',
      pixelRatio: 2,
      fontScale: 1,
      deviceType: 'phone',
      hapticsEnabled: false,
      haptics: { supported: false, enabled: false },
    }),
    getEnvironment: (): {
      isDevelopment: boolean
      platform: string
      platformVersion: string
      capabilities: { ads: boolean; purchases: boolean }
    } => ({
      platform: 'web',
      isDevelopment: true,
      platformVersion: '1.0.0',
      capabilities: { ads: true, purchases: true },
    }),
    isMobile: (): boolean => false,
    isWeb: (): boolean => true,
  },

  popups: {
    showToast: (
      _message: string,
      _options?: {
        duration?: number
        variant?: 'success' | 'error' | 'warning' | 'info'
        action?: { label: string }
      },
    ): Promise<boolean> => Promise.resolve(true),
  },

  notifications: {
    scheduleAsync: (
      _title: string,
      _body: string,
      _seconds: number,
      _notificationId?: string,
      _options?: {
        priority?: number
        groupId?: string
        payload?: Record<string, unknown>
      },
    ): Promise<string | null> => Promise.resolve('mock_notification_id'),
    cancelNotification: (_id: string): Promise<boolean> =>
      Promise.resolve(true),
    getAllScheduledLocalNotifications: (): Promise<{ id: string }[]> =>
      Promise.resolve([]),
    isLocalNotificationsEnabled: (): Promise<boolean> => Promise.resolve(true),
    setLocalNotificationsEnabled: (_enabled: boolean): Promise<boolean> =>
      Promise.resolve(true),
  },

  lifecycles: {
    onAwake: (_cb: () => void): { unsubscribe: () => void } => ({
      unsubscribe: () => {},
    }),
    onSleep: (_cb: () => void): { unsubscribe: () => void } => ({
      unsubscribe: () => {},
    }),
    onPause: (_cb: () => void): { unsubscribe: () => void } => ({
      unsubscribe: () => {},
    }),
    onResume: (_cb: () => void): { unsubscribe: () => void } => ({
      unsubscribe: () => {},
    }),
    onQuit: (_cb: () => void): { unsubscribe: () => void } => ({
      unsubscribe: () => {},
    }),
  },

  social: {
    shareLinkAsync: (_params: {
      shareParams: Record<string, string>
      metadata?: { title?: string; description?: string; imageUrl?: string }
    }): Promise<{ shareUrl: string; shareLinkId: string }> =>
      Promise.resolve({ shareUrl: 'https://mock.share/link', shareLinkId: 'mock-share-link-id' }),
    createQRCodeAsync: (_params: {
      shareParams: Record<string, string>
      metadata?: { title?: string; description?: string; imageUrl?: string }
      qrOptions?: { size?: number; margin?: number; format?: string }
    }): Promise<{ shareUrl: string; qrCode: string; shareLinkId: string }> =>
      Promise.resolve({
        shareUrl: 'https://mock.share/link',
        qrCode: 'data:image/png;base64,mock',
        shareLinkId: 'mock-share-link-id',
      }),
    addShareClickDataAsync: (_params: {
      shareLinkId: string
      metadata?: Record<string, string>
    }): Promise<void> => Promise.resolve(),
    getShareClicksAsync: (_params: {
      shareLinkId: string
    }): Promise<{ clicks: ShareClickData[]; truncated: boolean }> =>
      Promise.resolve({ clicks: [], truncated: false }),
    getMyShareClickDataAsync: (_params: {
      shareLinkId: string
    }): Promise<ShareClickData | null> => Promise.resolve(null),
  },

  ai: {
    requestChatCompletionAsync: (_request: unknown): Promise<unknown> =>
      Promise.resolve({ content: '', model: '', usage: {} }),
    getAvailableCompletionModels: (): Promise<string[]> => Promise.resolve([]),
  },

  ugc: {
    create: (_params: unknown): Promise<unknown> => Promise.resolve({ id: 'mock_ugc' }),
    update: (_params: unknown): Promise<unknown> => Promise.resolve({ id: 'mock_ugc' }),
    delete: (_id: string): Promise<void> => Promise.resolve(undefined),
    get: (_id: string): Promise<unknown> => Promise.resolve(null),
    listMine: (_params?: unknown): Promise<{ entries: unknown[]; nextCursor?: string }> =>
      Promise.resolve({ entries: [] }),
    browse: (_params?: unknown): Promise<{ entries: unknown[]; nextCursor?: string }> =>
      Promise.resolve({ entries: [] }),
    like: (_id: string): Promise<void> => Promise.resolve(undefined),
    unlike: (_id: string): Promise<void> => Promise.resolve(undefined),
    recordUse: (_id: string): Promise<void> => Promise.resolve(undefined),
    report: (_params: unknown): Promise<void> => Promise.resolve(undefined),
    count: (_params?: unknown): Promise<{ count: number }> => Promise.resolve({ count: 0 }),
  },

  imageGen: {
    generate: (_params: {
      prompt: string
      negativePrompt?: string
      aspectRatio?: string
      referenceImages?: string[]
      seed?: number
    }): Promise<{ imageUrl: string; prompt: string }> =>
      Promise.resolve({ imageUrl: 'https://mock.image/gen.png', prompt: '' }),
  },

  preloader: {
    showLoadScreen: (): Promise<void> => Promise.resolve(undefined),
    hideLoadScreen: (): Promise<void> => Promise.resolve(undefined),
    setLoaderText: (_text: string): Promise<void> => Promise.resolve(undefined),
    setLoaderProgress: (_progress: number): Promise<void> => Promise.resolve(undefined),
  },

  sharedAssets: {
    loadAssetsBundle: (
      _game: string,
      _bundleKey: string,
    ): Promise<ArrayBuffer> => Promise.resolve(new ArrayBuffer(0)),
  },

  app: {
    getMyRole: (): Promise<'owner' | 'editor' | 'none'> => Promise.resolve('none'),
    resolveLaunchIntent: (
      _o?: { maxWaitMs?: number },
    ): Promise<{
      kind: 'share' | 'deeplink' | 'notification' | 'none' | 'timed_out'
      shareLinkId?: string
      sharerId?: string
      params: Record<string, string>
    }> => Promise.resolve({ kind: 'none', params: {} }),
  },

  context: {
    initializeAsleep: false as boolean,
    launchParams: undefined as Record<string, string> | undefined,
    shareParams: undefined as Record<string, string> | undefined,
    notificationParams: undefined as Record<string, string> | undefined,
    shareLinkId: undefined as string | undefined,
  },
}

export default RundotAPI
