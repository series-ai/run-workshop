// --- Types ---

export interface FeedbackContext {
  /** Intensity 0–1, modulated by player intensity * play() override. */
  intensity: number;
  /** Current playback direction for this entry. */
  direction: 'forward' | 'reverse';
  /** Milliseconds since this entry started its current execution. */
  elapsed: number;
  /** 0–1 progress within this entry's duration. 0 for instant entries. */
  progress: number;
}

export interface FeedbackTiming {
  /** Milliseconds before first play. Default: 0 */
  initialDelay?: number;
  /** Milliseconds how long this feedback runs. Default: 0 (instant). */
  duration?: number;
  /** Milliseconds minimum between plays of this entry. Default: 0 */
  cooldown?: number;
  /** 0 = no repeat, -1 = forever. Default: 0 */
  repeatCount?: number;
  /** Milliseconds gap between repeats. Default: 0 */
  delayBetweenRepeats?: number;
  /** Probability of execution 0–1. Default: 1 */
  chance?: number;
  /** Direction for this entry. Default: followPlayer */
  playDirection?: 'normal' | 'reverse' | 'followPlayer';
  /** When this entry should play relative to player direction. Default: always */
  onlyWhen?: 'always' | 'forward' | 'reverse';
  /** Sequential-only: pause until all previously launched entries finish. */
  holdingPause?: boolean;
  /** Sequential-only: timed delay (ms) — pauses sequential playback for N ms. */
  pauseDuration?: number;
  /** Sequential-only: mark this entry as a loop anchor point. */
  looperStart?: boolean;
  /** Sequential-only: loop back to the nearest looperStart. */
  looper?: { count: number };
  /** If true, this entry always uses intensity=1 regardless of player intensity. */
  constantIntensity?: boolean;
}

export interface FeedbackEntry {
  /** Optional ID. Auto-generated if not provided. */
  id?: string;
  /** Callback invoked each update while the entry is active. */
  callback: (context: FeedbackContext) => void;
  /** Timing configuration. */
  timing?: FeedbackTiming;
  /** Called by stop() to restore initial values. Uses 0C pattern. */
  onRestore?: () => void;
  /** Trigger another FeedbackPlayer with optional delay. */
  chainPlayer?: { player: FeedbackPlayer; delay?: number; waitForComplete?: boolean };
}

export interface PlayerConfig {
  entries: FeedbackEntry[];
  /** Global intensity multiplier 0–1. Default: 1 */
  intensity?: number;
  /** Global cooldown ms between play() calls. Default: 0 */
  cooldown?: number;
  /** Initial direction. Default: forward */
  direction?: 'forward' | 'reverse';
  /** Execution mode. Default: 'parallel' */
  mode?: 'parallel' | 'sequential';
  /** Scales all entry durations. Default: 1 */
  durationMultiplier?: number;
  /** Scales the global clock. Default: 1 */
  timescaleMultiplier?: number;
  /** Player-level chance 0–1. Checked at start of play(). Default: 1 */
  chance?: number;
  /** If true, flip direction on completion for next play(). Default: false */
  autoReverse?: boolean;
  /** Maximum number of play() calls accepted. Default: unlimited */
  maxPlayCount?: number;
  /** Lifecycle callbacks. */
  onPlay?: () => void;
  onStop?: () => void;
  onComplete?: () => void;
  onPause?: () => void;
  onResume?: () => void;
}

export interface PlayerState {
  playing: boolean;
  /** 0–1 overall progress. */
  progress: number;
  /** IDs of currently active entries. */
  activeEntries: string[];
  direction: 'forward' | 'reverse';
}

export interface FeedbackPlayer {
  play(intensity?: number): void;
  stop(): void;
  pause(): void;
  resume(): void;
  reverse(): void;
  /** Fast-forward all feedbacks to their final state instantly. */
  skipToEnd(): void;
  update(dt: number): PlayerState;
  isPlaying(): boolean;
  readonly direction: 'forward' | 'reverse';
}

// --- Entry State (internal) ---

const enum EntryPhase {
  WAITING_DELAY,
  ACTIVE,
  WAITING_REPEAT,
  DONE,
}

