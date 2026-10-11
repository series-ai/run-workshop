import type { RoomArea, Stage } from "../game/model";
import type { TempoState } from "../game/tempo";
import { resolveVision, type VisionInput } from "../game/vision";

export interface SensoryNarrationInput {
  movedFrom?: RoomArea;
  movedTo?: RoomArea;
  action: string;
  targetItem?: string;
  actionSucceeded: boolean;
  vocalText: string;
  gateFailureReason?: "lift_scared" | "stand_injured" | "roll_pinned";
  tempoState?: TempoState;
  currentStage?: Stage;
  creatureEmotion?: string;
}

export class SensoryNarrationPicker {
  private indices: Map<string, number> = new Map();

  pick(key: string, variations: readonly string[]): string {
    if (!variations.length) return "";
    const currentIndex = this.indices.get(key) ?? 0;
    const item = variations[currentIndex % variations.length];
    this.indices.set(key, (currentIndex + 1) % variations.length);
    return item;
  }

  reset(): void {
    this.indices.clear();
  }
}

export const defaultSensoryPicker = new SensoryNarrationPicker();

export const MOVEMENT_VARIATIONS: Record<RoomArea, readonly string[]> = {
  tray: [
    "Uneven boots scrape across the wet stone to my left, by the instrument tray.",
    "I hear a shuffle to my left.",
    "A heavy, dragging shuffle nears the metal tray beside me.",
    "Clumsy footsteps scrape across the floor to my left.",
    "A slow, hesitant step rustles the straw near the tray.",
    "The damp flagstones squeak under his weight just to my left.",
    "A cold draft stirs as he drags his feet toward the instrument stand.",
    "I hear the scrape of leather soles against the flagstones beside my head.",
    "A low, shuffling cadence shifts toward the tray on the left.",
    "His weight leans toward the tray, footsteps dragging slowly.",
  ],
  cabinet: [
    "I hear him shuffle away into the dark toward the supply cabinet.",
    "Uneven footsteps drag across the damp stone toward the cabinet.",
    "Slow, heavy strides echo across the cold flagstones toward the cabinet.",
    "A dragging scrape recedes into the corner where the cabinet stands.",
    "Clumsy footfalls echo into the damp recess where the shelves are built.",
    "I hear the hollow rustle of his frame moving toward the supply cupboard.",
    "Dragging boots crunch through broken mortar toward the tall cupboard.",
    "His uneven gait carries him deeper into the gloom toward the wooden doors.",
    "A slow, lumbering trudge moves toward the apothecary shelves.",
    "Heavy footsteps recede across the wet floor toward the locked cabinet.",
  ],
  workbench: [
    "Footsteps scrape across the stone toward the workbench.",
    "I hear him move toward the heavy timber table across the room.",
    "Uneven, dragging steps head toward the workbench.",
    "Clumsy boots shuffle toward the clutter of the worktable.",
    "A deliberate trudge carries him toward the central bench.",
    "The damp cellar air shifts as he walks toward the timber table.",
    "Heavy, dragging footsteps echo as he nears the workbench.",
    "I hear the wet slap of boots moving toward the specimen table.",
    "Slow steps carry him through the darkness toward the worktable.",
    "He lumbers toward the workbench, dragging one heel against the stone.",
  ],
  door: [
    "Heavy boots drag toward the barricaded cellar door.",
    "I hear his clumsy strides move toward the heavy timber threshold.",
    "Uneven steps shuffle toward the reinforced door in the shadows.",
    "He retreats into the gloom toward the barred cellar exit.",
    "Slow, dragging footfalls approach the heavy oak door.",
    "I hear the scrape of his boots heading toward the barred entrance.",
    "A ponderous trudge moves into the damp corner by the heavy door.",
    "Footsteps crunch over fallen debris toward the timber doorway.",
    "He drags his feet toward the heavy iron-banded door.",
    "I hear his labored breath recede toward the cellar exit.",
  ],
  fire: [
    "Shuffling footsteps near the flickering yellow glow on the floor.",
    "I hear his clumsy tread hesitate near the puddle of burning oil.",
    "Uneven boots scrape close to the heat of the small floor fire.",
    "He edges cautiously toward the licking flames on the stone.",
    "A heavy step halts near the warm crackle of the burning oil.",
    "I hear him shuffle toward the patch of light cast by the fire.",
    "Slow, guarded footsteps approach the burning pool.",
    "He drags his feet toward the dancing light on the wet stones.",
    "Uneven steps crunch over broken glass near the flickering flame.",
    "He lumbers close to the small circle of firelight on the cellar floor.",
  ],
  father: [
    "Footsteps shuffle back to where I lie pinned on the stone.",
    "I hear him return, his heavy boots coming to rest beside my head.",
    "Uneven strides drag back through the darkness to my side.",
    "He returns to kneel in the dirt beside my injured body.",
    "A dragging shuffle nears, and I feel his massive presence beside me again.",
    "Clumsy steps return to where I am trapped on the cold floor.",
    "I hear his labored breath draw close as he comes back to my side.",
    "Slow, heavy footsteps return through the gloom to my shoulder.",
    "He trudges back and crouches close to me on the damp stone.",
    "The wet scrape of his boots stops right beside my cheek.",
  ],
};

