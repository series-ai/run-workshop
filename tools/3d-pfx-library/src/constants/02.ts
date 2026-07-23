import type { PfxAuthoredRecipe } from '../types/02'
import fireball from '../recipes/fireball'
import explosion from '../recipes/explosion'
import smokePuff from '../recipes/smoke-puff'
import muzzleFlash from '../recipes/muzzle-flash'
import hitSpark from '../recipes/hit-spark'
import healingAura from '../recipes/healing-aura'
import slashTrail from '../recipes/slash-trail'
import lootBeam from '../recipes/loot-beam'
import forceField from '../recipes/force-field'
import footstepDust from '../recipes/footstep-dust'
import shieldBreak from '../recipes/shield-break'
import poisonCloud from '../recipes/poison-cloud'
import uiRewardBurst from '../recipes/ui-reward-burst'
import chargeTelegraph from '../recipes/charge-telegraph'
import spawnMarker from '../recipes/spawn-marker'
import dissolve from '../recipes/dissolve'
import portalIdleLoop from '../recipes/portal-idle-loop'
import projectileTrail from '../recipes/projectile-trail'
import underwaterBubbles from '../recipes/underwater-bubbles'
import snowGust from '../recipes/snow-gust'
import lowHealthScreenParticles from '../recipes/low-health-screen-particles'
import coinPickupSparkle from '../recipes/coin-pickup-sparkle'
import criticalHitBurst from '../recipes/critical-hit-burst'
import enemyDeathPoof from '../recipes/enemy-death-poof'
import levelUpFlare from '../recipes/level-up-flare'
import embersBurst from '../recipes/embers-burst'
import sparkLoop from '../recipes/spark-loop'
import electricTrail from '../recipes/electric-trail'
import windImpact from '../recipes/wind-impact'
import acidIdle from '../recipes/acid-idle'
import portalCharge from '../recipes/portal-charge'
import reflectRelease from '../recipes/reflect-release'
import rewardTelegraph from '../recipes/reward-telegraph'
import hologramAura from '../recipes/hologram-aura'
import blastBeam from '../recipes/blast-beam'
import glyphRing from '../recipes/glyph-ring'
import waterCone from '../recipes/water-cone'
import sandSpray from '../recipes/sand-spray'
import curseColumn from '../recipes/curse-column'
import spawnScreen from '../recipes/spawn-screen'
import jumpPickup from '../recipes/jump-pickup'
import targetBreak from '../recipes/target-break'
import exhaustHit from '../recipes/exhaust-hit'
import debrisMiss from '../recipes/debris-miss'
import plasmaAmbient from '../recipes/plasma-ambient'
import snowSpawn from '../recipes/snow-spawn'
import poisonDeath from '../recipes/poison-death'
import ghostCritical from '../recipes/ghost-critical'
import barrierLowHealth from '../recipes/barrier-low-health'
import flameCharge from '../recipes/flame-charge'
import meteorRing from '../recipes/meteor-ring'
import shockwaveSpawn from '../recipes/shockwave-spawn'
import dustLoop from '../recipes/dust-loop'
import debrisRelease from '../recipes/debris-release'
import sparkCone from '../recipes/spark-cone'
import shardBreak from '../recipes/shard-break'
import glyphTrail from '../recipes/glyph-trail'
import beamTelegraph from '../recipes/beam-telegraph'
import laserSpray from '../recipes/laser-spray'
import plasmaHit from '../recipes/plasma-hit'
import electricCritical from '../recipes/electric-critical'
import iceImpact from '../recipes/ice-impact'
import frostAura from '../recipes/frost-aura'
import waterColumn from '../recipes/water-column'
import snowIdle from '../recipes/snow-idle'
import windBeam from '../recipes/wind-beam'
import petalAmbient from '../recipes/petal-ambient'
import sandBurst from '../recipes/sand-burst'
import mudCharge from '../recipes/mud-charge'
import slimeRing from '../recipes/slime-ring'
import acidSpawn from '../recipes/acid-spawn'
import healingLoop from '../recipes/healing-loop'
import holyRelease from '../recipes/holy-release'
import curseCone from '../recipes/curse-cone'
import shadowBreak from '../recipes/shadow-break'
import bloodDeath from '../recipes/blood-death'
import ghostTrail from '../recipes/ghost-trail'
import portalTelegraph from '../recipes/portal-telegraph'
import warpSpray from '../recipes/warp-spray'
import teleportHit from '../recipes/teleport-hit'
import despawnImpact from '../recipes/despawn-impact'
import shieldAura from '../recipes/shield-aura'
import barrierColumn from '../recipes/barrier-column'
import dashIdle from '../recipes/dash-idle'
import jumpBeam from '../recipes/jump-beam'
import footstepAmbient from '../recipes/footstep-ambient'
import pickupBurst from '../recipes/pickup-burst'
import rewardCharge from '../recipes/reward-charge'
import comboRing from '../recipes/combo-ring'
import uiPickup from '../recipes/ui-pickup'
import targetSpawn from '../recipes/target-spawn'
import warningLoop from '../recipes/warning-loop'
import markerRelease from '../recipes/marker-release'
import scanCone from '../recipes/scan-cone'
import hologramBreak from '../recipes/hologram-break'
import thrusterTrail from '../recipes/thruster-trail'
import exhaustTelegraph from '../recipes/exhaust-telegraph'
import flameBurst from '../recipes/flame-burst'
import meteorBurst from '../recipes/meteor-burst'
import blastBurst from '../recipes/blast-burst'
import shockwaveBurst from '../recipes/shockwave-burst'
import dustBurst from '../recipes/dust-burst'
import debrisBurst from '../recipes/debris-burst'
import sparkBurst from '../recipes/spark-burst'
import shardBurst from '../recipes/shard-burst'
import runeBurst from '../recipes/rune-burst'
import glyphBurst from '../recipes/glyph-burst'
import beamBurst from '../recipes/beam-burst'
import laserBurst from '../recipes/laser-burst'
import plasmaBurst from '../recipes/plasma-burst'
import electricBurst from '../recipes/electric-burst'
import iceBurst from '../recipes/ice-burst'
import frostBurst from '../recipes/frost-burst'
import waterBurst from '../recipes/water-burst'
import bubbleBurst from '../recipes/bubble-burst'
import rainBurst from '../recipes/rain-burst'
import snowBurst from '../recipes/snow-burst'
import windBurst from '../recipes/wind-burst'
import leafBurst from '../recipes/leaf-burst'
import petalBurst from '../recipes/petal-burst'
import mudBurst from '../recipes/mud-burst'
import slimeBurst from '../recipes/slime-burst'
import poisonBurst from '../recipes/poison-burst'
import acidBurst from '../recipes/acid-burst'
import healingBurst from '../recipes/healing-burst'
import holyBurst from '../recipes/holy-burst'
import curseBurst from '../recipes/curse-burst'
import shadowBurst from '../recipes/shadow-burst'
import bloodBurst from '../recipes/blood-burst'
import ghostBurst from '../recipes/ghost-burst'
import portalBurst from '../recipes/portal-burst'
import warpBurst from '../recipes/warp-burst'
import teleportBurst from '../recipes/teleport-burst'
import spawnBurst from '../recipes/spawn-burst'
import despawnBurst from '../recipes/despawn-burst'
import shieldBurst from '../recipes/shield-burst'
import barrierBurst from '../recipes/barrier-burst'
import reflectBurst from '../recipes/reflect-burst'
import parryBurst from '../recipes/parry-burst'
import dashBurst from '../recipes/dash-burst'
import jumpBurst from '../recipes/jump-burst'
import landingBurst from '../recipes/landing-burst'
import footstepBurst from '../recipes/footstep-burst'
import rewardBurst from '../recipes/reward-burst'
import comboBurst from '../recipes/combo-burst'
import uiBurst from '../recipes/ui-burst'
import targetBurst from '../recipes/target-burst'
import warningBurst from '../recipes/warning-burst'
import markerBurst from '../recipes/marker-burst'
import scanBurst from '../recipes/scan-burst'
import hologramBurst from '../recipes/hologram-burst'
import engineBurst from '../recipes/engine-burst'
import thrusterBurst from '../recipes/thruster-burst'
import exhaustBurst from '../recipes/exhaust-burst'
import embersLoop from '../recipes/embers-loop'
import flameLoop from '../recipes/flame-loop'
import debrisLoop from '../recipes/debris-loop'
import shardLoop from '../recipes/shard-loop'
import runeLoop from '../recipes/rune-loop'
import glyphLoop from '../recipes/glyph-loop'
import beamLoop from '../recipes/beam-loop'
import laserLoop from '../recipes/laser-loop'
import plasmaLoop from '../recipes/plasma-loop'
import electricLoop from '../recipes/electric-loop'
import iceLoop from '../recipes/ice-loop'
import frostLoop from '../recipes/frost-loop'
import waterLoop from '../recipes/water-loop'
import bubbleLoop from '../recipes/bubble-loop'
import rainLoop from '../recipes/rain-loop'
import snowLoop from '../recipes/snow-loop'
import windLoop from '../recipes/wind-loop'
import leafLoop from '../recipes/leaf-loop'
import petalLoop from '../recipes/petal-loop'
import sandLoop from '../recipes/sand-loop'
import mudLoop from '../recipes/mud-loop'
import slimeLoop from '../recipes/slime-loop'
import poisonLoop from '../recipes/poison-loop'
import acidLoop from '../recipes/acid-loop'
import holyLoop from '../recipes/holy-loop'
import curseLoop from '../recipes/curse-loop'
import shadowLoop from '../recipes/shadow-loop'
import bloodLoop from '../recipes/blood-loop'
import ghostLoop from '../recipes/ghost-loop'
import portalLoop from '../recipes/portal-loop'
import warpLoop from '../recipes/warp-loop'
import teleportLoop from '../recipes/teleport-loop'
import spawnLoop from '../recipes/spawn-loop'
import despawnLoop from '../recipes/despawn-loop'
import shieldLoop from '../recipes/shield-loop'
import barrierLoop from '../recipes/barrier-loop'
import reflectLoop from '../recipes/reflect-loop'
import parryLoop from '../recipes/parry-loop'
import dashLoop from '../recipes/dash-loop'
import jumpLoop from '../recipes/jump-loop'
import landingLoop from '../recipes/landing-loop'
import footstepLoop from '../recipes/footstep-loop'
import pickupLoop from '../recipes/pickup-loop'
import rewardLoop from '../recipes/reward-loop'
import comboLoop from '../recipes/combo-loop'
import uiLoop from '../recipes/ui-loop'
import targetLoop from '../recipes/target-loop'
import markerLoop from '../recipes/marker-loop'
import scanLoop from '../recipes/scan-loop'
import hologramLoop from '../recipes/hologram-loop'
import engineLoop from '../recipes/engine-loop'
import thrusterLoop from '../recipes/thruster-loop'
import exhaustLoop from '../recipes/exhaust-loop'
import embersTrail from '../recipes/embers-trail'
import flameTrail from '../recipes/flame-trail'
import meteorTrail from '../recipes/meteor-trail'
import blastTrail from '../recipes/blast-trail'
import shockwaveTrail from '../recipes/shockwave-trail'
import dustTrail from '../recipes/dust-trail'
import debrisTrail from '../recipes/debris-trail'
import sparkTrail from '../recipes/spark-trail'
import shardTrail from '../recipes/shard-trail'
import runeTrail from '../recipes/rune-trail'
import beamTrail from '../recipes/beam-trail'
import laserTrail from '../recipes/laser-trail'
import plasmaTrail from '../recipes/plasma-trail'
import iceTrail from '../recipes/ice-trail'
import frostTrail from '../recipes/frost-trail'
import waterTrail from '../recipes/water-trail'
import bubbleTrail from '../recipes/bubble-trail'
import rainTrail from '../recipes/rain-trail'
import snowTrail from '../recipes/snow-trail'
import windTrail from '../recipes/wind-trail'
import leafTrail from '../recipes/leaf-trail'
import petalTrail from '../recipes/petal-trail'
import sandTrail from '../recipes/sand-trail'
import mudTrail from '../recipes/mud-trail'
import slimeTrail from '../recipes/slime-trail'
import poisonTrail from '../recipes/poison-trail'
import acidTrail from '../recipes/acid-trail'
import healingTrail from '../recipes/healing-trail'
import holyTrail from '../recipes/holy-trail'
import curseTrail from '../recipes/curse-trail'
import shadowTrail from '../recipes/shadow-trail'
import bloodTrail from '../recipes/blood-trail'
import portalTrail from '../recipes/portal-trail'
import warpTrail from '../recipes/warp-trail'
import teleportTrail from '../recipes/teleport-trail'
import spawnTrail from '../recipes/spawn-trail'
import despawnTrail from '../recipes/despawn-trail'
import shieldTrail from '../recipes/shield-trail'
import barrierTrail from '../recipes/barrier-trail'
import reflectTrail from '../recipes/reflect-trail'
import parryTrail from '../recipes/parry-trail'
import dashTrail from '../recipes/dash-trail'
import jumpTrail from '../recipes/jump-trail'
import landingTrail from '../recipes/landing-trail'
import footstepTrail from '../recipes/footstep-trail'
import targetTrail from '../recipes/target-trail'
import warningTrail from '../recipes/warning-trail'
import markerTrail from '../recipes/marker-trail'
import scanTrail from '../recipes/scan-trail'
import hologramTrail from '../recipes/hologram-trail'
import engineTrail from '../recipes/engine-trail'
import exhaustTrail from '../recipes/exhaust-trail'
import embersImpact from '../recipes/embers-impact'
import flameImpact from '../recipes/flame-impact'
import meteorImpact from '../recipes/meteor-impact'
import blastImpact from '../recipes/blast-impact'
import shockwaveImpact from '../recipes/shockwave-impact'
import dustImpact from '../recipes/dust-impact'
import debrisImpact from '../recipes/debris-impact'
import sparkImpact from '../recipes/spark-impact'
import shardImpact from '../recipes/shard-impact'
import runeImpact from '../recipes/rune-impact'
import glyphImpact from '../recipes/glyph-impact'
import beamImpact from '../recipes/beam-impact'
import laserImpact from '../recipes/laser-impact'
import plasmaImpact from '../recipes/plasma-impact'
import electricImpact from '../recipes/electric-impact'
import frostImpact from '../recipes/frost-impact'
import waterImpact from '../recipes/water-impact'
import snowImpact from '../recipes/snow-impact'
import leafImpact from '../recipes/leaf-impact'
import petalImpact from '../recipes/petal-impact'
import sandImpact from '../recipes/sand-impact'
import mudImpact from '../recipes/mud-impact'
import slimeImpact from '../recipes/slime-impact'
import poisonImpact from '../recipes/poison-impact'
import acidImpact from '../recipes/acid-impact'
import holyImpact from '../recipes/holy-impact'
import curseImpact from '../recipes/curse-impact'
import shadowImpact from '../recipes/shadow-impact'
import bloodImpact from '../recipes/blood-impact'
import ghostImpact from '../recipes/ghost-impact'
import portalImpact from '../recipes/portal-impact'
import warpImpact from '../recipes/warp-impact'
import teleportImpact from '../recipes/teleport-impact'
import shieldImpact from '../recipes/shield-impact'
import barrierImpact from '../recipes/barrier-impact'
import reflectImpact from '../recipes/reflect-impact'
import parryImpact from '../recipes/parry-impact'
import dashImpact from '../recipes/dash-impact'
import jumpImpact from '../recipes/jump-impact'
import landingImpact from '../recipes/landing-impact'
import footstepImpact from '../recipes/footstep-impact'
import targetImpact from '../recipes/target-impact'
import warningImpact from '../recipes/warning-impact'
import markerImpact from '../recipes/marker-impact'
import scanImpact from '../recipes/scan-impact'
import hologramImpact from '../recipes/hologram-impact'
import engineImpact from '../recipes/engine-impact'
import thrusterImpact from '../recipes/thruster-impact'
import exhaustImpact from '../recipes/exhaust-impact'
import embersIdle from '../recipes/embers-idle'
import flameIdle from '../recipes/flame-idle'
import dustIdle from '../recipes/dust-idle'
import debrisIdle from '../recipes/debris-idle'
import sparkIdle from '../recipes/spark-idle'
import shardIdle from '../recipes/shard-idle'
import runeIdle from '../recipes/rune-idle'
import glyphIdle from '../recipes/glyph-idle'
import beamIdle from '../recipes/beam-idle'
import laserIdle from '../recipes/laser-idle'
import plasmaIdle from '../recipes/plasma-idle'
import electricIdle from '../recipes/electric-idle'
import iceIdle from '../recipes/ice-idle'
import frostIdle from '../recipes/frost-idle'
import waterIdle from '../recipes/water-idle'
import bubbleIdle from '../recipes/bubble-idle'
import rainIdle from '../recipes/rain-idle'
import windIdle from '../recipes/wind-idle'
import leafIdle from '../recipes/leaf-idle'
import petalIdle from '../recipes/petal-idle'
import sandIdle from '../recipes/sand-idle'
import mudIdle from '../recipes/mud-idle'
import slimeIdle from '../recipes/slime-idle'
import poisonIdle from '../recipes/poison-idle'
import healingIdle from '../recipes/healing-idle'
import holyIdle from '../recipes/holy-idle'
import curseIdle from '../recipes/curse-idle'
import shadowIdle from '../recipes/shadow-idle'
import bloodIdle from '../recipes/blood-idle'
import ghostIdle from '../recipes/ghost-idle'
import portalIdle from '../recipes/portal-idle'
import warpIdle from '../recipes/warp-idle'
import teleportIdle from '../recipes/teleport-idle'
import spawnIdle from '../recipes/spawn-idle'
import despawnIdle from '../recipes/despawn-idle'
import shieldIdle from '../recipes/shield-idle'
import barrierIdle from '../recipes/barrier-idle'
import reflectIdle from '../recipes/reflect-idle'
import parryIdle from '../recipes/parry-idle'
import jumpIdle from '../recipes/jump-idle'
import landingIdle from '../recipes/landing-idle'
import footstepIdle from '../recipes/footstep-idle'
import pickupIdle from '../recipes/pickup-idle'
import rewardIdle from '../recipes/reward-idle'
import comboIdle from '../recipes/combo-idle'
import uiIdle from '../recipes/ui-idle'
import targetIdle from '../recipes/target-idle'
import warningIdle from '../recipes/warning-idle'
import markerIdle from '../recipes/marker-idle'
import scanIdle from '../recipes/scan-idle'
import hologramIdle from '../recipes/hologram-idle'
import engineIdle from '../recipes/engine-idle'
import thrusterIdle from '../recipes/thruster-idle'
import exhaustIdle from '../recipes/exhaust-idle'
import embersCharge from '../recipes/embers-charge'
import meteorCharge from '../recipes/meteor-charge'
import blastCharge from '../recipes/blast-charge'
import shockwaveCharge from '../recipes/shockwave-charge'
import dustCharge from '../recipes/dust-charge'
import debrisCharge from '../recipes/debris-charge'
import sparkCharge from '../recipes/spark-charge'
import shardCharge from '../recipes/shard-charge'
import runeCharge from '../recipes/rune-charge'
import glyphCharge from '../recipes/glyph-charge'
import beamCharge from '../recipes/beam-charge'
import laserCharge from '../recipes/laser-charge'
import plasmaCharge from '../recipes/plasma-charge'
import electricCharge from '../recipes/electric-charge'
import iceCharge from '../recipes/ice-charge'
import frostCharge from '../recipes/frost-charge'
import waterCharge from '../recipes/water-charge'
import snowCharge from '../recipes/snow-charge'
import windCharge from '../recipes/wind-charge'
import sandCharge from '../recipes/sand-charge'
import slimeCharge from '../recipes/slime-charge'
import poisonCharge from '../recipes/poison-charge'
import acidCharge from '../recipes/acid-charge'
import healingCharge from '../recipes/healing-charge'
import holyCharge from '../recipes/holy-charge'
import curseCharge from '../recipes/curse-charge'
import shadowCharge from '../recipes/shadow-charge'
import bloodCharge from '../recipes/blood-charge'
import ghostCharge from '../recipes/ghost-charge'
import warpCharge from '../recipes/warp-charge'
import teleportCharge from '../recipes/teleport-charge'
import spawnCharge from '../recipes/spawn-charge'
import despawnCharge from '../recipes/despawn-charge'
import shieldCharge from '../recipes/shield-charge'
import barrierCharge from '../recipes/barrier-charge'
import reflectCharge from '../recipes/reflect-charge'
import parryCharge from '../recipes/parry-charge'
import dashCharge from '../recipes/dash-charge'
import jumpCharge from '../recipes/jump-charge'
import landingCharge from '../recipes/landing-charge'
import comboCharge from '../recipes/combo-charge'
import targetCharge from '../recipes/target-charge'
import warningCharge from '../recipes/warning-charge'
import markerCharge from '../recipes/marker-charge'
import scanCharge from '../recipes/scan-charge'
import hologramCharge from '../recipes/hologram-charge'
import engineCharge from '../recipes/engine-charge'
import thrusterCharge from '../recipes/thruster-charge'
import exhaustCharge from '../recipes/exhaust-charge'
import embersRelease from '../recipes/embers-release'
import flameRelease from '../recipes/flame-release'
import meteorRelease from '../recipes/meteor-release'
import blastRelease from '../recipes/blast-release'
import shockwaveRelease from '../recipes/shockwave-release'
import dustRelease from '../recipes/dust-release'
import sparkRelease from '../recipes/spark-release'
import shardRelease from '../recipes/shard-release'
import runeRelease from '../recipes/rune-release'
import glyphRelease from '../recipes/glyph-release'
import beamRelease from '../recipes/beam-release'
import laserRelease from '../recipes/laser-release'
import plasmaRelease from '../recipes/plasma-release'
import electricRelease from '../recipes/electric-release'
import iceRelease from '../recipes/ice-release'
import frostRelease from '../recipes/frost-release'
import waterRelease from '../recipes/water-release'
import bubbleRelease from '../recipes/bubble-release'
import rainRelease from '../recipes/rain-release'
import snowRelease from '../recipes/snow-release'
import windRelease from '../recipes/wind-release'
import leafRelease from '../recipes/leaf-release'
import petalRelease from '../recipes/petal-release'
import sandRelease from '../recipes/sand-release'
import mudRelease from '../recipes/mud-release'
import slimeRelease from '../recipes/slime-release'
import poisonRelease from '../recipes/poison-release'
import acidRelease from '../recipes/acid-release'
import healingRelease from '../recipes/healing-release'
import curseRelease from '../recipes/curse-release'
import shadowRelease from '../recipes/shadow-release'
import bloodRelease from '../recipes/blood-release'
import ghostRelease from '../recipes/ghost-release'
import portalRelease from '../recipes/portal-release'
import warpRelease from '../recipes/warp-release'
import teleportRelease from '../recipes/teleport-release'
import spawnRelease from '../recipes/spawn-release'
import despawnRelease from '../recipes/despawn-release'
import shieldRelease from '../recipes/shield-release'
import barrierRelease from '../recipes/barrier-release'
import parryRelease from '../recipes/parry-release'
import dashRelease from '../recipes/dash-release'
import jumpRelease from '../recipes/jump-release'
import landingRelease from '../recipes/landing-release'
import footstepRelease from '../recipes/footstep-release'
import targetRelease from '../recipes/target-release'
import warningRelease from '../recipes/warning-release'
import scanRelease from '../recipes/scan-release'
import hologramRelease from '../recipes/hologram-release'
import engineRelease from '../recipes/engine-release'
import thrusterRelease from '../recipes/thruster-release'
import exhaustRelease from '../recipes/exhaust-release'
import embersTelegraph from '../recipes/embers-telegraph'
import flameTelegraph from '../recipes/flame-telegraph'
import meteorTelegraph from '../recipes/meteor-telegraph'
import blastTelegraph from '../recipes/blast-telegraph'
import shockwaveTelegraph from '../recipes/shockwave-telegraph'
import dustTelegraph from '../recipes/dust-telegraph'
import debrisTelegraph from '../recipes/debris-telegraph'
import sparkTelegraph from '../recipes/spark-telegraph'
import shardTelegraph from '../recipes/shard-telegraph'
import runeTelegraph from '../recipes/rune-telegraph'
import glyphTelegraph from '../recipes/glyph-telegraph'
import laserTelegraph from '../recipes/laser-telegraph'
import plasmaTelegraph from '../recipes/plasma-telegraph'
import electricTelegraph from '../recipes/electric-telegraph'
import iceTelegraph from '../recipes/ice-telegraph'
import frostTelegraph from '../recipes/frost-telegraph'
import waterTelegraph from '../recipes/water-telegraph'
import bubbleTelegraph from '../recipes/bubble-telegraph'
import rainTelegraph from '../recipes/rain-telegraph'
import snowTelegraph from '../recipes/snow-telegraph'
import windTelegraph from '../recipes/wind-telegraph'
import leafTelegraph from '../recipes/leaf-telegraph'
import petalTelegraph from '../recipes/petal-telegraph'
import sandTelegraph from '../recipes/sand-telegraph'
import mudTelegraph from '../recipes/mud-telegraph'
import slimeTelegraph from '../recipes/slime-telegraph'
import poisonTelegraph from '../recipes/poison-telegraph'
import acidTelegraph from '../recipes/acid-telegraph'
import healingTelegraph from '../recipes/healing-telegraph'
import holyTelegraph from '../recipes/holy-telegraph'
import curseTelegraph from '../recipes/curse-telegraph'
import shadowTelegraph from '../recipes/shadow-telegraph'
import bloodTelegraph from '../recipes/blood-telegraph'
import ghostTelegraph from '../recipes/ghost-telegraph'
import warpTelegraph from '../recipes/warp-telegraph'
import teleportTelegraph from '../recipes/teleport-telegraph'
import spawnTelegraph from '../recipes/spawn-telegraph'

