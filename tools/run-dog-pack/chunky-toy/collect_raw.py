"""Copy finished Hunyuan3D chunky-toy meshes from asset-bot runs into raw/<slug>.glb (newest run wins)."""
import glob, json, os, shutil

here = os.path.dirname(os.path.abspath(__file__))
runs = sorted(glob.glob(os.path.join(here, '../.asset-bot/runs/*/run-record.json')))
for f in runs:
    d = json.load(open(f))
    if d.get('category') != 'chunky-toy' or d.get('operationId') != 'generate-3d' or d.get('status') != 'completed':
        continue
    slug = d['prompt'].split(' ')[0]
    glb = glob.glob(os.path.join(os.path.dirname(f), 'candidates/*/candidate_001.glb'))
    if glb:
        shutil.copy(glb[0], os.path.join(here, 'raw', slug + '.glb'))
print(len(os.listdir(os.path.join(here, 'raw'))), 'raw meshes')
