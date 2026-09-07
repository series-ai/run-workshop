import { Emotion, Stimulus } from './model';

export interface Disposition {
  trust: number;
  agitation: number;
  confidence: number;
}

export interface EmotionProfile {
  speedMultiplier: number; // action duration multiplier: < 1 quicker, > 1 slower
  painModifier: number; // modifier to patient pain during contact: + increases pain, - reduces pain
  traumaModifier: number; // modifier to patient health/trauma: + extra damage
}

export const EMOTION_PROFILES: Record<Emotion, EmotionProfile> = {
  // angry: hurried pressure (speed 0.85 = quicker, pain +6, trauma +4), gentle rule/style protects
  angry: {
    speedMultiplier: 0.85,
    painModifier: 6,
    traumaModifier: 4,
  },
  // scared: tremor small penalty (speed 1.5 = slower, pain +4, trauma +2)
  scared: {
    speedMultiplier: 1.5,
    painModifier: 4,
    traumaModifier: 2,
  },
  // focused: precision lower pain (speed 1.0 = baseline, pain -4, trauma 0)
  focused: {
    speedMultiplier: 1.0,
    painModifier: -4,
    traumaModifier: 0,
  },
  // happy: quicker but slight overconfidence (speed 0.9 = quicker, pain +2, trauma 0)
  happy: {
    speedMultiplier: 0.9,
    painModifier: 2,
    traumaModifier: 0,
  },
  // anxious: hesitant tension (speed 1.3 = slower, pain +3, trauma +1)
  anxious: {
    speedMultiplier: 1.3,
    painModifier: 3,
    traumaModifier: 1,
  },
  // sad: lethargic hesitation (speed 1.4 = slower, pain 0, trauma 0)
  sad: {
    speedMultiplier: 1.4,
    painModifier: 0,
    traumaModifier: 0,
  },
};

export function getEmotionContactModifiers(
  emotion: Emotion,
  isGentleProtected: boolean,
): { painModifier: number; traumaModifier: number } {
  const profile = EMOTION_PROFILES[emotion];
  if (!profile) {
    return { painModifier: 0, traumaModifier: 0 };
  }
  if (emotion === 'angry' && isGentleProtected) {
    // Gentle rule or gentle style completely protects from angry hurried pressure!
    return { painModifier: 0, traumaModifier: 0 };
  }
  return {
    painModifier: profile.painModifier,
    traumaModifier: profile.traumaModifier,
  };
}

export function deriveEmotion(
  disposition: Disposition,
  currentEmotion?: Emotion,
): Emotion {
  const { trust, agitation, confidence } = disposition;

  // Anger: surge in agitation with collapse in trust
  if (agitation >= 65 && trust < 40) {
    return 'angry';
  }

  // Panic / fear: elevated agitation combined with low confidence (matches initial { trust: 42, agitation: 48, confidence: 18 })
  if (
    (agitation >= 45 && confidence < 25) ||
    (agitation >= 60 && confidence < 35)
  ) {
    return 'scared';
  }

  // Focused: competent composure with solid confidence and low agitation (clear instructions)
  if (confidence >= 50 && agitation < 45) {
    return 'focused';
  }

  // Happy: high trust and low agitation (reassure / praise)
  if (trust >= 60 && agitation < 40) {
    return 'happy';
  }

  // Sadness / resignation: low confidence and low trust without high fight/agitation
  if (confidence < 25 && trust < 35 && agitation < 45) {
    return 'sad';
  }

  // Anxiety: elevated agitation or diminished confidence
  if (agitation >= 40 || confidence < 30) {
    return 'anxious';
  }

  // Sensible calm baseline (never default scares a calm/confident assistant)
  return currentEmotion ?? 'focused';
}

export function applyStimulus(
  disposition: Disposition,
  stimulus: Stimulus,
): Disposition {
  let { trust, agitation, confidence } = disposition;

  switch (stimulus) {
    case 'reassure':
      trust = Math.min(100, trust + 14);
      agitation = Math.max(0, agitation - 14);
      confidence = Math.min(100, confidence + 8);
      break;
    case 'praise':
      trust = Math.min(100, trust + 12);
      confidence = Math.min(100, confidence + 16);
      agitation = Math.max(0, agitation - 10);
      break;
    case 'apologize':
      trust = Math.min(100, trust + 12);
      agitation = Math.max(0, agitation - 8);
      break;
    case 'clear_instruction':
      confidence = Math.min(100, confidence + 18);
      trust = Math.min(100, trust + 4);
      agitation = Math.max(0, agitation - 10);
      break;
    case 'insult':
      trust = Math.max(0, trust - 18);
      agitation = Math.min(100, agitation + 20);
      confidence = Math.max(0, confidence - 10);
      break;
    case 'threaten':
      trust = Math.max(0, trust - 25);
      agitation = Math.min(100, agitation + 30);
      confidence = Math.max(0, confidence - 15);
      break;
    case 'cry_pain':
      agitation = Math.min(100, agitation + 16);
      confidence = Math.max(0, confidence - 8);
      break;
    case 'silence':
      confidence = Math.max(0, confidence - 10);
      trust = Math.max(0, trust - 8);
      break;
    case 'abandon':
      trust = Math.max(0, trust - 18);
      confidence = Math.max(0, confidence - 18);
      agitation = Math.max(0, agitation - 12);
      break;
  }

  return { trust, agitation, confidence };
}
