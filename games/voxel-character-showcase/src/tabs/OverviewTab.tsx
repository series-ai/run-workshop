import { BUDGETS } from '@voxchar/contracts/budgets'
import { PACK_DEFS } from '@voxchar/contracts/packs'
import { RIG_SPECS, UAL1_CLIPS, UAL1_JOINTS } from '@voxchar/contracts/rig'
import { HUMANOID_VOXEL_SIZE, type PackCatalog } from '@voxchar/contracts/catalog'

export function OverviewTab({
  catalogs,
  onNavigate,
}: {
  catalogs: PackCatalog[]
  onNavigate: (tab: 'lab' | 'reviewer' | 'stage' | 'perf') => void
}) {
  const totalParts = catalogs.reduce((s, c) => s + c.parts.length, 0)
  const totalHeld = catalogs.reduce((s, c) => s + c.heldItems.length, 0)
  const totalProps = catalogs.reduce((s, c) => s + c.props.length, 0)
  const totalPresets = catalogs.reduce((s, c) => s + c.presets.length, 0)
  const voxelCm = Number((HUMANOID_VOXEL_SIZE * 100).toFixed(1))

  return (
    <div className="overview-page">
      <div className="hero-card">
        <h2>RUN Voxel Characters — Teardown-Style Voxel Avatar &amp; Context System</h2>
        <p>
          One canonical <strong>{UAL1_JOINTS.length}-joint Quaternius UAL1 CC0 skeleton</strong> with{' '}
          <strong>{UAL1_CLIPS.length} animation clips</strong> plus procedural{' '}
          <strong>23-joint Quadruped</strong> and <strong>28-joint Arachnid</strong> rigs driving rigid-segment{' '}
          <strong>{voxelCm} cm (<code>{HUMANOID_VOXEL_SIZE} m</code>) orthogonal voxel characters</strong>, 4 cm beasts and scrap-bots, modular outfits,
          and world props across <strong>Heist</strong>, <strong>Industrial</strong>, <strong>Security</strong>,
          and <strong>Creatures</strong> — engineered for <strong>120 Hz on Samsung Galaxy S23 Ultra</strong>.
        </p>
        <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
          <button className="btn-primary" onClick={() => onNavigate('lab')}>
            Open Parametric Voxel Lab
          </button>
          <button className="btn-secondary" onClick={() => onNavigate('reviewer')}>
            Open Animation Reviewer
          </button>
          <button className="btn-secondary" onClick={() => onNavigate('stage')}>
            View 4-Context Stage
          </button>
          <button className="btn-secondary" onClick={() => onNavigate('perf')}>
            Run S23 Ultra Perf Bench
          </button>
        </div>
      </div>

      <div className="card-grid">
        <div className="info-card">
          <h3>Pack Inventory ({totalParts + totalHeld + totalProps} Assets)</h3>
          <ul>
            <li><strong>{totalParts}</strong> modular rigid-segment voxel avatar &amp; creature parts</li>
            <li><strong>{totalHeld}</strong> canonical-grip voxel tools &amp; weapons (<code>hand_r</code> / <code>hand_l</code>)</li>
            <li><strong>{totalProps}</strong> grounded voxel world props</li>
            <li><strong>{totalPresets}</strong> cross-context character &amp; creature presets</li>
            <li>
              <strong>{UAL1_CLIPS.length}</strong> UAL1 clips + <strong>{RIG_SPECS.quadruped.clips.length}</strong> Quadruped &amp;{' '}
              <strong>{RIG_SPECS.arachnid.clips.length}</strong> Arachnid clips
            </li>
          </ul>
        </div>

        <div className="info-card">
          <h3>Teardown Voxel Art Direction</h3>
          <ul>
            <li><strong>Teardown Scale</strong>: one <code>{HUMANOID_VOXEL_SIZE} m</code> voxel size, 38–39 voxels tall, 7&times;3 chest, 2&times;2 neck &amp; arms, 3&times;3 thighs, 3&times;2 trouser / 2&times;2 bare calves, flush-back 3+1 shoes</li>
            <li><strong>Long &amp; Deep Faces</strong>: 3&times;5&times;4 skin skull (1 block forward on the flush-back neck for a 2-voxel chin overhang while the neck drops 1 block into the shirt neckline, 2 cheek columns ahead of ear, flush 1-voxel eyes, proud nose) inside a 5&times;7 head envelope</li>
            <li><strong>Exact Cubes</strong>: meshes sculpted on one lattice in the pose of the default proportions, so the runtime shows cubes; a flat torso box (trunk + yoke), weight <code>1.0</code> per segment</li>
            <li><strong>Zero-Texture Shading</strong>: Baked crevice AO + <code>TEXCOORD_1</code> per-voxel mottling, warm skin mosaic, dark-albedo floor, emissive cyber optics</li>
          </ul>
        </div>

        <div className="info-card">
          <h3>S23 Ultra 120 Hz Law</h3>
          <ul>
            <li>Composed avatar budget: <strong>&le; {BUDGETS.mobilePolicy.maxTrianglesPerComposedAvatar} tris</strong></li>
            <li>Draw calls per avatar: <strong>&le; {BUDGETS.mobilePolicy.maxDrawCallsPerAvatar}</strong> (1 shader program)</li>
            <li>Shadow maps: <strong>disabled</strong> (shared radial blob shadow)</li>
            <li>DPR cap: <strong>{BUDGETS.mobilePolicy.maxDpr}</strong> &middot; Distance mixer throttling (30/15 Hz)</li>
          </ul>
        </div>

        <div className="info-card">
          <h3>jam-ready-assets &amp; RUN SDK</h3>
          <ul>
            {Object.values(PACK_DEFS).map((p) => (
              <li key={p.dir}>
                <code>{p.dir}</code> ({p.license === 'CC0-1.0' ? 'CC0-1.0' : 'RUN Supp. v1.0'})
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