export const SURGICAL_TOOL_VARIATIONS = [
  "A light clink of steel signals he has taken an instrument.",
  "Metal clicks against metal as his clumsy fingers grasp a tool.",
  "I hear the cold ring of surgical steel being lifted from the tray.",
  "The quiet scrape of metal against the tray tells me he holds an instrument.",
  "A delicate chime of steel rings out as he lifts a surgical tool.",
  "His thick fingers rattle against the metal tray as he seizes an instrument.",
  "I hear the sharp clatter of steel as he selects an instrument from the stand.",
  "The cold ring of surgical metal echoes faintly in the gloom.",
  "A hesitant scrape of steel confirms he has picked up a tool.",
  "Metal clinks sharply against the iron stand as he secures his grip.",
] as const;

export const MEDICINE_VARIATIONS = [
  "The soft clink of glass confirms he has found a vial.",
  "A delicate glass chime sounds as he lifts the medication.",
  "I hear the faint clink of an apothecary bottle in his hand.",
  "The muffled rattle of glass against wood tells me he holds the vial.",
  "His clumsy hand grasps the small glass container from the shelf.",
  "A tiny clink of glass echoes in the damp cellar gloom.",
  "I hear the careful handling of a fragile glass phial in the dark.",
  "The dull thud of wood followed by glass clinking indicates he took the bottle.",
  "A quiet scrape of glass across the shelf signals he has the medicine.",
  "He lifts the heavy glass bottle, its liquid sloshing faintly within.",
] as const;

export const FABRIC_VARIATIONS = [
  "A soft rustle of linen reaches me as he lifts the cloth.",
  "I hear the dry whisper of coarse fabric being drawn from the shelf.",
  "The muffled rasp of woven thread indicates he holds the fabric.",
  "A gentle rustle of clean linen stirs the damp air.",
  "He gathers the folded cloth with a quiet, fibrous scrape.",
  "The faint rustling of dry cloth breaks the cellar silence.",
  "I hear the soft drag of fabric being lifted into his hands.",
  "A crisp rustle confirms he has taken up the linen.",
  "The dry whisper of fabric shifts as his heavy fingers take hold.",
  "A faint flutter of cloth sounds from the gloom near the cabinet.",
] as const;

export const LANTERN_VARIATIONS = [
  "A heavy iron handle clinks as he takes up the lantern.",
  "The metallic squeak of a wire bail confirms he holds the lantern.",
  "I hear the dull clink of sheet iron as he lifts the lantern from the stone.",
  "The faint rattle of glass panes signals he has grasped the lantern.",
  "A dull clatter of tin and glass tells me the lantern is in his hand.",
  "His heavy fingers wrap around the iron frame of the lantern.",
  "The iron loop rattles against the chimney as he hoists the lantern.",
  "A hollow ring of metal confirms he has lifted the oil lantern.",
  "I hear the creak of the lantern handle swinging into his grip.",
  "The metallic scrape of the lantern base leaving the stone floor reaches my ear.",
] as const;

