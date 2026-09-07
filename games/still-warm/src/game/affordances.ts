import {
  CATALOG,
  type Capability,
  type GameAction,
  type ItemId,
} from './model';

export interface Recipe {
  id: string;
  name: string;
  description: string;
  kind: 'use' | 'combine' | 'break';
  inputs: ItemId[];
  output: ItemId;
  outputLocation: 'hand' | 'tray';
}

export const RECIPES: readonly Recipe[] = [
  {
    id: 'cut_wig',
    name: 'Cut hairpiece into thread',
    description:
      'Use a cutting tool on the hairpiece to harvest suture thread.',
    kind: 'use',
    inputs: ['wig'],
    output: 'thread',
    outputLocation: 'tray',
  },
  {
    id: 'cut_cloth',
    name: 'Cut clean cloth into bandage',
    description:
      'Use a cutting tool on the cloth to prepare a sterile dressing bandage.',
    kind: 'use',
    inputs: ['cloth'],
    output: 'bandage',
    outputLocation: 'tray',
  },
  {
    id: 'cut_blanket',
    name: 'Cut blanket into bandage',
    description: 'Use a cutting tool on the wool blanket to create a bandage.',
    kind: 'use',
    inputs: ['blanket'],
    output: 'bandage',
    outputLocation: 'tray',
  },
  {
    id: 'pull_thread_cloth',
    name: 'Pull thread from cloth',
    description:
      'Use forceps or a bare needle on cloth to pull a usable suture thread.',
    kind: 'use',
    inputs: ['cloth'],
    output: 'thread',
    outputLocation: 'tray',
  },
  {
    id: 'pull_thread_blanket',
    name: 'Pull thread from blanket',
    description:
      'Use forceps or a bare needle on the blanket to pull a usable suture thread.',
    kind: 'use',
    inputs: ['blanket'],
    output: 'thread',
    outputLocation: 'tray',
  },
  {
    id: 'break_scissors',
    name: 'Disassemble scissors into blade',
    description:
      'Snap or pry apart the surgical scissors to produce a razor blade.',
    kind: 'break',
    inputs: ['scissors'],
    output: 'blade',
    outputLocation: 'hand',
  },
  {
    id: 'combine_suture',
    name: 'Thread suture needle',
    description:
      'Combine the surgical needle with suture thread to create a ready suture.',
    kind: 'combine',
    inputs: ['needle', 'thread'],
    output: 'suture',
    outputLocation: 'hand',
  },
];

export function hasCapability(item: ItemId, cap: Capability): boolean {
  return (CATALOG[item].capabilities as readonly Capability[]).includes(cap);
}

export function isCuttingTool(item: ItemId): boolean {
  return hasCapability(item, 'cut');
}

export function isPryTool(item: ItemId): boolean {
  return hasCapability(item, 'pry');
}

export function isSmotherTool(item: ItemId): boolean {
  return hasCapability(item, 'smother');
}

export function isReflectiveTool(item: ItemId): boolean {
  return hasCapability(item, 'reflect');
}

export type UseTarget = Extract<GameAction, { kind: 'use' }>['target'];

export interface SupportedUse {
  item: ItemId;
  target: UseTarget;
  description: string;
}

