/**
 * Comprehensive Micro-Scale Pixel-Art RTS Building Kit (21 Faction Buildings + 3 Props)
 * with full 7-state lifecycle sprite strips per building:
 *   build_1 (33%) | build_2 (70%) | idle | active_0 | active_1 | damaged (<50%) | rubble (0%)
 *
 * Original Architectural Identities (distinct from classic RTS tropes):
 *  - Vanguard (Orbital Drop-Military & Heavy Truss-Gantry Engineering):
 *      Hydraulic drop-struts, chamfered gunmetal/steel plating, cobalt armor cowls,
 *      overhead bridge cranes, vertical drop-pod silos, VTOL decks, and amber beacons.
 *  - Kraxen (Abyssal Bone-Rib Cathedrals & Bioluminescent Coral-Mantis Hives):
 *      Sweeping curved ivory bone ribcages, overlapping orchid-magenta carapace shells,
 *      pulsing acid-lime bio-lantern cores, coral roost branches, and clawed roots.
 *  - Solaris (Astronomical Solar-Orreries & Art-Deco Sun-Monoliths):
 *      Stepped sun-gold ziggurats, tilted golden astrolabe rings, cantilevered triumphal
 *      sun-arches, angled heliostat mirror vanes, orbital docks, and focused beam prisms.
 *
 * Full 7-Role Tech Tree Parity Across All 3 Factions:
 *  1. HQ / Command       (~30-31x25): Drop-Citadel       | Sovereign Rib-Crown | Solar Orrery
 *  2. Supply / Power     (~17-20x17): Fuel Silo Rig      | Marrow Bulb         | Astrolabe Spire
 *  3. Resource Extractor (~24x21)   : Orbital Bore Rig   | Siphon Gullet       | Prism Harvester
 *  4. Core Production    (~25-26x21): Drop-Pod Garrison  | Chitin Brood-Pod    | Sun-Arch Conduit
 *  5. Heavy / Tech Prod  (~26-27x21): Armor Forge        | Venom Alembic       | Heliostat Crucible
 *  6. Air / Orbital Prod (~27-28x23): VTOL Sky-Pad       | Roost Perch         | Zenith Dock
 *  7. Frontline Defense  (~18-21x16): Aegis Gun-Bunker   | Thorn Lantern       | Helios Obelisk
 */

import {
  BUILDING_STATES,
  synthesizeBuildingStates,
  type BuildingStateId,
  type BuildingStateSet,
} from './building-states.ts';
import {
  buildFactionPalette,
  INK_OUTLINE,
  MINERAL_PALETTE,
  PROP_PALETTE,
  type FactionId,
  type TeamColorId,
} from './palette.ts';
import { addPixelOutline, compilePattern, type PixelSurface } from './pixel.ts';

export { BUILDING_STATES, type BuildingStateId, type BuildingStateSet };

export type BuildingRole =
  | 'hq'
  | 'supply'
  | 'extractor'
  | 'production'
  | 'tech'
  | 'air'
  | 'defense'
  | 'prop';

export type BuildingId =
  // Vanguard (7)
  | 'vanguard-bastion'
  | 'vanguard-depot'
  | 'vanguard-refinery'
  | 'vanguard-barracks'
  | 'vanguard-factory'
  | 'vanguard-starport'
  | 'vanguard-turret'
  // Kraxen (7)
  | 'kraxen-spire'
  | 'kraxen-cyst'
  | 'kraxen-extractor'
  | 'kraxen-spawner'
  | 'kraxen-lab'
  | 'kraxen-roost'
  | 'kraxen-colony'
  // Solaris (7)
  | 'solaris-nexus'
  | 'solaris-pylon'
  | 'solaris-harvester'
  | 'solaris-gate'
  | 'solaris-forge'
  | 'solaris-dock'
  | 'solaris-turret'
  // Props (3)
  | 'mineral-cluster'
  | 'pine-tree'
  | 'rock-crag';

export interface BuildingAsset {
  readonly id: BuildingId;
  readonly name: string;
  readonly faction: FactionId | 'neutral';
  readonly role: BuildingRole;
  readonly coreWidth: number;
  readonly coreHeight: number;
  readonly surface: PixelSurface;
  readonly anchorX: number;
  readonly anchorY: number;
  readonly shadowRx: number;
  readonly shadowRy: number;
  readonly stateSet?: BuildingStateSet;
}

// ============================================================================
// VANGUARD (7) — Orbital Drop-Military & Industrial Truss-Gantry Architecture
// ============================================================================

// 1. Vanguard Drop-Citadel (30x25 core) — HQ
const VANGUARD_BASTION_ROWS: readonly string[] = [
  '......................w.......',
  '....ww..ww...........wsw......',
  '...wsddwsdd.........wmmmd.....',
  '...sfdksfdk.wwwwwwwwsmmsd.....',
  '...sdddsddd.wmmmmmmmsddd......',
  '...sBBBsBBd.wmssssmmdBBd......',
  '..wsDDDsDDdwmmmmmmmmwdDDd.....',
  '.wmmsssssswmbBBBBBBbmwsdds....',
  '.wmmmmmmmmwmbBvvvvBBmwmmmsd...',
  'bBBsmmmmmmwmbBBBBBBBmwmmsBBd..',
  'bBBsmmddmmwdDDDDDDDDdsmmsBBds.',
  'bBDsmmddmmwmmmmmmmmmmmmsdBDds.',
  'dDDsmmmmmmmmmmmmmmmmmmmmdDDds.',
  '.dDsmmssssssssssssssssmmdDDs..',
  '.dDsddddddddddddddddddddsDDs..',
  'bBBdsmmsddvkkkkkkkkvddsmmdBBd.',
  'bBDdsmmsddskkkkkkkksddsmmdBDd.',
  'bBDdsddsddskssssssksddsddsBDd.',
  'dDDdsddsddsksmmmmsksddsddsDDd.',
  'dD.dsddsddsksmmmmsksddsdds.Dd.',
  'dD..dsddddskssssssksdddds..Dd.',
  'dd..ddssddvsmmmmmmsvddssdd.dd.',
  'dd...dddddsddddddddsddddd..dd.',
  '......dddddddddddddddddd......',
  '.......dddddddddddddddd.......',
];