export const GENERIC_TAKE_VARIATIONS = [
  "I hear him pick up an item from the shadows.",
  "A muffled scrape tells me he has lifted something from the surface.",
  "The sound of something being taken breaks the damp quiet.",
  "His heavy frame shifts as he takes the object into his hand.",
  "I hear the rustle and scrape of an object being gathered up.",
  "The quiet shift of weight confirms he is holding something.",
  "A brief rustle signals he has retrieved an item.",
  "A muffled click indicates he has secured it in his grip.",
  "He reaches out into the darkness and lifts the item up.",
  "His heavy frame shifts as he takes the object into his hand.",
] as const;

export const DROP_ITEM_VARIATIONS = [
  "I hear the dull clatter as he lets the item tumble onto the cold stone floor.",
  "A sharp clink rings out as the object slips from his grip onto the flagstones.",
  "The hollow thud of metal striking stone tells me he has dropped it.",
  "He opens his fist and the object rattles across the wet cellar floor.",
  "A sudden clatter echoes off the walls as the item hits the ground.",
  "I hear the piece strike the stone floor and slide a few inches away.",
  "His fingers unclamp, letting the item tumble down onto the masonry.",
  "A light bounce and roll on the stone confirms he has set it down.",
  "The object hits the damp floor with a sharp, resonant clatter.",
  "He discards what he was holding, the item rolling across the flagstones.",
] as const;

export const LIFT_DEBRIS_VARIATIONS = [
  "Massive palms wedge beneath the heavy oak timber—with a brutal scrape, the weight lifts from my spine.",
  "I feel the stone shake as his enormous frame heaves the crushing cabinet clean off my back.",
  "With a strained heave and a splintering groan of wood, the unbearable pressure tears away from my ribs.",
  "His broad shoulders wedge under the fallen cabinet; the wood screams as he wrenches it up and off me.",
  "The crushing agony across my spine gives way as he heaves the massive cabinet aside.",
  "I feel the timber groan violently before his strength lifts the suffocating weight away from my body.",
  "With raw, staggering power, he levers the heavy wood up, letting cold air rush over my bruised back.",
  "The grinding oak shifts and rises—the brutal weight is finally torn clear of my crushed spine.",
  "His heavy palms hoist the fallen furniture upward, freeing my chest from the suffocating pressure.",
  "A violent heave of wood against stone, and suddenly my lungs expand as the cabinet is lifted away.",
] as const;

export const GATE_FAILURE_LIFT_SCARED = [
  "I hear his boots scramble close—his trembling palms press against the oak cabinet, but as the wood groans, a whimper breaks from his throat and he recoils in terror. He is shaking too violently to heave.",
  "He rushes to the fallen cabinet and braces his hands, but panic overwhelms him—his breath shudders and he stumbles back, terrified of the shifting weight.",
  "His massive hands touch the oak timber pinning my spine, but his strength falters in raw fear; a trembling whimper escapes him as he backs away, too scared to lift.",
  "He reaches for the beam, but trembling terror freezes his arms. He clutches his chest, trembling in the dark, unable to bear the strain while so frightened.",
] as const;

export const GATE_FAILURE_STAND_INJURED = [
  "I strain to push my palms against the flagstones, but white-hot agony spikes through my spine—my legs are dead weight beneath me. He whimpers anxiously, hovering close to keep me still.",
  "I try to heave my chest off the icy stone, but crushed ribs seize violently, tearing the breath from my throat. A low, anxious moan breaks from him as he crouches beside my head.",
  "My fingers claw at the wet stone trying to rise, but the brutal trauma drops me back into the dirt. I hear his frantic, shuddering breath inches away, terrified I am hurting myself.",
  "Agony flares through my broken body the instant I try to stand—my strength gives out completely, collapsing me back onto the flagstones as he hovers beside me.",
] as const;

export const GATE_FAILURE_ROLL_PINNED = [
  "I try to wrench my hips and turn onto my back, but the crushing oak cabinet pins me flat against the flagstones. A helpless whimper answers my struggle.",
  "I twist against the stone to turn over, but the fallen beam holds my shoulders fast—the heavy timber must be lifted off my back before I can roll.",
  "The massive oak cabinet drives into my spine as I strain to turn; I cannot move an inch until the debris is heaved aside.",
] as const;

