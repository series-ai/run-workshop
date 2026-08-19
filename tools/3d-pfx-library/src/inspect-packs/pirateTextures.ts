import confetti from '../../assets/pirate-nation/ui-rarities-grayscale-confetti.png'
import godrays from '../../assets/pirate-nation/ui-general-vfx-godrays-01.png'
import softCircle from '../../assets/pirate-nation/ui-general-vfx-circle-soft.png'
import sheen from '../../assets/pirate-nation/ui-general-vfx-sheen.png'
import smoke from '../../assets/pirate-nation/T_Smoke_Big_2x2.png'
import glow from '../../assets/pirate-nation/T_Glow_Heptagon_Soft.png'
import cloudCards from '../../assets/pirate-nation/T_VFX_CloudCards.png'
import cloudVr from '../../assets/pirate-nation/T_VFX_CloudVR.png'
import voxelNoise from '../../assets/pirate-nation/T_VoxelNoise.png'
import shieldFx from '../../assets/pirate-nation/shield_fx.png'
import sparkle from '../../assets/pirate-nation/vfx_sparkle.png'
import statusUp from '../../assets/pirate-nation/T_Status_Buff_Up_BC.png'
import statusBuff from '../../assets/pirate-nation/T_Status_Buff_BC.png'
import statusDebuff from '../../assets/pirate-nation/T_Status_Debuff_BC.png'
import statusAttack from '../../assets/pirate-nation/T_Status_Buff_Attack_BC.png'
import crossedSabers from '../../assets/pirate-nation/T_CrossedSabers.png'
import statusShieldBroken from '../../assets/pirate-nation/T_Status_Shield_Broken.png'

export const PIRATE_TEXTURE_URLS: Record<string, string> = {
  confetti,
  godrays,
  'soft-circle': softCircle,
  sheen,
  smoke,
  glow,
  clouds: cloudCards,
  'cloud-vr': cloudVr,
  'voxel-noise': voxelNoise,
  'shield-fx': shieldFx,
  sparkle,
  'status-up': statusUp,
  'status-buff': statusBuff,
  'status-debuff': statusDebuff,
  'status-attack': statusAttack,
  sabers: crossedSabers,
  'shield-broken': statusShieldBroken,
}