// Assembled from src/recipes/<effect-id>.ts — one authored recipe per effect.
// Key insertion order matches the original record (tooling iterates it).
export const AUTHORED_EFFECT_RECIPES: Record<string, PfxAuthoredRecipe> = {
  fireball,
  explosion,
  'smoke-puff': smokePuff,
  'muzzle-flash': muzzleFlash,
  'hit-spark': hitSpark,
  'healing-aura': healingAura,
  'slash-trail': slashTrail,
  'loot-beam': lootBeam,
  'force-field': forceField,
  'footstep-dust': footstepDust,
  'shield-break': shieldBreak,
  'poison-cloud': poisonCloud,
  'ui-reward-burst': uiRewardBurst,
  'charge-telegraph': chargeTelegraph,
  'spawn-marker': spawnMarker,
  dissolve,
  'portal-idle-loop': portalIdleLoop,
  'projectile-trail': projectileTrail,
  'underwater-bubbles': underwaterBubbles,
  'snow-gust': snowGust,
  'low-health-screen-particles': lowHealthScreenParticles,
  'coin-pickup-sparkle': coinPickupSparkle,
  'critical-hit-burst': criticalHitBurst,
  'enemy-death-poof': enemyDeathPoof,
  'level-up-flare': levelUpFlare,
  'embers-burst': embersBurst,
  'spark-loop': sparkLoop,
  'electric-trail': electricTrail,
  'wind-impact': windImpact,
  'acid-idle': acidIdle,
  'portal-charge': portalCharge,
  'reflect-release': reflectRelease,
  'reward-telegraph': rewardTelegraph,
  'hologram-aura': hologramAura,
  'blast-beam': blastBeam,
  'glyph-ring': glyphRing,
  'water-cone': waterCone,
  'sand-spray': sandSpray,
  'curse-column': curseColumn,
  'spawn-screen': spawnScreen,
  'jump-pickup': jumpPickup,
  'target-break': targetBreak,
  'exhaust-hit': exhaustHit,
  'debris-miss': debrisMiss,
  'plasma-ambient': plasmaAmbient,
  'snow-spawn': snowSpawn,
  'poison-death': poisonDeath,
  'ghost-critical': ghostCritical,
  'barrier-low-health': barrierLowHealth,
  'flame-charge': flameCharge,
  'meteor-ring': meteorRing,
  'shockwave-spawn': shockwaveSpawn,
  'dust-loop': dustLoop,
  'debris-release': debrisRelease,
  'spark-cone': sparkCone,
  'shard-break': shardBreak,
  'glyph-trail': glyphTrail,
  'beam-telegraph': beamTelegraph,
  'laser-spray': laserSpray,
  'plasma-hit': plasmaHit,
  'electric-critical': electricCritical,
  'ice-impact': iceImpact,
  'frost-aura': frostAura,
  'water-column': waterColumn,
  'snow-idle': snowIdle,
  'wind-beam': windBeam,
  'petal-ambient': petalAmbient,
  'sand-burst': sandBurst,
  'mud-charge': mudCharge,
  'slime-ring': slimeRing,
  'acid-spawn': acidSpawn,
  'healing-loop': healingLoop,
  'holy-release': holyRelease,
  'curse-cone': curseCone,
  'shadow-break': shadowBreak,
  'blood-death': bloodDeath,
  'ghost-trail': ghostTrail,
  'portal-telegraph': portalTelegraph,
  'warp-spray': warpSpray,
  'teleport-hit': teleportHit,
  'despawn-impact': despawnImpact,
  'shield-aura': shieldAura,
  'barrier-column': barrierColumn,
  'dash-idle': dashIdle,
  'jump-beam': jumpBeam,
  'footstep-ambient': footstepAmbient,
  'pickup-burst': pickupBurst,
  'reward-charge': rewardCharge,
  'combo-ring': comboRing,
  'ui-pickup': uiPickup,
  'target-spawn': targetSpawn,
  'warning-loop': warningLoop,
  'marker-release': markerRelease,
  'scan-cone': scanCone,
  'hologram-break': hologramBreak,
  'thruster-trail': thrusterTrail,
  'exhaust-telegraph': exhaustTelegraph,
  'flame-burst': flameBurst,
  'meteor-burst': meteorBurst,
  'blast-burst': blastBurst,
  'shockwave-burst': shockwaveBurst,
  'dust-burst': dustBurst,
  'debris-burst': debrisBurst,
  'spark-burst': sparkBurst,
  'shard-burst': shardBurst,
  'rune-burst': runeBurst,
  'glyph-burst': glyphBurst,
  'beam-burst': beamBurst,
  'laser-burst': laserBurst,
  'plasma-burst': plasmaBurst,
  'electric-burst': electricBurst,
  'ice-burst': iceBurst,
  'frost-burst': frostBurst,
  'water-burst': waterBurst,
  'bubble-burst': bubbleBurst,
  'rain-burst': rainBurst,
  'snow-burst': snowBurst,
  'wind-burst': windBurst,
  'leaf-burst': leafBurst,
  'petal-burst': petalBurst,
  'mud-burst': mudBurst,
  'slime-burst': slimeBurst,
  'poison-burst': poisonBurst,
  'acid-burst': acidBurst,
  'healing-burst': healingBurst,
  'holy-burst': holyBurst,
  'curse-burst': curseBurst,
  'shadow-burst': shadowBurst,
  'blood-burst': bloodBurst,
  'ghost-burst': ghostBurst,
  'portal-burst': portalBurst,
  'warp-burst': warpBurst,
  'teleport-burst': teleportBurst,
  'spawn-burst': spawnBurst,
  'despawn-burst': despawnBurst,
  'shield-burst': shieldBurst,
  'barrier-burst': barrierBurst,
  'reflect-burst': reflectBurst,
  'parry-burst': parryBurst,
  'dash-burst': dashBurst,
  'jump-burst': jumpBurst,
  'landing-burst': landingBurst,
  'footstep-burst': footstepBurst,
  'reward-burst': rewardBurst,
  'combo-burst': comboBurst,
  'ui-burst': uiBurst,
  'target-burst': targetBurst,
  'warning-burst': warningBurst,
  'marker-burst': markerBurst,
  'scan-burst': scanBurst,
  'hologram-burst': hologramBurst,
  'engine-burst': engineBurst,
  'thruster-burst': thrusterBurst,
  'exhaust-burst': exhaustBurst,
  'embers-loop': embersLoop,
  'flame-loop': flameLoop,
  'debris-loop': debrisLoop,
  'shard-loop': shardLoop,
  'rune-loop': runeLoop,
  'glyph-loop': glyphLoop,
  'beam-loop': beamLoop,
  'laser-loop': laserLoop,
  'plasma-loop': plasmaLoop,
  'electric-loop': electricLoop,
  'ice-loop': iceLoop,
  'frost-loop': frostLoop,
  'water-loop': waterLoop,
  'bubble-loop': bubbleLoop,
  'rain-loop': rainLoop,
  'snow-loop': snowLoop,
  'wind-loop': windLoop,
  'leaf-loop': leafLoop,
  'petal-loop': petalLoop,
  'sand-loop': sandLoop,
  'mud-loop': mudLoop,
  'slime-loop': slimeLoop,
  'poison-loop': poisonLoop,
  'acid-loop': acidLoop,
  'holy-loop': holyLoop,
  'curse-loop': curseLoop,
  'shadow-loop': shadowLoop,
  'blood-loop': bloodLoop,
  'ghost-loop': ghostLoop,
  'portal-loop': portalLoop,
  'warp-loop': warpLoop,
  'teleport-loop': teleportLoop,
  'spawn-loop': spawnLoop,
  'despawn-loop': despawnLoop,
  'shield-loop': shieldLoop,
  'barrier-loop': barrierLoop,
  'reflect-loop': reflectLoop,
  'parry-loop': parryLoop,
  'dash-loop': dashLoop,
  'jump-loop': jumpLoop,
  'landing-loop': landingLoop,
  'footstep-loop': footstepLoop,
  'pickup-loop': pickupLoop,
  'reward-loop': rewardLoop,
  'combo-loop': comboLoop,
  'ui-loop': uiLoop,
  'target-loop': targetLoop,
  'marker-loop': markerLoop,
  'scan-loop': scanLoop,
  'hologram-loop': hologramLoop,
  'engine-loop': engineLoop,
  'thruster-loop': thrusterLoop,
  'exhaust-loop': exhaustLoop,
  'embers-trail': embersTrail,
  'flame-trail': flameTrail,
  'meteor-trail': meteorTrail,
  'blast-trail': blastTrail,
  'shockwave-trail': shockwaveTrail,
  'dust-trail': dustTrail,
  'debris-trail': debrisTrail,
  'spark-trail': sparkTrail,
  'shard-trail': shardTrail,
  'rune-trail': runeTrail,
  'beam-trail': beamTrail,
  'laser-trail': laserTrail,
  'plasma-trail': plasmaTrail,
  'ice-trail': iceTrail,
  'frost-trail': frostTrail,
  'water-trail': waterTrail,
  'bubble-trail': bubbleTrail,
  'rain-trail': rainTrail,
  'snow-trail': snowTrail,
  'wind-trail': windTrail,
  'leaf-trail': leafTrail,
  'petal-trail': petalTrail,
  'sand-trail': sandTrail,
  'mud-trail': mudTrail,
  'slime-trail': slimeTrail,
  'poison-trail': poisonTrail,
  'acid-trail': acidTrail,
  'healing-trail': healingTrail,
  'holy-trail': holyTrail,
  'curse-trail': curseTrail,
  'shadow-trail': shadowTrail,
  'blood-trail': bloodTrail,
  'portal-trail': portalTrail,
  'warp-trail': warpTrail,
  'teleport-trail': teleportTrail,
  'spawn-trail': spawnTrail,
  'despawn-trail': despawnTrail,
  'shield-trail': shieldTrail,
  'barrier-trail': barrierTrail,
  'reflect-trail': reflectTrail,
  'parry-trail': parryTrail,
  'dash-trail': dashTrail,
  'jump-trail': jumpTrail,
  'landing-trail': landingTrail,
  'footstep-trail': footstepTrail,
  'target-trail': targetTrail,
  'warning-trail': warningTrail,
  'marker-trail': markerTrail,
  'scan-trail': scanTrail,
  'hologram-trail': hologramTrail,
  'engine-trail': engineTrail,
  'exhaust-trail': exhaustTrail,
  'embers-impact': embersImpact,
  'flame-impact': flameImpact,
  'meteor-impact': meteorImpact,
  'blast-impact': blastImpact,
  'shockwave-impact': shockwaveImpact,
  'dust-impact': dustImpact,
  'debris-impact': debrisImpact,
  'spark-impact': sparkImpact,
  'shard-impact': shardImpact,
  'rune-impact': runeImpact,
  'glyph-impact': glyphImpact,
  'beam-impact': beamImpact,
  'laser-impact': laserImpact,
  'plasma-impact': plasmaImpact,
  'electric-impact': electricImpact,
  'frost-impact': frostImpact,
  'water-impact': waterImpact,
  'snow-impact': snowImpact,
  'leaf-impact': leafImpact,
  'petal-impact': petalImpact,
  'sand-impact': sandImpact,
  'mud-impact': mudImpact,
  'slime-impact': slimeImpact,
  'poison-impact': poisonImpact,
  'acid-impact': acidImpact,
  'holy-impact': holyImpact,
  'curse-impact': curseImpact,
  'shadow-impact': shadowImpact,
  'blood-impact': bloodImpact,
  'ghost-impact': ghostImpact,
  'portal-impact': portalImpact,
  'warp-impact': warpImpact,
  'teleport-impact': teleportImpact,
  'shield-impact': shieldImpact,
  'barrier-impact': barrierImpact,
  'reflect-impact': reflectImpact,
  'parry-impact': parryImpact,
  'dash-impact': dashImpact,
  'jump-impact': jumpImpact,
  'landing-impact': landingImpact,
  'footstep-impact': footstepImpact,
  'target-impact': targetImpact,
  'warning-impact': warningImpact,
  'marker-impact': markerImpact,
  'scan-impact': scanImpact,
  'hologram-impact': hologramImpact,
  'engine-impact': engineImpact,
  'thruster-impact': thrusterImpact,
  'exhaust-impact': exhaustImpact,
  'embers-idle': embersIdle,
  'flame-idle': flameIdle,
  'dust-idle': dustIdle,
  'debris-idle': debrisIdle,
  'spark-idle': sparkIdle,
  'shard-idle': shardIdle,
  'rune-idle': runeIdle,
  'glyph-idle': glyphIdle,
  'beam-idle': beamIdle,
  'laser-idle': laserIdle,
  'plasma-idle': plasmaIdle,
  'electric-idle': electricIdle,
  'ice-idle': iceIdle,
  'frost-idle': frostIdle,
  'water-idle': waterIdle,
  'bubble-idle': bubbleIdle,
  'rain-idle': rainIdle,
  'wind-idle': windIdle,
  'leaf-idle': leafIdle,
  'petal-idle': petalIdle,
  'sand-idle': sandIdle,
  'mud-idle': mudIdle,
  'slime-idle': slimeIdle,
  'poison-idle': poisonIdle,
  'healing-idle': healingIdle,
  'holy-idle': holyIdle,
  'curse-idle': curseIdle,
  'shadow-idle': shadowIdle,
  'blood-idle': bloodIdle,
  'ghost-idle': ghostIdle,
  'portal-idle': portalIdle,
  'warp-idle': warpIdle,
  'teleport-idle': teleportIdle,
  'spawn-idle': spawnIdle,
  'despawn-idle': despawnIdle,
  'shield-idle': shieldIdle,
  'barrier-idle': barrierIdle,
  'reflect-idle': reflectIdle,
  'parry-idle': parryIdle,
  'jump-idle': jumpIdle,
  'landing-idle': landingIdle,
  'footstep-idle': footstepIdle,
  'pickup-idle': pickupIdle,
  'reward-idle': rewardIdle,
  'combo-idle': comboIdle,
  'ui-idle': uiIdle,
  'target-idle': targetIdle,
  'warning-idle': warningIdle,
  'marker-idle': markerIdle,
  'scan-idle': scanIdle,
  'hologram-idle': hologramIdle,
  'engine-idle': engineIdle,
  'thruster-idle': thrusterIdle,
  'exhaust-idle': exhaustIdle,
  'embers-charge': embersCharge,
  'meteor-charge': meteorCharge,
  'blast-charge': blastCharge,
  'shockwave-charge': shockwaveCharge,
  'dust-charge': dustCharge,
  'debris-charge': debrisCharge,
  'spark-charge': sparkCharge,
  'shard-charge': shardCharge,
  'rune-charge': runeCharge,
  'glyph-charge': glyphCharge,
  'beam-charge': beamCharge,
  'laser-charge': laserCharge,
  'plasma-charge': plasmaCharge,
  'electric-charge': electricCharge,
  'ice-charge': iceCharge,
  'frost-charge': frostCharge,
  'water-charge': waterCharge,
  'snow-charge': snowCharge,
  'wind-charge': windCharge,
  'sand-charge': sandCharge,
  'slime-charge': slimeCharge,
  'poison-charge': poisonCharge,
  'acid-charge': acidCharge,
  'healing-charge': healingCharge,
  'holy-charge': holyCharge,
  'curse-charge': curseCharge,
  'shadow-charge': shadowCharge,
  'blood-charge': bloodCharge,
  'ghost-charge': ghostCharge,
  'warp-charge': warpCharge,
  'teleport-charge': teleportCharge,
  'spawn-charge': spawnCharge,
  'despawn-charge': despawnCharge,
  'shield-charge': shieldCharge,
  'barrier-charge': barrierCharge,
  'reflect-charge': reflectCharge,
  'parry-charge': parryCharge,
  'dash-charge': dashCharge,
  'jump-charge': jumpCharge,
  'landing-charge': landingCharge,
  'combo-charge': comboCharge,
  'target-charge': targetCharge,
  'warning-charge': warningCharge,
  'marker-charge': markerCharge,
  'scan-charge': scanCharge,
  'hologram-charge': hologramCharge,
  'engine-charge': engineCharge,
  'thruster-charge': thrusterCharge,
  'exhaust-charge': exhaustCharge,
  'embers-release': embersRelease,
  'flame-release': flameRelease,
  'meteor-release': meteorRelease,
  'blast-release': blastRelease,
  'shockwave-release': shockwaveRelease,
  'dust-release': dustRelease,
  'spark-release': sparkRelease,
  'shard-release': shardRelease,
  'rune-release': runeRelease,
  'glyph-release': glyphRelease,
  'beam-release': beamRelease,
  'laser-release': laserRelease,
  'plasma-release': plasmaRelease,
  'electric-release': electricRelease,
  'ice-release': iceRelease,
  'frost-release': frostRelease,
  'water-release': waterRelease,
  'bubble-release': bubbleRelease,
  'rain-release': rainRelease,
  'snow-release': snowRelease,
  'wind-release': windRelease,
  'leaf-release': leafRelease,
  'petal-release': petalRelease,
  'sand-release': sandRelease,
  'mud-release': mudRelease,
  'slime-release': slimeRelease,
  'poison-release': poisonRelease,
  'acid-release': acidRelease,
  'healing-release': healingRelease,
  'curse-release': curseRelease,
  'shadow-release': shadowRelease,
  'blood-release': bloodRelease,
  'ghost-release': ghostRelease,
  'portal-release': portalRelease,
  'warp-release': warpRelease,
  'teleport-release': teleportRelease,
  'spawn-release': spawnRelease,
  'despawn-release': despawnRelease,
  'shield-release': shieldRelease,
  'barrier-release': barrierRelease,
  'parry-release': parryRelease,
  'dash-release': dashRelease,
  'jump-release': jumpRelease,
  'landing-release': landingRelease,
  'footstep-release': footstepRelease,
  'target-release': targetRelease,
  'warning-release': warningRelease,
  'scan-release': scanRelease,
  'hologram-release': hologramRelease,
  'engine-release': engineRelease,
  'thruster-release': thrusterRelease,
  'exhaust-release': exhaustRelease,
  'embers-telegraph': embersTelegraph,
  'flame-telegraph': flameTelegraph,
  'meteor-telegraph': meteorTelegraph,
  'blast-telegraph': blastTelegraph,
  'shockwave-telegraph': shockwaveTelegraph,
  'dust-telegraph': dustTelegraph,
  'debris-telegraph': debrisTelegraph,
  'spark-telegraph': sparkTelegraph,
  'shard-telegraph': shardTelegraph,
  'rune-telegraph': runeTelegraph,
  'glyph-telegraph': glyphTelegraph,
  'laser-telegraph': laserTelegraph,
  'plasma-telegraph': plasmaTelegraph,
  'electric-telegraph': electricTelegraph,
  'ice-telegraph': iceTelegraph,
  'frost-telegraph': frostTelegraph,
  'water-telegraph': waterTelegraph,
  'bubble-telegraph': bubbleTelegraph,
  'rain-telegraph': rainTelegraph,
  'snow-telegraph': snowTelegraph,
  'wind-telegraph': windTelegraph,
  'leaf-telegraph': leafTelegraph,
  'petal-telegraph': petalTelegraph,
  'sand-telegraph': sandTelegraph,
  'mud-telegraph': mudTelegraph,
  'slime-telegraph': slimeTelegraph,
  'poison-telegraph': poisonTelegraph,
  'acid-telegraph': acidTelegraph,
  'healing-telegraph': healingTelegraph,
  'holy-telegraph': holyTelegraph,
  'curse-telegraph': curseTelegraph,
  'shadow-telegraph': shadowTelegraph,
  'blood-telegraph': bloodTelegraph,
  'ghost-telegraph': ghostTelegraph,
  'warp-telegraph': warpTelegraph,
  'teleport-telegraph': teleportTelegraph,
  'spawn-telegraph': spawnTelegraph,
}