export const SOMATIC_TELEGRAPHS_PEAK: Record<Stage, { scared: readonly string[]; ready: readonly string[] }> = {
  pinned: {
    scared: [
      "From the gloom, his heavy footsteps shuffle right beside my head. I feel the brush of his ragged sleeve against my shoulder, trembling in panic, waiting for my voice to steady him.",
      "I feel his trembling bulk settle close in the dark. A fragile, frightened whimper catches in his throat—he is paralyzed by fear, desperate for reassurance.",
    ],
    ready: [
      "Massive palms settle against the fallen oak above my shoulder blades. The timber creaks under tentative weight—he is braced, waiting only for my word to heave.",
      "I feel the floorboards tremble as he plants his feet squarely beside the oak cabinet. His hands hover over the beam, poised to lift.",
    ],
  },
  covered: {
    scared: [
      "His rough, dirt-streaked hand grips my collar, lifting it an inch before hesitating. He wants to turn me over, but is terrified of hurting my back.",
      "I hear him crouching over me, his hand hovering over my wounded shoulder, torn between obedience and fear of making me cry out.",
    ],
    ready: [
      "His massive, steady palms slide under my shoulders against the cold flagstones, waiting for my order to turn me onto my back.",
      "He kneels close at my flank, his broad hands braced against my ribs, ready to gently roll me over.",
    ],
  },
  exposed: {
    scared: [
      "I hear the cold metal forceps trembling in his fist. His breath catches beside my flank, shuddering at the thought of pulling the shard.",
      "His ragged breathing catches close over my flank; his hands shake violently above the impaled metal, terrified of tearing the wound.",
    ],
    ready: [
      "He braces the cold steel forceps against the base of the metal fragment, knuckles locked, waiting for my signal to draw it free.",
      "I feel the cold iron grip of the forceps steady against my ribs—he is braced, ready to pull the shard on my command.",
    ],
  },
  extracted: {
    scared: [
      "His heavy palm presses uselessly against my torn flank, warm blood seeping between his fingers—he needs clean cloth or a bandage to stem the flow.",
      "He lets out a frightened whimper as dark blood wells from the open wound, backing toward the supply shelves in agitation.",
    ],
    ready: [
      "He holds clean fabric poised over the torn tissue, ready to apply firm pressure the moment I command.",
      "His breath steadies as he folds the linen dressing, waiting for my signal to bind the bleeding flank.",
    ],
  },
  closed: {
    scared: [
      "His hands tremble as he looks at the raw stitches, unsure how to dress the wound without tearing the fresh thread.",
      "He shifts nervously beside me, his breathing shallow as he waits for direction to bind the wound.",
    ],
    ready: [
      "He holds the clean bandage strips taut in his fingers, waiting to bind the closed incision.",
      "His hands hover over the wound with fresh linen, ready to wrap and secure the stitches.",
    ],
  },
  dressed: {
    scared: ["He hovers in the gloom, watching my chest rise and fall with anxious reverence."],
    ready: ["He kneels quietly beside me, his breathing slow and steady in the dark."],
  },
};

export const USE_MORPHINE_VARIATIONS = [
  "A soft, cool sting numbs my shoulder as he carefully introduces the sedative.",
  "I feel the cold pressure of the syringe, and a soothing warmth begins to blunt the tearing pain.",
  "His heavy thumb depresses the measure; an icy numbness spreads, quieting the agony.",
  "A quiet, clinical touch against my neck, followed by the dulling hush of medicine in my veins.",
  "The sharp edge of my agony softens as he administers the calming dose.",
  "A sudden cool relief seeps through my skin, blunting the brutal fire in my ribs.",
  "He delivers the sedative with astonishing care; the cold cellar begins to feel distant.",
  "I feel the medicine take hold, drowning the sharpest spikes of pain in a heavy fog.",
  "A gentle, steady administration that leaves a cooling numbness in my aching shoulder.",
  "The throbbing pain dulls to a faint ache under his careful, measured dose.",
] as const;