// 2. Vanguard Fuel Silo Rig (20x17 core) — Supply / Power
// Twin pressurized horizontal steel-and-cobalt fuel drums in a braced drop-cradle
// with vertical top vent valves, amber pressure gauge, and hydraulic anchor feet.
const VANGUARD_DEPOT_ROWS: readonly string[] = [
  '....ss....ss........',
  '...smmd..smmd.......',
  '..wmmmmwwmmmmw......',
  '.wmmbBBmmbBBmms.....',
  '.wmmbBBmmbBBmmsd....',
  '.smmBDdmmBDdmmsd....',
  '.smmmddmmmddmmsd....',
  '.dmmssssssssmmdd....',
  '.bBBddddddddddBBd...',
  'bBBdsmvdswwwwsdBBd..',
  'bBDdsmfdsddddsdBDd..',
  'bBDdsdddsqkkqsdBDd..',
  'dDDdsmmmsddddsdDDd..',
  'dD.dsmmmmmmmmmd.Dd..',
  'dd..ddssddddssdd.dd.',
  '.....dddddddddd.....',
  '......dddddddd......',
];

// 3. Vanguard Orbital Bore Rig (24x21 core) — Resource Extractor / Refinery
// Heavy industrial A-frame drill derrick over a rotary bore shaft, flanked by a
// cobalt compressor tank (left) and glowing azure mineral ore hopper (right).
const VANGUARD_REFINERY_ROWS: readonly string[] = [
  '.........wwww...........',
  '........wsmmsd..........',
  '........sdssdd..........',
  '.......wdsddsmd.........',
  '.......sdsqksdd.........',
  '...www.sdskksdd..wwww...',
  '..wmmmdsdsqksdd.wccccw..',
  '..sBBBdsmssssms.sccccd..',
  '..sBvbdsmskksmmsdBBBBd..',
  '..sBBBdsmmkkmmmmdDDDDd..',
  '..sDDDdsmmkkmmmmmssssd..',
  '.wsdddsdmmkkmmmmmmmsdd..',
  '.wmmmmmmmmssmmmmmmmsdd..',
  '.bBBdddddddddddddddBBd..',
  'bBBdsmmsdkkkkkkdsfdsBBd.',
  'bBDdsddsdkqssqkdsmmsBDd.',
  'dDDdsdddsdsssssdsmmsDDd.',
  'dD.dsmmmsmmmmmmmsdds.Dd.',
  'dd..ddssddddddddssdd.dd.',
  '.....dddddddddddddd.....',
  '......dddddddddddd......',
];

// 4. Vanguard Drop-Pod Garrison (25x21 core) — Core Infantry Production
const VANGUARD_BARRACKS_ROWS: readonly string[] = [
  '...www...www.............',
  '..wmmmd.wmmmd............',
  '..sBBBd.sBBBd............',
  '..sBcbd.sBcbd............',
  '..sBBBd.sBBBd.wwwwwwww...',
  '..sDDDd.sDDDd.wmmmmmmmd..',
  '..smmmd.smmmd.wmmssmmmsd.',
  '.wsdddsdsdddsdwmmssmmmsd.',
  '.wmmmmmmmmmmmmwmmmmmmmsd.',
  '.wmmssmmmmmmsswmmssmmmsd.',
  '.smmmmmmmmmmmmsmmmmmmmsd.',
  '.bBBddddddddddddddddddBBd',
  'bBBdsmmsdddkkkkkkkkddsmBd',
  'bBDdsmfsdddkkkkkkkkddsmDd',
  'dDDdsddsdddksssssskdssdDd',
  '.dDdsddsdddksmmmmmsksddDd',
  '.dD.dsdddddksmmmmmskds.Dd',
  '..d.ddssddvsmmmmmmsvdd.d.',
  '.....dddddsddddddddsdd...',
  '......ddddddddddddddd....',
  '.......ddddddddddddd.....',
];

// 5. Vanguard Armor Forge (27x22 core) — Heavy Vehicle / Mech Production
const VANGUARD_FACTORY_ROWS: readonly string[] = [
  '....wwwwwwwwwwwwwwwwwww....',
  '...wmmbBBBBBBBBBBBBbmmmd...',
  '...sddbBBvFvBBBBBBBBddsd...',
  '...sddDDDdvvDDDDDDDDddsd...',
  '..wmmmsddskksddddddsmmmd...',
  '.wmmmsdskkqkqqkkkksdsmmmd..',
  '.wmmmsdskkmvkqkkkksksmmms..',
  '.wmmmsdskkdkkqkkkksksmmms..',
  '.smmmsdskkqqqqkddksksmmms..',
  '.bBBmsdskkkkkkkkkksdsmBBd..',
  'bBBdmsdskkkkkkkkkksdsmBBds.',
  'bBDdmsdsddddddddddsdsdBDds.',
  'bBDdsddsddvssssvdddsdsBDds.',
  'dDDdsddsdsmmmmmmsdsddsDDds.',
  'dDDdsddsdsmmddmmsdsddsDDds.',
  '.dDdsddsdsmmmmmmsdsddsDDs..',
  '.dD.dsddsdsdddddsdsdds.Ds..',
  '..d.ddssddsmmmmmsddssdd....',
  '.....dddsdsmmmmmsdsddd.....',
  '......dddddsssssddddd......',
  '.......ddddddddddddd.......',
  '........ddddddddddd........',
];

