"""Pose the RUN patient on the floor and preserve separate treatment controls."""
from pathlib import Path
import json, math, runpy
import bpy, bmesh
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'source-assets/patient'
OUT=ROOT/'public/assets/patient.glb'
runpy.run_path(str(ROOT/'scripts/prepare-patient-parts.py'),run_name='__main__')
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(SOURCE/'rigged.glb'))
rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
character=next(o for o in bpy.context.scene.objects if o.type=='MESH' and any(m.type=='ARMATURE' for m in o.modifiers))
rig.animation_data_clear()
for bone in rig.pose.bones:
    bone.matrix_basis.identity()
bpy.context.view_layer.update()

def head(name):return rig.matrix_world @ rig.pose.bones[name].head

def aim(name,child,target):
    bone=rig.pose.bones[name]
    origin=head(name)
    delta=(head(child)-origin).normalized().rotation_difference((target-origin).normalized())
    world=rig.matrix_world @ bone.matrix
    rotated=delta.to_matrix().to_4x4() @ world
    rotated.translation=world.translation
    bone.matrix=rig.matrix_world.inverted() @ rotated
    bpy.context.view_layer.update()

def solve(upper,lower,end,target,pole):
    start=head(upper);middle=head(lower);finish=head(end)
    a=(middle-start).length;b=(finish-middle).length
    distance=max(.001,min((target-start).length,a+b-.0001))
    direction=(target-start).normalized();bend=pole-start
    bend-=direction*bend.dot(direction);bend.normalize()
    along=(a*a-b*b+distance*distance)/(2*distance)
    elbow=start+direction*along+bend*math.sqrt(max(0,a*a-along*along))
    aim(upper,lower,elbow);aim(lower,end,start+direction*distance)

# Bend the elbows toward the hips. Raise the knees and keep the heels down.
for side,name in [(-1,'Right'),(1,'Left')]:
    shoulder=head(name+'Arm')
    hand=head(name+'Hand')
    actual_side=1 if shoulder.x>0 else -1
    target=Vector((actual_side*.31,-.16,.92))
    solve(name+'Arm',name+'ForeArm',name+'Hand',target,Vector((actual_side*.55,-.12,1.13)))
    foot=head(name+'Foot')
    target=Vector((actual_side*.15,foot.y-.10,foot.z+.24))
    solve(name+'UpLeg',name+'Leg',name+'Foot',target,Vector((actual_side*.23,-.8,.6)))

pose=Matrix.Translation((0,-1.20,-.78)) @ Matrix.Rotation(-math.pi/2,4,'X')
pivots={name:pose @ head(bone) for name,bone in [('LeftArm','LeftArm'),('RightArm','RightArm'),('LeftHand','LeftHand'),('RightHand','RightHand')]}

def classify(vertex):
    scores={}
    for weight in vertex.groups:
        name=character.vertex_groups[weight.group].name
        category='Torso'
        if name in ('Head','head_end','headfront','neck'):category='Head'
        for side in ('Left','Right'):
            if name in (side+'Shoulder',side+'Arm',side+'ForeArm'):category=side+'Arm'
            if name==side+'Hand':category=side+'Hand'
            if name in (side+'UpLeg',side+'Leg',side+'Foot',side+'ToeBase'):category=side+'Leg'
        scores[category]=scores.get(category,0)+weight.weight
    return max(scores,key=scores.get) if scores else 'Torso'
vertex_classes=[classify(v) for v in character.data.vertices]
face_classes=[]
for face in character.data.polygons:
    candidates=[vertex_classes[i] for i in face.vertices]
    face_classes.append(max(set(candidates),key=candidates.count))

deps=bpy.context.evaluated_depsgraph_get()
base=bpy.data.meshes.new_from_object(character.evaluated_get(deps),preserve_all_data_layers=True,depsgraph=deps)
base.transform(pose @ character.matrix_world)
for m in base.materials:
    if not m or not m.use_nodes:continue
    shader=m.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Emission Strength'].default_value=0
    shader.inputs['Metallic'].default_value=0
    shader.inputs['Roughness'].default_value=.87
    shader.inputs['Specular IOR Level'].default_value=.2

# Use the actual abdomen surface for both the wound and the arm target.
tree=BVHTree.FromPolygons([v.co for v in base.vertices],[list(f.vertices) for f in base.polygons])
wound_z=.08
hit,normal,_,_=tree.ray_cast(Vector((0,-wound_z,1)),Vector((0,0,-1)))
assert hit is not None,'The generated abdomen has no front surface'
wound_y=hit.z+.002
beam_hit,_,_,_=tree.ray_cast(Vector((0,.10,1)),Vector((0,0,-1)))
assert beam_hit is not None
beam_y=beam_hit.z+.09

# Keep the atlas and vertex data when the posed body is divided into movable parts.
for obj in list(bpy.context.scene.objects):bpy.data.objects.remove(obj,do_unlink=True)
def empty(name,parent=None):
    obj=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(obj);obj.parent=parent;return obj
root=empty('PatientRoot');chest=empty('Chest',root)
parts={'Torso':chest}
for side in ('Left','Right'):
    parts[side+'Arm']=empty(side+'Arm',root)
    parts[side+'Hand']=empty(side+'Hand',parts[side+'Arm'])
    parts[side+'Leg']=empty(side+'Leg',root)