export const USE_BANDAGE_VARIATIONS = [
  "A clean, firm pressure binds against the raw flesh, staunching the warm trickle of blood.",
  "I feel the tight, reassuring wrap of fabric securing the ruined tissue against the chill.",
  "The gentle binding of the linen compresses the wound, halting the steady leak of warmth.",
  "His clumsy hands draw the dressing taut across my flank, sealing the torn skin.",
  "A tight, protective swath of cloth wraps around my ribs, steadying the broken flesh.",
  "I feel the dry fabric soak into the laceration, held fast by his heavy, deliberate grip.",
  "The cold air is cut off from my wound as he binds the dressing securely in place.",
  "A firm, careful binding anchors the dressing, stopping the dark blood from spreading.",
  "His fingers press the linen against the laceration, securing the knot with surprising tension.",
  "The warm dressing locks down over the trauma, bringing a sudden, stabilizing calm.",
] as const;

export const USE_SUTURE_VARIATIONS = [
  "A sharp, piercing tug pulls through the torn skin as he sets the stitch into place.",
  "I grit my teeth against the clean bite of the needle drawing the wound edges together.",
  "A taut, rhythmic tension pulls the parted flesh shut under his concentrated work.",
  "I feel the thread draw firm across the incision, knotting the parted skin closed.",
  "A sharp, cold pinch follows as the curved needle laces the gaping edges shut.",
  "The steady pull of suture thread binds the laceration together, stitch by stitch.",
  "I feel each careful puncture and the tight drag of thread closing the bleeding rift.",
  "His breath holds steady as the needle pierces and draws the split tissue tight.",
  "A sharp prick followed by the firm tension of thread securing the torn flank.",
  "The painful drag of the suture laces through, holding the deep cut firmly shut.",
] as const;

export const USE_SCALPEL_VARIATIONS = [
  "A cold, razor-thin line of fire parts the dead tissue under his guided hand.",
  "I feel the whisper of the sharp blade make a clean, necessary incision in the flesh.",
  "The keen edge slices cleanly through the dead layer, opening the deep trauma.",
  "A sharp, precise incision opens the wound as the polished steel cuts through.",
  "The cold steel bites true, dividing the blackened skin with quiet precision.",
  "I shudder as the scalpel makes its shallow, clinical path along the guideline.",
  "A razor-clean parting of flesh allows the trapped blood to vent into the air.",
  "The keen blade glides under his heavy hand, making the necessary surgical opening.",
  "A sharp, stinging cut relieves the internal pressure behind the bruised skin.",
  "His touch is surprisingly steady as the blade executes the fine surgical cut.",
] as const;

export const USE_GENERIC_VARIATIONS = [
  "I feel his heavy touch apply the tool directly against my wounded flank.",
  "A cold, deliberate pressure touches my side as he carries out the task.",
  "His massive hands work carefully against my flesh in the shadows.",
  "A firm, measured contact touches my body as he follows the instruction.",
  "I feel the cold instrument press into service against my torn side.",
  "He applies the object to my wound with clumsy, concentrated effort.",
  "The awkward, earnest press of massive hands tending to the bleeding.",
  "A patient, tremulous touch cleanses the ruined tissue in the gloom.",
] as const;

export const EXAMINE_VARIATIONS = [
  "I feel his cold, massive fingertips lightly brush along my ribs, inspecting the trauma.",
  "His ragged breath warms my shoulder as he leans close to inspect the bleeding laceration.",
  "The stone creaks as he leans over me, his dark eyes searching the torn flesh in the gloom.",
  "A heavy hand gently parts the torn fabric of my shirt to examine the open wound.",
  "He crouches low, his silhouette blotting out the faint light as he inspects the damage.",
  "I feel the draft shift as his large frame leans directly over my exposed flank.",
  "His clumsy fingers probe gently around the edge of the wound, feeling the broken bone.",
  "He studies the crushed flesh with intense, wordless concentration in the dark.",
  "A tremulous, gentle touch traces the perimeter of the laceration, checking the bleeding.",
  "His heavy breath slows as he closely inspects the trauma pinned beneath the chill air.",
] as const;

export const ROLL_PATIENT_VARIATIONS = [
  "Massive, gentle hands slide beneath my shoulders, slowly turning my bruised frame onto my back.",
  "With immense care, he rolls me over onto the damp flagstones, letting my chest face upward.",
  "He braces his broad hands along my side, carefully turning me so I can see the rafters above.",
  "His heavy fingers cradle my head and shoulder, gently rolling me onto my back.",
] as const;