// 6. Vanguard VTOL Sky-Pad (28x23 core) — Air / Orbital Production
// Elevated chamfered flight-deck pad with painted H-landing markings & amber corner beacons,
// rear-left angled blast deflector, rear-right flight-control tower, and 4 cobalt struts.
const VANGUARD_STARPORT_ROWS: readonly string[] = [
  '.....................w......',
  '....wwwwww..........wsw.....',
  '...wmmssmmw........wmmmd....',
  '...sddssddd........sBBvBd...',
  '..wwwwwwwwwwwwwwwwwsBBBBd...',
  '.wmmmmmmmmmmmmmmmmmsDDDDd...',
  '.wmmddvddddddddvddmwmmsdd...',
  '.wmmddqqqddddqqqddmwmmsdds..',
  'bBBmddqqwddddwqqddmwmmBBds..',
  'bBBmddqqwddddwqqddmwmmBBds..',
  'bBDmddqqwwwwwwqqddmwmmBDds..',
  'dDDmddqqwddddwqqddmwmmDDds..',
  '.dDmddqqwddddwqqddmwmmdDs...',
  '.dDmddqqqddddqqqddmwmmdDs...',
  '.dDmddvddddddddvddmwmmdDs...',
  '.dDsmmmmmmmmmmmmmmmmmsdDs...',
  'bBBdddddddddddddddddddBBd...',
  'bBDdsmmsdskkkkksdsmmsdBDd...',
  'dDDdsddsdsmmmmmsdsddsdDDd...',
  'dD.dsddsdsmmmmmsdsdds..Dd...',
  'dd..ddssdsdddddsdssdd..dd...',
  '.....ddddddddddddddd........',
  '......ddddddddddddd.........',
];

// 7. Vanguard Aegis Gun-Bunker (21x16 core) — Frontline Defense
const VANGUARD_TURRET_ROWS: readonly string[] = [
  '......wwmmm..........',
  '.....wmmsmsd.........',
  '.....bBBBBBqmmmsd....',
  '.....bBBBBBkdkk......',
  '.....dDDDDDqwwwmsd...',
  '..wwwwwDDDDDdddds....',
  '.wmmmssmmmmssmmmsd...',
  '.smmsddssssddsmmsd...',
  '.bBBdsssssssssdBBd...',
  'bBBdsmmdskkkkkkdBBd..',
  'bBDdsmfdsqksskkdBDd..',
  'dDDdsdddsdsssssdDDd..',
  'dD.dsmmmssmmmmmd.Dd..',
  'dd..ddssddddssdd.dd..',
  '.....dddddddddd......',
  '......dddddddd.......',
];

// ============================================================================
// KRAXEN (7) — Scarab-Bone Exoskeletons & Stretched Bio-Sail Hives
// Team color (p/m/u) is designed structurally into the anatomy — hinged armored
// scarab wing-shields (elytra), taut bone-ribbed membrane sails, pressurized bio-pump
// chambers, and frilled mantis defense crests — cleanly framed by ivory bone ribs
// (o/c/C) over grounded dark organic sinew and clawed roots (n/t/R/r/x).
// ============================================================================

// 8. Kraxen Sovereign Scarab-Citadel (31x25 core) — HQ
// Wide parted twin armored scarab wing-shields (p/m/u) braced by sweeping ivory bone
// rib-arches (o/c/C), parting across the center to reveal a glowing ochre hive-heart
// above a shadowed emergence archway and clawed root-anchors.
const KRAXEN_SPIRE_ROWS: readonly string[] = [
  '...........oo.....oo...........',
  '.........ooc.......coo.........',
  '........ocC..oeeeo..Cco........',
  '....oo..cC..oeooeeo..Cc..oo....',
  '...ocC.ppC..eexxxee..Cuu.Cco...',
  '..ocC.ppmmC.exxxxee.Cmmuu.Cco..',
  '..cC.ppmmmmC.rxxxr.Cmmmmuu.Cc..',
  '.cC.ppmmpmmuC.rrr.Cmmummmuu.Cc.',
  '.Cc.ppmmpmmuuCrrrCmmummmmuu.cC.',
  '.Cc.pmmmpmmmuuCCCmmmmummmuu.cC.',
  '..C.pmmmpmmmuuRRRmmmmummmuu.C..',
  '..C.pmmuummmuRxxxRmmmuummuu.C..',
  '...CpmmuummurxxxxxrmmuummuC....',
  '...CmmuuummurxxxxxrmmuummuC....',
  '..tCuuuuumurxxxRxxxrmuuuuuCt...',
  '.ttCCuuuuurxxxRRRxxxruuuuuCCt..',
  '.ttrrCCuurrxxRxxxRxxrruuCCrrtt.',
  'tttrrRRrrrrrxRxxxRxrrrrrRRrrttt',
  'tnttrrRrrtRRrrxxxrrRRtrrRrrttnt',
  'nnttrrrttttRrxxxxxrrRttttrrrtnn',
  '.nnttrrRtRrrrRrrrRrrrRtRrrttnn.',
  '..nnttRRRRRRRRRRRRRRRRRRRttnn..',
  '....nntttRRRRRRRRRRRRRtttnn....',
  '......nntttttttttttttttnn......',
  '.........ttttttttttttt.........',
];