# The cut is limited to the front of the abdomen.
cut=[]
for face in base.polygons:
    center=sum((base.vertices[i].co for i in face.vertices),Vector())/len(face.vertices)
    cut.append(center.z>wound_y-.04 and (center.x/.033)**2+((-center.y-wound_z)/.094)**2<1)

def subset(name,keep,parent,skin=False):
    data=base.copy();bm=bmesh.new();bm.from_mesh(data);bm.faces.ensure_lookup_table()
    bmesh.ops.delete(bm,geom=[f for f in bm.faces if not keep[f.index]],context='FACES')
    bmesh.ops.delete(bm,geom=[v for v in bm.verts if not v.link_faces],context='VERTS')
    bm.to_mesh(data);bm.free();data.update()
    obj=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(obj);obj.parent=parent
    for i,m in enumerate(data.materials):
        clone=m.copy();clone.name='PatientSkin' if skin else 'PatientClothing';data.materials[i]=clone
    if len(data.polygons)>18000:
        bpy.context.view_layer.objects.active=obj
        mod=obj.modifiers.new('Mesh budget','DECIMATE');mod.ratio=18000/len(data.polygons)
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return obj

body=[]
for category,parent in parts.items():
    keep=[kind==category and not cut[i] for i,kind in enumerate(face_classes)]
    if not any(keep):raise RuntimeError('Missing body partition: '+category)
    obj=subset('Torso' if category=='Torso' else category+'Surface',keep,parent,category in ('Torso','LeftHand','RightHand'))
    body.append(obj)
    if category=='Torso':
        obj.shape_key_add(name='Basis')
        for name,amplitude in [('Breath',.008),('Crushed',-.04)]:
            key=obj.shape_key_add(name=name)
            for vertex in key.data:
                x,y,z=vertex.co
                influence=math.exp(-((-y+.10)/.22)**2)*math.exp(-(x/.24)**4)*max(0,min(1,(z+.77)/.10))
                vertex.co.z+=amplitude*influence

# Import the tested treatment parts and align them to the generated skin.
previous=set(bpy.context.scene.objects)
bpy.ops.import_scene.gltf(filepath=str(SOURCE/'treatment-parts.glb'))
imported=set(bpy.context.scene.objects)-previous
parts_root=next(o for o in imported if o.name.startswith('PatientRoot'))
parts_chest=next(o for o in imported if o.name.startswith('Chest'))
for child in list(parts_chest.children):
    child.parent=chest
    child.location.y+=.20-wound_z
    child.location.z+=wound_y-(-.629)
for child in list(parts_root.children):
    if child!=parts_chest:child.parent=root
bpy.data.objects.remove(parts_chest,do_unlink=True);bpy.data.objects.remove(parts_root,do_unlink=True)
closed=bpy.data.objects['WoundClosed']
bpy.data.objects.remove(bpy.data.objects['ClosedSkin'],do_unlink=True)
closed_skin=subset('ClosedSkin',cut,closed,True)
# The copied skin already has the final world position.
closed_skin.location=-closed.location

# Set local origins at the anatomical joints without changing the assembled pose.
def pivot(obj,location):
    bpy.context.view_layer.update();children=[(c,c.matrix_world.copy()) for c in obj.children]
    matrix=obj.matrix_world.copy();matrix.translation=location;obj.matrix_world=matrix
    bpy.context.view_layer.update()
    for child,world in children:child.matrix_world=world
    bpy.context.view_layer.update()
pivot(chest,Vector((0,.10,-.75)))
for name in ('LeftArm','RightArm','LeftHand','RightHand'):pivot(parts[name],pivots[name])

# Validate the exported asset, not only the Blender scene.
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'patient.blend'))
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=str(OUT),export_format='GLB',use_selection=True,export_animations=False,export_morph=True,export_image_format='JPEG',export_image_quality=88,export_draco_mesh_compression_enable=True)
report={'asset':str(OUT.relative_to(ROOT)),'bytes':OUT.stat().st_size,'parts':list(parts),'wound':[0,wound_y,wound_z],'beam':[0,beam_y,-.10],'source':'RUN rig posed and partitioned in Blender','morphs':['Breath','Crushed']}
(SOURCE/'build.json').write_text(json.dumps(report,indent=2)+'\n')
layout='''// Generated by scripts/prepare-patient.py from the actual body surface.
export const PATIENT_LAYOUT = {
  floorY: -0.9,
  eyes: [0, -0.25, -0.50],
  wound: [0, %.6f, %.6f],
  care: [0.15, %.6f, %.6f],
  beam: [0, %.6f, -0.10],
  beamGripY: %.6f,
} as const;
'''%(wound_y+.006,wound_z,wound_y+.01,wound_z,beam_y,beam_y+.12)
(ROOT/'src/scene/patientLayout.ts').write_text(layout)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(OUT))
for name in ['Torso','Chest','LeftArm','RightArm','LeftHand','RightHand','WoundOpen','EmbeddedShard','WoundCovered','WoundClosed','WoundDressed','LegBrace']:
    assert bpy.data.objects.get(name),f'Missing patient control: {name}'
keys=bpy.data.objects['Torso'].data.shape_keys.key_blocks
assert 'Breath' in keys and 'Crushed' in keys
print(json.dumps(report))