export function formatSensoryNarration(
  input: SensoryNarrationInput,
  picker: SensoryNarrationPicker = defaultSensoryPicker,
): string {
  const parts: string[] = [];

  // 1. Movement sensory impression (heard / felt by the father)
  if (input.movedTo && input.movedTo !== input.movedFrom) {
    const list = MOVEMENT_VARIATIONS[input.movedTo];
    if (list) {
      parts.push(picker.pick(`move_${input.movedTo}`, list));
    }
  }

  // 2. Physical action sensory impression (heard / felt)
  if (input.actionSucceeded) {
    switch (input.action) {
      case "take_item": {
        const item = input.targetItem;
        if (
          item === "scalpel" ||
          item === "scissors" ||
          item === "forceps" ||
          item === "needle" ||
          item === "blade"
        ) {
          parts.push(picker.pick("take_surgical", SURGICAL_TOOL_VARIATIONS));
        } else if (item === "morphine") {
          parts.push(picker.pick("take_medicine", MEDICINE_VARIATIONS));
        } else if (
          item === "cloth" ||
          item === "bandage" ||
          item === "suture" ||
          item === "thread" ||
          item === "blanket" ||
          item === "wig"
        ) {
          parts.push(picker.pick("take_fabric", FABRIC_VARIATIONS));
        } else if (item === "lantern") {
          parts.push(picker.pick("take_lantern", LANTERN_VARIATIONS));
        } else {
          parts.push(picker.pick("take_generic", GENERIC_TAKE_VARIATIONS));
        }
        break;
      }
      case "drop_item": {
        parts.push(picker.pick("drop_item", DROP_ITEM_VARIATIONS));
        break;
      }
      case "lift_debris": {
        parts.push(picker.pick("lift_debris", LIFT_DEBRIS_VARIATIONS));
        break;
      }
      case "roll_patient": {
        parts.push(picker.pick("roll_patient", ROLL_PATIENT_VARIATIONS));
        break;
      }
      case "use_morphine": {
        parts.push(picker.pick("use_morphine", USE_MORPHINE_VARIATIONS));
        break;
      }
      case "use_bandage": {
        parts.push(picker.pick("use_bandage", USE_BANDAGE_VARIATIONS));
        break;
      }
      case "use_suture": {
        parts.push(picker.pick("use_suture", USE_SUTURE_VARIATIONS));
        break;
      }
      case "use_scalpel": {
        parts.push(picker.pick("use_scalpel", USE_SCALPEL_VARIATIONS));
        break;
      }
      case "use_generic": {
        parts.push(picker.pick("use_generic", USE_GENERIC_VARIATIONS));
        break;
      }
      case "examine_wound": {
        parts.push(picker.pick("examine_wound", EXAMINE_VARIATIONS));
        break;
      }
      default:
        break;
    }
  } else if (input.gateFailureReason === "lift_scared") {
    // Somatic Gate Failure: explains to player why the lift attempt failed
    parts.push(picker.pick("lift_scared_gate", GATE_FAILURE_LIFT_SCARED));
  } else if (input.gateFailureReason === "stand_injured") {
    // Somatic Gate Failure: explains why the father cannot stand
    parts.push(picker.pick("stand_injured_gate", GATE_FAILURE_STAND_INJURED));
  } else if (input.gateFailureReason === "roll_pinned") {
    // Somatic Gate Failure: explains why patient cannot roll while pinned
    parts.push(picker.pick("roll_pinned_gate", GATE_FAILURE_ROLL_PINNED));
  } else if (input.tempoState === "peak" && input.currentStage) {
    // Somatic Telegraph at Peak (Turns 3-4 with no progress):
    // Deterministically prompt the current obstacle via the boy's body language
    const stageTelegraphs = SOMATIC_TELEGRAPHS_PEAK[input.currentStage];
    if (stageTelegraphs) {
      const mode = input.creatureEmotion === "scared" ? "scared" : "ready";
      const telegraphPool = stageTelegraphs[mode];
      parts.push(picker.pick(`peak_${input.currentStage}_${mode}`, telegraphPool));
    }
  }

  // 3. Vocalization / emotional atmosphere (heard from the father's perspective)
  if (input.vocalText) {
    parts.push(input.vocalText.trim());
  }

  return parts.join(" ");
}