// 9. Kraxen Sail-Pod (20x19 core) — Supply / Population
// Tall curved ivory bone dorsal spine stretching a taut team-colored bio-sail fin
// (p/m/u) behind a plump bone-cradled warm ochre nutrient sac on clawed roots.
const KRAXEN_CYST_ROWS: readonly string[] = [
  '........oo..........',
  '.......oocp.........',
  '......ocCppm........',
  '.....ocCppmmmu......',
  '....ocCppmmpmmu.....',
  '....cCppmmpmmmuu....',
  '...cCppmmpmmmmuu....',
  '...Cpmmmpmmmmuuu....',
  '...Cpmmuuummmuuu....',
  '..oCmuuoeeeuuuun.o..',
  '.ocCmuoeooeeuunn.co.',
  '.ocCnnceeeecnnnnCco.',
  '..cCnnncCCcnnnnnCc..',
  '..CtnnnrrrrrnnnntC..',
  '.trrnnrrRRRrrnnrrt..',
  '.ttrrRrrRRRrrRrrtt..',
  'ttnttRRtRRRtRRrttnt.',
  '.nnttttRRRRRttttnn..',
  '...ttttttttttttt....',
];

// 10. Kraxen Fang-Pump (24x21 core) — Resource Extractor
// Twin ribbed pressurized team-colored bio-pump bladders (p/m/u) strapped inside curved
// ivory bone compression hoops (o/c/C) anchored over a dark ochre mineral fissure.
const KRAXEN_EXTRACTOR_ROWS: readonly string[] = [
  '.....oo..........oo.....',
  '....ooc....oo....coo....',
  '...ocCpp..ooc...mmCco...',
  '..ocCppmm.ocC..mmmuCco..',
  '..cCppmmmo.cC.ommmuuCc..',
  '..cCpmmmmCcCCcCmmmuuCc..',
  '..CcpmmuumcCCcmummuuCc..',
  '..CcpmmuuuoCCouummuuCc..',
  '...CmuuuuuCCCCuuuuuuC...',
  '...CCuuurrrxxrrruuuCC...',
  '..o.CCurrxxeexxrruCC.o..',
  '.oc.tnrrxxoeexxxrrnt.co.',
  '.ocCtnnrxxxxxxxxxrntCco.',
  '..cCtnnrrxxxxxxxrrntCc..',
  '..CtnnnrrrRRRRRrrnnntC..',
  '.ttrrnnnrrRRRRRrrnnrrtt.',
  'tttrrRRrrrrRRRrrrrRRrtt.',
  'tnttrrRrrtRRrrRRtrrRrtnt',
  '.nnttrrrtttRrrRtttrrrtnn',
  '..nnttRRRRRRRRRRRRRRtnn.',
  '....tttttttttttttttt....',
];

// 11. Kraxen Split-Elytra Brood-Vault (25x21 core) — Core Swarm Production
// Twin domed hinged beetle-shell carapace doors (p/m/u) framed by thick ivory bone
// hinge-ribs (o/c/C) parting open forward over a dark emergence tunnel & egg clutch.
const KRAXEN_SPAWNER_ROWS: readonly string[] = [
  '.......oo.......oo.......',
  '.....ooc.........coo.....',
  '....ocCppp.....uuuCco....',
  '...ocCppmmm...mmmuuCco...',
  '..ocCppmmmmC.CmmmmuuCco..',
  '..cCppmmpmmC.CmmummuuCc..',
  '.cCppmmpmmuC.CmmummmuuCc.',
  '.CcpmmmpmmuCrCmmummmuuCc.',
  '.CcpmmuummuRxRmmmuummuCc.',
  '.CcpmmuummrxeermmuummuCc.',
  '..CmmuuummxooexmmuummuC..',
  '..CmuuuuummxxrmmuuuuuuC..',
  '...CCuuuurxxxxxrruuuCC...',
  '..ttrrCCurxxxxxrruCCrrt..',
  '.ttrrRRrurxxxxxrruRRrrtt.',
  'ttnttrRRrrxxxxxrrRRrttnt.',
  'nnttrrRrrtRxxxRtRrrttnn..',
  '.nnttrrrtttRRRtttrrrtnn..',
  '..nnttRRttRRRRRttRRtnn...',
  '....nntttRRRRRRRtttnn....',
  '......ttttttttttttt......',
];

// 12. Kraxen Rib-Cage Mutagen Lab (26x22 core) — Tech / Bio-Titan Production
// Paired armored team-colored bio-vat shells (p/m/u) strapped in curved ivory bone
// ribs flanking a central dark-rimmed glowing acid-lime venom cauldron (l/g/G).
const KRAXEN_LAB_ROWS: readonly string[] = [
  '..........llll............',
  '....oo...lgGggl...oo......',
  '...ooc...llgggll..coo.....',
  '..ocCpp.ocllllco.mmCco....',
  '.ocCppmmocCrrCcommmuCco...',
  '.cCppmmmcCrrrrCcmmmuuCc...',
  '.cCpmmmmcCrllrcCmmmuuCc...',
  '.CcpmmuucCrgglcCummuuCc...',
  '.CcpmmuuCCrllrrCummuuCc...',
  '..CmuuuuCCrrrrrCuuuuuC....',
  '..CCuuuurrxxxxxrruuuCC....',
  '..tnCCurrrxxxxxrrruCCnt...',
  '.ttnnCurrrxxRxxrrruCnntt..',
  '.ttrnnurrrxRRRxrrrunnrrt..',
  '.ttrrRrrrrRRRRRrrrrRrrtt..',
  'tttrrRRrrrRRRRRrrrRRrrtt..',
  'tnttrrRrrtRRrRRtrrRrrtnt..',
  '.nnttrrrtttRrRtttrrrtnn...',
  '..nnttRRRRRRRRRRRRRRtnn...',
  '....nntttRRRRRRRRtttnn....',
  '......nnttttttttttnn......',
  '........tttttttttt........',
];