interface EntryState {
  id: string;
  entry: FeedbackEntry;
  phase: EntryPhase;
  /** Time accumulated in current phase (ms). */
  phaseElapsed: number;
  /** Time elapsed within the current active execution (ms). */
  activeElapsed: number;
  /** Remaining repeat iterations. -1 means infinite. */
  repeatsLeft: number;
  /** Whether the chance roll passed for this play. */
  chanceAllowed: boolean;
  /** Timestamp (ms since epoch) of last execution start. For per-entry cooldown. */
  lastPlayTime: number;
  /** Whether the instant callback has already fired for this execution. */
  instantFired: boolean;
  /** Whether the chain trigger has already fired for this entry. */
  chainTriggered: boolean;
}

// --- Implementation ---

let _nextId = 0;

function requireAt<T>(items: readonly T[], index: number, label: string): T {
  const item = items[index];
  if (item === undefined) {
    throw new Error(`${label} index ${index} out of range`);
  }
  return item;
}

export function createFeedbackPlayer(config: PlayerConfig): FeedbackPlayer {
  const baseIntensity = config.intensity ?? 1;
  const globalCooldown = config.cooldown ?? 0;
  const mode = config.mode ?? 'parallel';
  const durationMultiplier = config.durationMultiplier ?? 1;
  const timescaleMultiplier = config.timescaleMultiplier ?? 1;
  const playerChance = config.chance ?? 1;
  const autoReverse = config.autoReverse ?? false;
  const maxPlayCount = config.maxPlayCount;

  let currentDirection: 'forward' | 'reverse' = config.direction ?? 'forward';
  let playing = false;
  let paused = false;
  let overrideIntensity: number | undefined;
  let totalElapsed = 0;
  let totalDuration = 0;
  let lastGlobalPlayTime = -Infinity;
  let now = 0; // monotonic time tracker incremented via update dt
  let playCount = 0;

  let entryStates: EntryState[] = [];
  // Pending chain triggers with delay timers
  let pendingChains: { player: FeedbackPlayer; delayRemaining: number }[] = [];

  // Sequential mode state
  let sequentialIndex = 0;
  let holdingPauseActive = false;
  let looperStartIndex = -1;
  let looperCount = 0;
  let looperInitialized = false;
  let holdingPauseProcessed = false;
  // Timed pause state
  let timedPauseRemaining = 0;
  // Looper wait-for-completion state
  let looperWaitingForCompletion = false;
  // Persist per-entry cooldown timestamps across play() calls
  const entryCooldownMap = new Map<string, number>();
  // Assign stable IDs once at construction time
  const stableIds: string[] = config.entries.map((entry) => entry.id ?? `_fb_${_nextId++}`);

  function resolveDirection(entry: FeedbackEntry): 'forward' | 'reverse' {
    const pd = entry.timing?.playDirection ?? 'followPlayer';
    if (pd === 'followPlayer') return currentDirection;
    if (pd === 'normal') return 'forward';
    return 'reverse';
  }

  function scaledDuration(duration: number): number {
    return duration * durationMultiplier;
  }

  function computeEntryTotalDuration(entry: FeedbackEntry): number {
    const timing = entry.timing;
    const delay = timing?.initialDelay ?? 0;
    const duration = scaledDuration(timing?.duration ?? 0);
    const repeatCount = timing?.repeatCount ?? 0;
    const delayBetween = timing?.delayBetweenRepeats ?? 0;

    if (repeatCount === -1) {
      return Infinity;
    }

    const totalRepeats = 1 + repeatCount;
    const activeTime = totalRepeats * duration + (totalRepeats > 1 ? (totalRepeats - 1) * delayBetween : 0);
    return delay + activeTime;
  }

  function computeTotalDuration(): number {
    if (config.entries.length === 0) return 0;
    let max = 0;
    for (const entry of config.entries) {
      const d = computeEntryTotalDuration(entry);
      if (d === Infinity) return Infinity;
      if (d > max) max = d;
    }
    return max;
  }

  function initEntryStates(): void {
    entryStates = config.entries.map((entry, idx) => {
      const id = requireAt(stableIds, idx, 'feedback entry id');
      const timing = entry.timing;
      const chance = timing?.chance ?? 1;
      const chanceAllowed = chance >= 1 ? true : chance <= 0 ? false : Math.random() < chance;

      // Restore persisted cooldown timestamp for this entry
      const lastPlayTime = entryCooldownMap.get(id) ?? -Infinity;

      return {
        id,
        entry,
        phase: (timing?.initialDelay ?? 0) > 0 ? EntryPhase.WAITING_DELAY : EntryPhase.ACTIVE,
        phaseElapsed: 0,
        activeElapsed: 0,
        repeatsLeft: timing?.repeatCount ?? 0,
        chanceAllowed,
        lastPlayTime,
        instantFired: false,
        chainTriggered: false,
      };
    });
  }

  function shouldSkipByDirection(entry: FeedbackEntry): boolean {
    const onlyWhen = entry.timing?.onlyWhen ?? 'always';
    if (onlyWhen === 'always') return false;
    if (onlyWhen === 'forward' && currentDirection !== 'forward') return true;
    if (onlyWhen === 'reverse' && currentDirection !== 'reverse') return true;
    return false;
  }

  function reinitEntryState(es: EntryState): void {
    const timing = es.entry.timing;
    const chance = timing?.chance ?? 1;
    es.phase = (timing?.initialDelay ?? 0) > 0 ? EntryPhase.WAITING_DELAY : EntryPhase.ACTIVE;
    es.phaseElapsed = 0;
    es.activeElapsed = 0;
    es.repeatsLeft = timing?.repeatCount ?? 0;
    es.chanceAllowed = chance >= 1 ? true : chance <= 0 ? false : Math.random() < chance;
    es.instantFired = false;
    es.chainTriggered = false;
  }

  function triggerChain(chain: NonNullable<FeedbackEntry['chainPlayer']>): void {
    const delay = chain.delay ?? 0;
    if (delay > 0) {
      pendingChains.push({ player: chain.player, delayRemaining: delay });
    } else {
      chain.player.play();
    }
  }

  function isEntryCooldownBlocked(es: EntryState): boolean {
    const cd = es.entry.timing?.cooldown ?? 0;
    if (cd <= 0) return false;
    return now - es.lastPlayTime < cd;
  }

  function markEntryPlayed(es: EntryState): void {
    es.lastPlayTime = now;
    entryCooldownMap.set(es.id, now);
  }

  function getEntryIntensity(es: EntryState): number {
    if (es.entry.timing?.constantIntensity) return 1;
    return overrideIntensity ?? baseIntensity;
  }

  function rerollChance(es: EntryState): void {
    const chance = es.entry.timing?.chance ?? 1;
    es.chanceAllowed = chance >= 1 ? true : chance <= 0 ? false : Math.random() < chance;
  }

  function updateEntry(es: EntryState, dtMs: number): boolean {
    // Returns true if entry is still active (not DONE)
    if (!es.chanceAllowed) {
      es.phase = EntryPhase.DONE;
      return false;
    }

    if (shouldSkipByDirection(es.entry)) {
      es.phase = EntryPhase.DONE;
      return false;
    }

    const timing = es.entry.timing;
    const duration = scaledDuration(timing?.duration ?? 0);
    const delayBetween = timing?.delayBetweenRepeats ?? 0;

    switch (es.phase) {
      case EntryPhase.WAITING_DELAY: {
        es.phaseElapsed += dtMs;
        const initialDelay = timing?.initialDelay ?? 0;
        if (es.phaseElapsed >= initialDelay) {
          es.phase = EntryPhase.ACTIVE;
          es.phaseElapsed = 0;
          es.activeElapsed = 0;
          es.instantFired = false;
          if (!isEntryCooldownBlocked(es)) {
            markEntryPlayed(es);
          }
        }
        return true;
      }

      case EntryPhase.ACTIVE: {
        if (isEntryCooldownBlocked(es)) {
          es.phase = EntryPhase.DONE;
          return false;
        }

        // waitForComplete=false: trigger chain on first active frame
        const chain = es.entry.chainPlayer;
        if (chain && chain.waitForComplete === false && !es.chainTriggered) {
          es.chainTriggered = true;
          triggerChain(chain);
        }

        if (duration <= 0) {
          // Instant entry: fire once
          if (!es.instantFired) {
            es.instantFired = true;
            markEntryPlayed(es);
            const dir = resolveDirection(es.entry);
            const intensity = getEntryIntensity(es);
            es.entry.callback({
              intensity,
              direction: dir,
              elapsed: 0,
              progress: 0,
            });
          }
          // After firing, check for repeats
          if (es.repeatsLeft > 0 || es.repeatsLeft === -1) {
            if (es.repeatsLeft > 0) es.repeatsLeft--;
            // Re-roll chance per repeat
            rerollChance(es);
            if (!es.chanceAllowed) {
              es.phase = EntryPhase.DONE;
              return false;
            }
            if (delayBetween > 0) {
              es.phase = EntryPhase.WAITING_REPEAT;
              es.phaseElapsed = 0;
            } else {
              // Restart immediately
              es.activeElapsed = 0;
              es.instantFired = false;
              markEntryPlayed(es);
            }
          } else {
            es.phase = EntryPhase.DONE;
            // Trigger chain on entry completion (waitForComplete !== false)
            if (chain && chain.waitForComplete !== false && !es.chainTriggered) {
              es.chainTriggered = true;
              triggerChain(chain);
            }
            return false;
          }
          return true;
        }

        // Duration-based entry
        if (es.activeElapsed === 0) {
          markEntryPlayed(es);
        }
        es.activeElapsed += dtMs;
        const dir = resolveDirection(es.entry);
        const rawProgress = Math.min(es.activeElapsed / duration, 1);
        const progress = dir === 'reverse' ? 1 - rawProgress : rawProgress;
        const intensity = getEntryIntensity(es);

        es.entry.callback({
          intensity,
          direction: dir,
          elapsed: es.activeElapsed,
          progress,
        });

        if (es.activeElapsed >= duration) {
          if (es.repeatsLeft > 0 || es.repeatsLeft === -1) {
            if (es.repeatsLeft > 0) es.repeatsLeft--;
            // Re-roll chance per repeat
            rerollChance(es);
            if (!es.chanceAllowed) {
              es.phase = EntryPhase.DONE;
              return false;
            }
            if (delayBetween > 0) {
              es.phase = EntryPhase.WAITING_REPEAT;
              es.phaseElapsed = 0;
            } else {
              es.activeElapsed = 0;
              markEntryPlayed(es);
            }
          } else {
            es.phase = EntryPhase.DONE;
            // Trigger chain on entry completion (waitForComplete !== false)
            if (chain && chain.waitForComplete !== false && !es.chainTriggered) {
              es.chainTriggered = true;
              triggerChain(chain);
            }
            return false;
          }
        }
        return true;
      }

      case EntryPhase.WAITING_REPEAT: {
        es.phaseElapsed += dtMs;
        if (es.phaseElapsed >= delayBetween) {
          es.phase = EntryPhase.ACTIVE;
          es.phaseElapsed = 0;
          es.activeElapsed = 0;
          es.instantFired = false;
          markEntryPlayed(es);
        }
        return true;
      }

      case EntryPhase.DONE:
        return false;
    }
  }

  function buildSequentialState(active: string[]): PlayerState {
    const anyActive = sequentialIndex < entryStates.length || holdingPauseActive;
    if (!anyActive) {
      playing = false;
    }
    const progress = totalDuration > 0 && totalDuration !== Infinity
      ? Math.min(totalElapsed / totalDuration, 1)
      : playing ? 0 : 1;
    return { playing, progress, activeEntries: active, direction: currentDirection };
  }

  function getSequentialEntryIndex(logicalIndex: number): number {
    // When direction is reverse, iterate entries in reverse order
    if (currentDirection === 'reverse') {
      return entryStates.length - 1 - logicalIndex;
    }
    return logicalIndex;
  }

  function updateSequential(dtMs: number): PlayerState {
    const active: string[] = [];

    // Handle timed pause
    if (timedPauseRemaining > 0) {
      timedPauseRemaining -= dtMs;
      if (timedPauseRemaining > 0) {
        return buildSequentialState(active);
      }
      timedPauseRemaining = 0;
    }

    // If we've gone past all entries, stop
    if (sequentialIndex >= entryStates.length && !holdingPauseActive && !looperWaitingForCompletion) {
      playing = false;
      return buildSequentialState(active);
    }

    // If holding pause is active, update all prior entries and wait for them to finish
    if (holdingPauseActive) {
      let allDone = true;
      for (let i = 0; i < entryStates.length; i++) {
        const es = requireAt(entryStates, i, 'sequential entry');
        if (es.phase !== EntryPhase.DONE) {
          const stillActive = updateEntry(es, dtMs);
          if (stillActive) {
            allDone = false;
            if (es.phase === EntryPhase.ACTIVE) {
              active.push(es.id);
            }
          }
        }
      }
      if (allDone) {
        holdingPauseActive = false;
        holdingPauseProcessed = false;
      } else {
        return buildSequentialState(active);
      }
    }

    // Looper waiting for loop body entries to complete before restarting
    if (looperWaitingForCompletion) {
      let allDone = true;
      const target = looperStartIndex >= 0 ? looperStartIndex : 0;
      for (let i = target; i < sequentialIndex; i++) {
        const es = requireAt(entryStates, i, 'loop body entry');
        if (es.phase !== EntryPhase.DONE) {
          const stillActive = updateEntry(es, dtMs);
          if (stillActive) {
            allDone = false;
            if (es.phase === EntryPhase.ACTIVE) {
              active.push(es.id);
            }
          }
        }
      }
      if (allDone) {
        looperWaitingForCompletion = false;
        // Re-init entries from target up to (but not including) the looper entry
        for (let i = target; i < sequentialIndex; i++) {
          reinitEntryState(requireAt(entryStates, i, 'loop reset entry'));
        }
        sequentialIndex = target;
      }
      return buildSequentialState(active);
    }

    // Process the current entry
    if (sequentialIndex < entryStates.length) {
      const realIdx = getSequentialEntryIndex(sequentialIndex);
      const es = requireAt(entryStates, realIdx, 'current sequential entry');
      const timing = es.entry.timing;

      // Mark looperStart anchor
      if (timing?.looperStart) {
        looperStartIndex = sequentialIndex;
      }

      // holdingPause: control flow marker
      if (timing?.holdingPause) {
        if (!holdingPauseProcessed) {
          holdingPauseProcessed = true;
          holdingPauseActive = true;
          es.phase = EntryPhase.DONE;
          sequentialIndex++;
          let allDone = true;
          for (let i = 0; i < entryStates.length; i++) {
            const activeEntry = requireAt(entryStates, i, 'holding pause entry');
            if (activeEntry.phase !== EntryPhase.DONE) {
              allDone = false;
              if (activeEntry.phase === EntryPhase.ACTIVE) {
                active.push(activeEntry.id);
              }
            }
          }
          if (allDone) {
            holdingPauseActive = false;
            holdingPauseProcessed = false;
          }
          return buildSequentialState(active);
        }
      }
      // Timed pause: delay sequential playback for N ms
      else if (timing?.pauseDuration && timing.pauseDuration > 0) {
        es.phase = EntryPhase.DONE;
        timedPauseRemaining = timing.pauseDuration;
        sequentialIndex++;
        return buildSequentialState(active);
      }
      // looper: control flow marker — loop back to looperStart
      else if (timing?.looper) {
        if (!looperInitialized) {
          looperInitialized = true;
          looperCount = timing.looper.count;
          if (looperCount === -1) looperCount = -1; // infinite sentinel
        }
        if (looperCount > 0 || looperCount === -1) {
          if (looperCount > 0) looperCount--;
          // Wait for all entries in loop body to finish before restarting
          const target = looperStartIndex >= 0 ? looperStartIndex : 0;
          let allDone = true;
          for (let i = target; i < sequentialIndex; i++) {
            if (requireAt(entryStates, i, 'looper entry').phase !== EntryPhase.DONE) {
              allDone = false;
            }
          }
          if (!allDone) {
            looperWaitingForCompletion = true;
            return buildSequentialState(active);
          }
          // All done, re-init and restart
          for (let i = target; i < sequentialIndex; i++) {
            reinitEntryState(requireAt(entryStates, i, 'looper reset entry'));
          }
          sequentialIndex = target;
        } else {
          es.phase = EntryPhase.DONE;
          sequentialIndex++;
          looperCount = 0;
          looperInitialized = false;
        }
        return buildSequentialState(active);
      }
      // Normal entry: update it, advance when done
      else {
        const stillActive = updateEntry(es, dtMs);
        if (stillActive) {
          if (es.phase === EntryPhase.ACTIVE) {
            active.push(es.id);
          }
        } else {
          sequentialIndex++;
        }
      }
    }

    return buildSequentialState(active);
  }

  const player: FeedbackPlayer = {
    play(intensity?: number): void {
      // Player-level chance
      if (playerChance < 1 && (playerChance <= 0 || Math.random() >= playerChance)) {
        return;
      }

      // Max play count
      if (maxPlayCount !== undefined && playCount >= maxPlayCount) {
        return;
      }

      // Check global cooldown
      if (globalCooldown > 0 && now - lastGlobalPlayTime < globalCooldown) {
        return;
      }

      lastGlobalPlayTime = now;
      overrideIntensity = intensity !== undefined ? intensity : undefined;
      totalElapsed = 0;
      totalDuration = computeTotalDuration();
      playing = true;
      paused = false;
      playCount++;

      // Reset sequential state
      sequentialIndex = 0;
      holdingPauseActive = false;
      looperStartIndex = -1;
      looperCount = 0;
      looperInitialized = false;
      holdingPauseProcessed = false;
      timedPauseRemaining = 0;
      looperWaitingForCompletion = false;

      initEntryStates();
      config.onPlay?.();
    },

    stop(): void {
      // Call onRestore for each entry that has it
      for (const es of entryStates) {
        es.entry.onRestore?.();
      }
      playing = false;
      paused = false;
      entryStates = [];
      pendingChains = [];
      totalElapsed = 0;
      sequentialIndex = 0;
      holdingPauseActive = false;
      looperStartIndex = -1;
      looperCount = 0;
      looperInitialized = false;
      holdingPauseProcessed = false;
      timedPauseRemaining = 0;
      looperWaitingForCompletion = false;
      config.onStop?.();
    },

    pause(): void {
      if (playing && !paused) {
        paused = true;
        config.onPause?.();
      }
    },

    resume(): void {
      if (playing && paused) {
        paused = false;
        config.onResume?.();
      }
    },

    reverse(): void {
      currentDirection = currentDirection === 'forward' ? 'reverse' : 'forward';
    },

    skipToEnd(): void {
      if (!playing) return;
      // Fire each active entry's callback with progress=1
      for (const es of entryStates) {
        if (es.phase !== EntryPhase.DONE) {
          const dir = resolveDirection(es.entry);
          const intensity = getEntryIntensity(es);
          es.entry.callback({
            intensity,
            direction: dir,
            elapsed: scaledDuration(es.entry.timing?.duration ?? 0),
            progress: dir === 'reverse' ? 0 : 1,
          });
          es.phase = EntryPhase.DONE;
        }
      }
      playing = false;
      if (autoReverse) {
        currentDirection = currentDirection === 'forward' ? 'reverse' : 'forward';
      }
      config.onComplete?.();
    },

    update(dt: number): PlayerState {
      const dtMs = dt * 1000 * timescaleMultiplier;
      now += dt * 1000; // now always tracks real time (for cooldowns)

      // Tick pending chain delay timers (must run even when player has stopped)
      for (let i = pendingChains.length - 1; i >= 0; i--) {
        const pending = requireAt(pendingChains, i, 'pending chain');
        pending.delayRemaining -= dtMs;
        if (pending.delayRemaining <= 0) {
          pending.player.play();
          pendingChains.splice(i, 1);
        }
      }

      if (!playing || paused) {
        return {
          playing,
          progress: totalDuration > 0 && totalDuration !== Infinity
            ? Math.min(totalElapsed / totalDuration, 1)
            : 0,
          activeEntries: [],
          direction: currentDirection,
        };
      }

      totalElapsed += dtMs;

      let state: PlayerState;
      if (mode === 'sequential') {
        state = updateSequential(dtMs);
      } else {
        // Parallel mode
        let anyActive = false;
        const active: string[] = [];

        for (const es of entryStates) {
          if (es.phase === EntryPhase.DONE) continue;
          const stillActive = updateEntry(es, dtMs);
          if (stillActive) {
            anyActive = true;
            if (es.phase === EntryPhase.ACTIVE) {
              active.push(es.id);
            }
          }
        }

        if (!anyActive) {
          playing = false;
        }

        const progress = totalDuration > 0 && totalDuration !== Infinity
          ? Math.min(totalElapsed / totalDuration, 1)
          : anyActive ? 0 : 1;

        state = { playing, progress, activeEntries: active, direction: currentDirection };
      }

      // On completion: fire lifecycle, autoReverse
      if (!state.playing && !paused) {
        if (autoReverse) {
          currentDirection = currentDirection === 'forward' ? 'reverse' : 'forward';
        }
        config.onComplete?.();
      }

      return state;
    },

    isPlaying(): boolean {
      return playing;
    },

    get direction(): 'forward' | 'reverse' {
      return currentDirection;
    },
  };

  return player;
}