export const INSPECT_DARK_VARIATIONS = [
  "The blackness answers me. I hear something large shift its weight close by, coarse cloth whispering against the cold stone—and that is all I have.",
  "Nothing but dark against my open eyes. His breathing close by is the whole of the world.",
  "I strain to see and find only black. A heavy shuffle, a wet breath, the drip of water—my boy is somewhere in it, but I cannot see him.",
] as const;

/** Dark vision, but the floor fire is burning: heat and sound, never sight. */
export const INSPECT_DARK_WITH_FIRE_VARIATIONS = [
  "The blackness answers me. I hear something large shift its weight close by, and the floor fire crackles somewhere past my face—that heat and his breathing are all I have.",
  "Only black. Heat from the spilled oil washes across my cheek, and somewhere in it my boy is only a sound.",
] as const;

export const INSPECT_FLOOR_VARIATIONS = [
  "The cabinet no longer crushes my back, but I still lie face down. Pale light from the breach above shows me wet flagstones, a drainage grate, and cracks running with damp. Whatever he is doing above me, I cannot see it.",
  "I can make out cold flagstones and broken mortar in front of my face now. The boy himself stays beyond my sight, somewhere above and behind me.",
] as const;

/** Room vision from the examination lamp aimed at me. */
export const INSPECT_ROOM_LAMP_VARIATIONS = [
  "He crouches close over me; the examination lamp shows the mismatched seams of his face. My boy, watching me.",
] as const;

/** Room vision from the portable lantern. */
export const INSPECT_ROOM_LANTERN_VARIATIONS = [
  "He crouches close over me; lantern light picks out the mismatched seams of his face. My boy, watching me.",
] as const;

/** Room vision from the candle. */
export const INSPECT_ROOM_CANDLE_VARIATIONS = [
  "He crouches close over me; candlelight gilds the mismatched seams of his face. My boy, watching me.",
] as const;

/** Room vision from the floor fire alone. */
export const INSPECT_ROOM_FIRE_VARIATIONS = [
  "The burning oil throws a low amber light across him. I can make out his broad shoulders over me at last, and the seams of his face.",
] as const;

/** Room vision with no portable light in hand: name no source. */
export const INSPECT_ROOM_UNNAMED_VARIATIONS = [
  "In the light I can see him clearly at last, broad shoulders blotting the cellar wall above me, eyes fixed on my face.",
] as const;

/**
 * Answers "what can I see?" with only what the state actually allows: black
 * while pinned face down, the flagstones once the cabinet is off, the boy
 * only when supine under light.
 */
export function formatInspectNarration(
  input: VisionInput,
  picker: SensoryNarrationPicker = defaultSensoryPicker,
): string {
  switch (resolveVision(input)) {
    case "room":
      // Name only the light source that is actually burning.
      if (input.lanternLit)
        return picker.pick("inspect_room_lantern", INSPECT_ROOM_LANTERN_VARIATIONS);
      if (input.lamp !== "away")
        return picker.pick("inspect_room_lamp", INSPECT_ROOM_LAMP_VARIATIONS);
      if (input.candleLit)
        return picker.pick("inspect_room_candle", INSPECT_ROOM_CANDLE_VARIATIONS);
      if (input.fire > 0)
        return picker.pick("inspect_room_fire", INSPECT_ROOM_FIRE_VARIATIONS);
      // Unreachable while resolveVision gates room on light, but name no
      // source rather than invent one.
      return picker.pick("inspect_room", INSPECT_ROOM_UNNAMED_VARIATIONS);
    case "floor":
      return picker.pick("inspect_floor", INSPECT_FLOOR_VARIATIONS);
    case "dark":
      return picker.pick(
        input.fire > 0 ? "inspect_dark_fire" : "inspect_dark",
        input.fire > 0
          ? INSPECT_DARK_WITH_FIRE_VARIATIONS
          : INSPECT_DARK_VARIATIONS,
      );
  }
}