// 13. Kraxen Wing-Sail Aerie (27x24 core) — Air / Wyvern Production
// Tall central ivory-bone roost spire unfurling twin dramatic swept membrane wing-sails
// (p/m/u) stretched tightly between curved ivory wing-bones (o/c/C) above a rooted nest.
const KRAXEN_ROOST_ROWS: readonly string[] = [
  'oo.......................oo',
  'ooc.........ooo.........coo',
  'ocCpp......ocCco......uuCco',
  '.cCppmm...ocCeco...mmuuCc..',
  '.cCppmmm..cCeeec..mmmuuCc..',
  '..Ccpmmmm.cCrrrc.mmmmuCc...',
  '..CcpmmmmmCrrrrCmmmmmuCc...',
  '...CcpmmmmuCrrCummmmuCc....',
  '...CcpmmuuuCrrCuuummuCc....',
  '....CpmmuuuCrrCuuummuC.....',
  '....CmuuuuuCxxCuuuuuuC.....',
  '.....CCuuuuCxxCuuuuCC......',
  '......tCCuurxxruuCCt.......',
  '.....ttnnCurxxruCnntt......',
  '....tttnnnurRRrunnnttt.....',
  '...ttrrRnnrRRRRrnnRrrtt....',
  '..tttrrRRrrRRRRrrRRrrttt...',
  '.ttnttrrRrtRRRRtrRrrttntt..',
  '.nnttrrrtttRRRRtttrrrttnn..',
  '..nnttrrRtRRRRRRtRrrttnn...',
  '...nntttRRRRRRRRRRtttnn....',
  '.....nnttttttttttttnn......',
  '.......tttttttttttt........',
  '.........tttttttt..........',
];

// 14. Kraxen Mantis-Crest Turret (19x19 core) — Frontline Defense
// Grounded tripod bone-and-chitin stalk crowned by a flared, bone-spined team-colored
// frilled mantis hood (p/m/u) shielding a compact forward-facing acid-lime plasma gland.
const KRAXEN_COLONY_ROWS: readonly string[] = [
  '..oo...........oo..',
  '.oocpp.......uuCco.',
  '.ocCppmm...mmuuCco.',
  'ocCppmmmo.ommmuuCco',
  'cCppmmmuC.CummmuuCc',
  'cCpmmmuClllCummuuCc',
  '.CcpmmuCgGglummuCc.',
  '.CcpmmuCggglummuCc.',
  '..CmuuuClllCuuuuC..',
  '...CCuuurrrruuCC...',
  '....tCCurRRruCCt...',
  '....ttnnRRRRnntt...',
  '...ttrnnRRRRnnrtt..',
  '..ttrrRnRRRRnRrrtt.',
  '.tnttrRrrRRrrRrtnt.',
  'nnttrRttRRRRttRrrtn',
  'nnttRRtRRRRRRtRRtnn',
  '.nnttttRRRRRRttttn.',
  '...ttttttttttttt...',
];

// ============================================================================
// SOLARIS (7) — Astronomical Solar-Orreries & Art-Deco Sun-Monoliths
// Team-remappable royal stonework & banners use deep D (dark) framing + saturated t (mid)
// body + crisp 1-2px T (hi) upper-left bevel catchlights — cleanly separated from bright
// golden masonry (y/g/b) and electric cyan energy (C/c/v) across every team palette swap.
// ============================================================================

// 15. Solaris Solar Orrery Citadel (31x25 core) — HQ
const SOLARIS_NEXUS_ROWS: readonly string[] = [
  '...............w...............',
  '..............ygy..............',
  '........yyyyyyygbyyyyyyy.......',
  '.....yyygggggggggggggggyyy.....',
  '...yyggbb....ygy....bbgggyy....',
  '..yggb.....ccCCCcc.....bgggy...',
  '.yggb....ccCCCCCCCcc....bgggy..',
  '.ygb..yyccCCwCCCwCCccyy..bggy..',
  'ygg..yggvcCCCCCCCCCcvggy..gggy.',
  'ygb..ygb.vccCCCCCccv.bgy..bggy.',
  '.ygg.ggb..vvcccccwv..bgg.gggy..',
  '.yggbyygg...vvgvv...ggyybgggy..',
  '..yggbbyyyyyyygyyyyyyybbgggy...',
  '..yggTtbgggggggggggggbttgggy...',
  '.yyggttDbbgggggggggbbDttgggyy..',
  '.ygggttDbbDTttttttDbDttgggggy..',
  '.ygggDDbggDttgttgtDgbDDgggggy..',
  '..yggbbggbDtttttttDbgbbgggyy...',
  '..ggbbgggbbDDDDDDDbbggggbbgg...',
  '...ggbbggbbggyyyyggbbggbbgg....',
  '...ggbbbbgggbbggbbgggbbbbgg....',
  '...ggggbbggggbbbbggggbbgggg....',
  '....gggggggggggggggggggggg.....',
  '.....gggggggggggggggggggg......',
  '.......gggggggggggggggg........',
];