export const SUPPORTED_USES: readonly SupportedUse[] = [
  // Forceps (7 uses)
  {
    item: 'forceps',
    target: 'wound',
    description: 'Extract foreign fragment or probe wound',
  },
  {
    item: 'forceps',
    target: 'door',
    description: 'Wedge metal jaws into door latch to barricade',
  },
  {
    item: 'forceps',
    target: 'scissors',
    description: 'Pry and disassemble scissors into razor blade',
  },
  {
    item: 'forceps',
    target: 'pillow',
    description: 'Rehearse fine gripping and extraction technique',
  },
  {
    item: 'forceps',
    target: 'creature',
    description: 'Gentle exploratory touch or contact check',
  },
  {
    item: 'forceps',
    target: 'cloth',
    description: 'Pull a suture thread from cloth without cutting it',
  },
  {
    item: 'forceps',
    target: 'blanket',
    description: 'Pull a suture thread from the blanket without cutting it',
  },

  // Cloth (5 uses)
  {
    item: 'cloth',
    target: 'wound',
    description:
      'Expose initial incision, blot exposed/extracted tissue, or dress closed wound',
  },
  {
    item: 'cloth',
    target: 'patient',
    description: 'Wipe forehead and comfort patient',
  },
  { item: 'cloth', target: 'fire', description: 'Smother encroaching flames' },
  {
    item: 'cloth',
    target: 'creature',
    description: 'Wipe and comfort assistant to build trust',
  },
  {
    item: 'cloth',
    target: 'pillow',
    description: 'Rehearse swabbing and dressing technique',
  },

  // Needle (5 uses)
  {
    item: 'needle',
    target: 'wound',
    description: 'Surgical contact on wound (needs thread to close)',
  },
  {
    item: 'needle',
    target: 'creature',
    description: 'Self-harm with sharp point',
  },
  {
    item: 'needle',
    target: 'pillow',
    description: 'Rehearse precision needle insertion',
  },
  {
    item: 'needle',
    target: 'cloth',
    description: 'Pull a suture thread from cloth with the bare needle',
  },
  {
    item: 'needle',
    target: 'blanket',
    description: 'Pull a suture thread from the blanket with the bare needle',
  },

  // Morphine (3 uses)
  {
    item: 'morphine',
    target: 'patient',
    description: 'Administer pain sedative to patient',
  },
  {
    item: 'morphine',
    target: 'creature',
    description: 'Administer dose to calm assistant agitation',
  },
  {
    item: 'morphine',
    target: 'pillow',
    description: 'Rehearse measured syringe delivery',
  },

  // Scalpel (7 uses)
  {
    item: 'scalpel',
    target: 'wound',
    description: 'Sharp contact harms the wound without advancing surgery',
  },
  {
    item: 'scalpel',
    target: 'wig',
    description: 'Cut hairpiece into suture thread',
  },
  {
    item: 'scalpel',
    target: 'cloth',
    description: 'Cut clean cloth into dressing bandage',
  },
  {
    item: 'scalpel',
    target: 'blanket',
    description: 'Cut blanket into dressing bandage',
  },
  { item: 'scalpel', target: 'door', description: 'Pry latch to secure door' },
  {
    item: 'scalpel',
    target: 'creature',
    description: 'Self-harm with sharp scalpel blade',
  },
  {
    item: 'scalpel',
    target: 'pillow',
    description: 'Rehearse surgical incision',
  },

  // Mirror (5 uses)
  {
    item: 'mirror',
    target: 'patient',
    description: 'Non-invasive diagnostic vital inspection',
  },
  {
    item: 'mirror',
    target: 'door',
    description: 'Surveillance through door crack',
  },
  {
    item: 'mirror',
    target: 'lamp',
    description: 'Reflect examination light onto surgical area',
  },
  {
    item: 'mirror',
    target: 'creature',
    description: 'Show reflection to assistant to ground awareness',
  },
  {
    item: 'mirror',
    target: 'pillow',
    description: 'Rehearse positioning and illumination angles',
  },

  // Lamp (4 uses)
  {
    item: 'lamp',
    target: 'wound',
    description: 'Cast direct light onto surgical incision',
  },
  { item: 'lamp', target: 'door', description: 'Illuminate shadowy doorway' },
  {
    item: 'lamp',
    target: 'creature',
    description: 'Shine warmth onto assistant',
  },
  { item: 'lamp', target: 'pillow', description: 'Rehearse lighting setup' },

  // Shard (7 uses)
  {
    item: 'shard',
    target: 'wound',
    description: 'Dangerous foreign contact on wound',
  },
  {
    item: 'shard',
    target: 'wig',
    description: 'Cut hairpiece into suture thread',
  },
  {
    item: 'shard',
    target: 'cloth',
    description: 'Cut clean cloth into bandage',
  },
  {
    item: 'shard',
    target: 'blanket',
    description: 'Cut wool blanket into bandage',
  },
  {
    item: 'shard',
    target: 'door',
    description: 'Wedge metal shard into door latch',
  },
  {
    item: 'shard',
    target: 'creature',
    description: 'Self-harm with jagged metal shard',
  },
  {
    item: 'shard',
    target: 'pillow',
    description: 'Rehearse careful handling of sharp metal',
  },

  // Restraint Release (4 uses)
  {
    item: 'release',
    target: 'patient',
    description:
      'Release the brace after dressing; early release injures the patient',
  },
  {
    item: 'release',
    target: 'door',
    description: 'Wedge heavy metal release tool into door',
  },
  {
    item: 'release',
    target: 'scissors',
    description: 'Pry apart scissor hinge to produce blade',
  },
  {
    item: 'release',
    target: 'pillow',
    description: 'Rehearse quick restraint unlatching',
  },

  // Scissors (6 uses)
  {
    item: 'scissors',
    target: 'wound',
    description: 'Wrong sharp tool contact on wound',
  },
  {
    item: 'scissors',
    target: 'wig',
    description: 'Cut hairpiece into suture thread',
  },
  {
    item: 'scissors',
    target: 'cloth',
    description: 'Cut clean cloth into bandage',
  },
  {
    item: 'scissors',
    target: 'blanket',
    description: 'Cut blanket into bandage',
  },
  {
    item: 'scissors',
    target: 'creature',
    description: 'Self-harm with scissor blades',
  },
  {
    item: 'scissors',
    target: 'pillow',
    description: 'Rehearse surgical cutting',
  },

  // Wig (4 uses)
  {
    item: 'wig',
    target: 'fire',
    description: 'Hair worsens the fire by 15; the hairpiece remains intact',
  },
  {
    item: 'wig',
    target: 'creature',
    description: 'Place hairpiece on creature for comfort/distraction',
  },
  { item: 'wig', target: 'patient', description: 'Cover patient for warmth' },
  { item: 'wig', target: 'pillow', description: 'Rest on pillow' },

  // Bowl (9 uses)
  {
    item: 'bowl',
    target: 'fire',
    description:
      'Pour all remaining water on fire, or smother it with an empty bowl',
  },
  {
    item: 'bowl',
    target: 'patient',
    description: 'Use one clean water portion to cool the patient brow',
  },
  {
    item: 'bowl',
    target: 'creature',
    description: 'Use one clean water portion to offer water to the assistant',
  },
  {
    item: 'bowl',
    target: 'lamp',
    description: 'Catch and bounce light from reflective bowl',
  },
  {
    item: 'bowl',
    target: 'door',
    description: 'Inspect reflection or barricade',
  },
  {
    item: 'bowl',
    target: 'pillow',
    description: 'Rehearse sponge basin technique',
  },
  {
    item: 'bowl',
    target: 'cloth',
    description: 'Wash dirty cloth with one water portion',
  },
  {
    item: 'bowl',
    target: 'blanket',
    description: 'Wash a dirty blanket with one water portion',
  },
  {
    item: 'bowl',
    target: 'bandage',
    description: 'Wash a dirty bandage with one water portion',
  },

  // Blanket (5 uses)
  {
    item: 'blanket',
    target: 'wound',
    description: 'Comfort and blot exposed/extracted wound to absorb bleeding',
  },
  {
    item: 'blanket',
    target: 'patient',
    description: 'Wrap patient in warm wool blanket',
  },
  {
    item: 'blanket',
    target: 'fire',
    description: 'Smother fire with heavy wool blanket',
  },
  {
    item: 'blanket',
    target: 'creature',
    description: 'Wrap assistant in warm blanket to relieve agitation',
  },
  { item: 'blanket', target: 'pillow', description: 'Rehearse bed dressing' },

  // Candle (5 uses)
  {
    item: 'candle',
    target: 'wound',
    description: 'Inspect incision under flickering candlelight',
  },
  {
    item: 'candle',
    target: 'door',
    description: 'Inspect shadowy door threshold',
  },
  {
    item: 'candle',
    target: 'creature',
    description: 'Bring warm flame near assistant for comfort',
  },
  { item: 'candle', target: 'fire', description: 'Risk spreading flame' },
  {
    item: 'candle',
    target: 'pillow',
    description: 'Rehearse holding illumination',
  },

  // Produced Items
  {
    item: 'thread',
    target: 'pillow',
    description: 'Rehearse needle threading tension',
  },
  {
    item: 'thread',
    target: 'creature',
    description: 'Hand thread to assistant',
  },
  {
    item: 'thread',
    target: 'wound',
    description: 'Attempt to pack wound with loose thread',
  },

  { item: 'blade', target: 'wig', description: 'Cut hairpiece into thread' },
  { item: 'blade', target: 'cloth', description: 'Cut cloth into bandage' },
  { item: 'blade', target: 'blanket', description: 'Cut blanket into bandage' },
  {
    item: 'blade',
    target: 'door',
    description: 'Wedge razor blade into latch',
  },
  {
    item: 'blade',
    target: 'creature',
    description: 'Self-harm with razor blade',
  },
  {
    item: 'blade',
    target: 'pillow',
    description: 'Rehearse precision razor cut',
  },
  { item: 'blade', target: 'wound', description: 'Rough razor cut on wound' },

  {
    item: 'suture',
    target: 'wound',
    description: 'Close and suture incision stitches',
  },
  {
    item: 'suture',
    target: 'pillow',
    description: 'Practice continuous stitch patterns',
  },
  {
    item: 'suture',
    target: 'creature',
    description: 'Self-harm with sharp curved suture needle',
  },

  {
    item: 'bandage',
    target: 'wound',
    description:
      'Blot exposed/extracted tissue or apply sterile dressing to closed wound',
  },
  {
    item: 'bandage',
    target: 'patient',
    description: 'Cover the patient for warmth and comfort',
  },
  {
    item: 'bandage',
    target: 'creature',
    description: 'Offer the bandage as a gentle comfort object',
  },
  {
    item: 'bandage',
    target: 'fire',
    description: 'Smother fire with dressing bandage',
  },
  {
    item: 'bandage',
    target: 'pillow',
    description: 'Practice bandage dressing',
  },
];

export function isSupportedUse(item: ItemId, target: UseTarget): boolean {
  return SUPPORTED_USES.some((u) => u.item === item && u.target === target);
}