// 16. Solaris Astrolabe Spire (17x19 core) — Supply / Power Relay
const SOLARIS_PYLON_ROWS: readonly string[] = [
  '........w........',
  '.......ygy.......',
  '.....yyygyyy.....',
  '....yggb.bggy....',
  '...ygb..c..bgy...',
  '...ygb.cCc.bgy...',
  '...ygbcCCCcbgy...',
  '...ygb.cCc.bgy...',
  '...yggb.v.bggy...',
  '....yggbybggy....',
  '.....yygggyy.....',
  '.....yggDggy.....',
  '....yggTttggy....',
  '...yygDtttDgyy...',
  '...yggDtttDggy...',
  '..yyggbDDDbbgyy..',
  '..yggbbgggbbggy..',
  '...ggggggggggg...',
  '....ggggggggg....',
];

// 17. Solaris Prism Harvester (24x21 core) — Resource Extractor
const SOLARIS_HARVESTER_ROWS: readonly string[] = [
  '.......w........w.......',
  '......ygy..CC..ygy......',
  '.....yggb.cCCc.bggy.....',
  '....yggb..cCCc..bggy....',
  '...yggb...vCCv...bggy...',
  '...yggbyy.vccv.yybggy...',
  '..yggbggyyvCCvyyggbggy..',
  '..yggbDttgCCCCgttDbggy..',
  '.yggbDTttgCCCCgttTDbggy.',
  '.yggbDtttggCCggtttDbggy.',
  '.yggbbDDggvCCvggDDbbggy.',
  '.yygbbggggvccvggggbbgyy.',
  '..yggbbggyyyyyyggbbggy..',
  '..ygggbDTttttttTDbgggy..',
  '..ygggbDttttttttDbgggy..',
  '..ggbbgbDDDDDDDDbgbbgg..',
  '...ggbbggggggggggbbgg...',
  '...gggbbggbbbbggbbggg...',
  '....gggggggggggggggg....',
  '.....gggggggggggggg.....',
  '.......gggggggggg.......',
];

// 18. Solaris Sun-Arch Conduit (26x22 core) — Core Production
const SOLARIS_GATE_ROWS: readonly string[] = [
  '...ww................ww...',
  '..yggy..............yggy..',
  '..yTty..............ytby..',
  '.yyttbyyyyyyyyyyyyyybttyy.',
  '.ygttbggggggggggggggbttgy.',
  '.ygDDbyyyDDDDDDDDyyybDDgy.',
  '.yggbggbDTttttttTDbggbggy.',
  '.yggbggbbccccccccbbggbggy.',
  '.yggbggbvcCCCCCCcvbggbggy.',
  '.yggbggbvcCCCCCCcvbggbggy.',
  '.yggbggbvcCCCCCCcvbggbggy.',
  '.yggbggbvcCCCCCCcvbggbggy.',
  '.yggbggbvcCCCCCCcvbggbggy.',
  '.yygbggbvccCCCCccvbggbgyy.',
  '.yggbggbvvccccccvvbggbggy.',
  '.yggbbggbyyyyyyyyggbbgggy.',
  '..ggbbggbDTttttTDbgggbbgg.',
  '..ggbbgggbDDDDDDbggggbbgg.',
  '...ggbbggyyyyyyyyggbbgg...',
  '...ggggggbbbbbbbbgggggg...',
  '....gggggggggggggggggg....',
  '.....gggggggggggggggg.....',
];

// 19. Solaris Heliostat Crucible (26x21 core) — Tech / Heavy Production
const SOLARIS_FORGE_ROWS: readonly string[] = [
  '.........yyyyyyyy.........',
  '........ygDTtttDgy........',
  '........ygDttttDgy........',
  '..yyy...ygbDDDDbgy...yyy..',
  '.ygTty..yggbbbbggy..ytggy.',
  '.ygttDy..bbggggbb..yDttgy.',
  '.ygDttDy..ccCCcc..yDttDgy.',
  '..ygbDDbbcCCCCCCcbbDDbgy..',
  '..yggbbbvCCCCCCCCvbggggy..',
  '...ygbbgvccCCCCccvgbbgy...',
  '...ygggggvvccccvvgggggy...',
  '..yyggggbyyyyyyyygggggyy..',
  '.ygggggbDTttttttTDbgggggy.',
  '.ygggggbDttttttttDbgggggy.',
  '.yggbbggbDDDDDDDDbgggbbgy.',
  '..ggbbggggggggggggggbbgg..',
  '..gggbbggbbbbbbbbggbbggg..',
  '...gggbbggggggggggbbggg...',
  '....gggggggggggggggggg....',
  '.....gggggggggggggggg.....',
  '.......gggggggggggg.......',
];

// 20. Solaris Zenith Dock (28x23 core) — Air / Sky-Carrier Production
const SOLARIS_DOCK_ROWS: readonly string[] = [
  '........yyyyyyyyyyyy........',
  '.....yyyggggggggggggyyy.....',
  '...yyggbDTttccctttTDbggyy...',
  '..yggbDtttccCCCCCCtttDbggy..',
  '.yggbDttccCCCCCCCCCCttDbggy.',
  '.ygbDttcCCCCwwCCwwCCCCttbgy.',
  'yggbDtcCCCCCcCCCCcCCCCCtDggy',
  'ygbbDtcCCCCCccCCccCCCCCtDbgy',
  'yggbDttccCCCCCCCCCCCCttDbggy',
  '.yggbDtttcccCCCCCCctttDbggy.',
  '.yyggbbDDtttcccccccttDDbgyy.',
  '..yygggbbggggggggggbbgggyy..',
  '...yyggbbyyyggggyyybbggyy...',
  '...yggbggDDgDTtDgDDggbggy...',
  '...yggbggDtgDttDgtDggbggy...',
  '...yggbggDDggDDggDDggbggy...',
  '..yyggbggbbggggggbbggbggyy..',
  '..yggbbggbbgbbbbgbbggbbggy..',
  '..yggbbggyyggggggyyggbbggy..',
  '...ggbbggggggggggggggbbgg...',
  '...gggbbggbbbbbbbbggbbggg...',
  '....gggggggggggggggggggg....',
  '......gggggggggggggggg......',
];

// 21. Solaris Helios Obelisk (18x19 core) — Frontline Defense Turret
const SOLARIS_TURRET_ROWS: readonly string[] = [
  '.....www..........',
  '....ygggy.........',
  '...yggbggy........',
  '..yggb.bggccc.....',
  '..ygb..cCCCCww....',
  '..ygb..cCCCCww....',
  '..yggb.vcccvc.....',
  '...yggbyyyyy......',
  '...yggggggggg.....',
  '..yygbDTtttDbgy...',
  '.yyggbDtttttDbgy..',
  '.yggbbDDDDDDDbggy.',
  '.yggbggggggggbggy.',
  'yggbbggTttttggbgy.',
  'yggbggbDDDDDggbgy.',
  'ggbbggbbbbbbbggbg.',
  '.ggbbggggggggbbg..',
  '..ggggggggggggg...',
  '....ggggggggg.....',
];

// ============================================================================
// NEUTRAL RESOURCES & BATTLEFIELD PROPS (3)
// ============================================================================

const MINERAL_CLUSTER_ROWS: readonly string[] = [
  '....w.....',
  '....cc....',
  '.c..cbc.c.',
  '.cb.cbdcc.',
  '.cbdbbdbb.',
  '.cbdbbdbb.',
  'rRRdbddRRr',
  '.rrrbdrrr.',
];

const PINE_TREE_ROWS: readonly string[] = [
  '...h...',
  '..hlh..',
  '..lgg..',
  '.hhggd.',
  '.llggd.',
  '.lggddd',
  '..gddd.',
  '..Ht...',
  '..tt...',
];

const ROCK_CRAG_ROWS: readonly string[] = [
  '..HHH....',
  '.HHHSS...',
  '.HHSSSS..',
  '.SssssSS.',
  '.sssssss.',
  '..ssssss.',
];

export const FACTION_BUILDING_ROLES: readonly BuildingRole[] = [
  'hq',
  'supply',
  'extractor',
  'production',
  'tech',
  'air',
  'defense',
];

export const FACTION_BUILDING_MATRIX: Readonly<Record<FactionId, readonly BuildingId[]>> = {
  vanguard: [
    'vanguard-bastion',
    'vanguard-depot',
    'vanguard-refinery',
    'vanguard-barracks',
    'vanguard-factory',
    'vanguard-starport',
    'vanguard-turret',
  ],
  kraxen: [
    'kraxen-spire',
    'kraxen-cyst',
    'kraxen-extractor',
    'kraxen-spawner',
    'kraxen-lab',
    'kraxen-roost',
    'kraxen-colony',
  ],
  solaris: [
    'solaris-nexus',
    'solaris-pylon',
    'solaris-harvester',
    'solaris-gate',
    'solaris-forge',
    'solaris-dock',
    'solaris-turret',
  ],
};

export function buildAllBuildings(
  teams?: Partial<Record<FactionId, TeamColorId>>,
): Readonly<Record<BuildingId, BuildingAsset>> {
  const vanPal = buildFactionPalette('vanguard', teams?.vanguard ?? 'default');
  const krxPal = buildFactionPalette('kraxen', teams?.kraxen ?? 'default');
  const solPal = buildFactionPalette('solaris', teams?.solaris ?? 'default');

  const makeFaction = (
    id: BuildingId,
    name: string,
    faction: FactionId,
    role: BuildingRole,
    rows: readonly string[],
    palette: Readonly<Record<string, number>>,
    shadowRx: number,
    shadowRy: number,
    anchorOffsetX = 0,
  ): BuildingAsset => {
    const raw = compilePattern(rows, palette);
    const surface = addPixelOutline(raw, INK_OUTLINE);
    let bottomY = surface.height - 1;
    for (let y = surface.height - 1; y >= 0; y--) {
      let hasOpaque = false;
      for (let x = 0; x < surface.width; x++) {
        if ((surface.pixels[y * surface.width + x] >>> 24) > 0) {
          hasOpaque = true;
          break;
        }
      }
      if (hasOpaque) {
        bottomY = y;
        break;
      }
    }
    const stateSet = synthesizeBuildingStates(id, faction, rows, palette, anchorOffsetX);
    return {
      id,
      name,
      faction,
      role,
      coreWidth: raw.width,
      coreHeight: raw.height,
      surface,
      anchorX: Math.floor(surface.width / 2) + anchorOffsetX,
      anchorY: Math.max(0, bottomY - 2),
      shadowRx,
      shadowRy,
      stateSet,
    };
  };

  const makeProp = (
    id: BuildingId,
    name: string,
    rows: readonly string[],
    palette: Readonly<Record<string, number>>,
    shadowRx: number,
    shadowRy: number,
    anchorOffsetX = 0,
  ): BuildingAsset => {
    const raw = compilePattern(rows, palette);
    const surface = addPixelOutline(raw, INK_OUTLINE);
    let bottomY = surface.height - 1;
    for (let y = surface.height - 1; y >= 0; y--) {
      let hasOpaque = false;
      for (let x = 0; x < surface.width; x++) {
        if ((surface.pixels[y * surface.width + x] >>> 24) > 0) {
          hasOpaque = true;
          break;
        }
      }
      if (hasOpaque) {
        bottomY = y;
        break;
      }
    }
    return {
      id,
      name,
      faction: 'neutral',
      role: 'prop',
      coreWidth: raw.width,
      coreHeight: raw.height,
      surface,
      anchorX: Math.floor(surface.width / 2) + anchorOffsetX,
      anchorY: Math.max(0, bottomY - 2),
      shadowRx,
      shadowRy,
    };
  };

  return {
    // Vanguard (7)
    'vanguard-bastion': makeFaction('vanguard-bastion', 'Drop-Citadel', 'vanguard', 'hq', VANGUARD_BASTION_ROWS, vanPal, 13.6, 4.0),
    'vanguard-depot': makeFaction('vanguard-depot', 'Fuel Silo Rig', 'vanguard', 'supply', VANGUARD_DEPOT_ROWS, vanPal, 9.0, 3.1),
    'vanguard-refinery': makeFaction('vanguard-refinery', 'Orbital Bore Rig', 'vanguard', 'extractor', VANGUARD_REFINERY_ROWS, vanPal, 10.8, 3.4),
    'vanguard-barracks': makeFaction('vanguard-barracks', 'Drop-Pod Garrison', 'vanguard', 'production', VANGUARD_BARRACKS_ROWS, vanPal, 11.2, 3.5),
    'vanguard-factory': makeFaction('vanguard-factory', 'Armor Forge', 'vanguard', 'tech', VANGUARD_FACTORY_ROWS, vanPal, 12.2, 3.6),
    'vanguard-starport': makeFaction('vanguard-starport', 'VTOL Sky-Pad', 'vanguard', 'air', VANGUARD_STARPORT_ROWS, vanPal, 12.6, 3.8),
    'vanguard-turret': makeFaction('vanguard-turret', 'Aegis Gun-Bunker', 'vanguard', 'defense', VANGUARD_TURRET_ROWS, vanPal, 8.8, 3.1, -1),

    // Kraxen (7)
    'kraxen-spire': makeFaction('kraxen-spire', 'Scarab Citadel', 'kraxen', 'hq', KRAXEN_SPIRE_ROWS, krxPal, 13.8, 4.2),
    'kraxen-cyst': makeFaction('kraxen-cyst', 'Sail-Pod', 'kraxen', 'supply', KRAXEN_CYST_ROWS, krxPal, 8.2, 3.0),
    'kraxen-extractor': makeFaction('kraxen-extractor', 'Fang-Pump', 'kraxen', 'extractor', KRAXEN_EXTRACTOR_ROWS, krxPal, 10.6, 3.4),
    'kraxen-spawner': makeFaction('kraxen-spawner', 'Elytra Brood-Vault', 'kraxen', 'production', KRAXEN_SPAWNER_ROWS, krxPal, 11.2, 3.5),
    'kraxen-lab': makeFaction('kraxen-lab', 'Mutagen Rib-Lab', 'kraxen', 'tech', KRAXEN_LAB_ROWS, krxPal, 11.6, 3.5),
    'kraxen-roost': makeFaction('kraxen-roost', 'Wing-Sail Aerie', 'kraxen', 'air', KRAXEN_ROOST_ROWS, krxPal, 11.4, 3.6),
    'kraxen-colony': makeFaction('kraxen-colony', 'Mantis-Crest Turret', 'kraxen', 'defense', KRAXEN_COLONY_ROWS, krxPal, 7.6, 2.8),

    // Solaris (7)
    'solaris-nexus': makeFaction('solaris-nexus', 'Solar Orrery', 'solaris', 'hq', SOLARIS_NEXUS_ROWS, solPal, 13.6, 4.0),
    'solaris-pylon': makeFaction('solaris-pylon', 'Astrolabe Spire', 'solaris', 'supply', SOLARIS_PYLON_ROWS, solPal, 6.8, 2.6),
    'solaris-harvester': makeFaction('solaris-harvester', 'Prism Harvester', 'solaris', 'extractor', SOLARIS_HARVESTER_ROWS, solPal, 10.6, 3.4),
    'solaris-gate': makeFaction('solaris-gate', 'Sun-Arch Conduit', 'solaris', 'production', SOLARIS_GATE_ROWS, solPal, 11.4, 3.5),
    'solaris-forge': makeFaction('solaris-forge', 'Heliostat Crucible', 'solaris', 'tech', SOLARIS_FORGE_ROWS, solPal, 11.4, 3.5),
    'solaris-dock': makeFaction('solaris-dock', 'Zenith Dock', 'solaris', 'air', SOLARIS_DOCK_ROWS, solPal, 12.6, 3.8),
    'solaris-turret': makeFaction('solaris-turret', 'Helios Obelisk', 'solaris', 'defense', SOLARIS_TURRET_ROWS, solPal, 7.8, 2.8, -1),

    // Props (3)
    'mineral-cluster': makeProp('mineral-cluster', 'Mineral Patch', MINERAL_CLUSTER_ROWS, MINERAL_PALETTE, 5.2, 2.0),
    'pine-tree': makeProp('pine-tree', 'Highland Pine', PINE_TREE_ROWS, PROP_PALETTE, 3.4, 1.4, -1),
    'rock-crag': makeProp('rock-crag', 'Boulder Crag', ROCK_CRAG_ROWS, PROP_PALETTE, 4.6, 1.8),
  };
}
