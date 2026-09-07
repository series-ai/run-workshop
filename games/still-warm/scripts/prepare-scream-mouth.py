"""Open the mouth seam in a copy of the provider scream clip."""
from pathlib import Path
import json
import math
import bpy
import bmesh
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'source-assets/assembled/scream-mouth'
OUTPUT.mkdir(parents=True, exist_ok=True)


def smooth(value):
    value = max(0.0, min(1.0, value))
    return value * value * (3.0 - 2.0 * value)


def seam(x):
    return 1.844 - 4.0 * x * x


bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = 30
bpy.ops.import_scene.gltf(filepath=str(ROOT / 'source-assets/assembled/animations/expanded/anim_386.glb'))
armature = next(obj for obj in scene.objects if obj.type == 'ARMATURE')
mesh = next(obj for obj in scene.objects if obj.type == 'MESH')
original_action = armature.animation_data.action
scene.frame_start = 0
scene.frame_end = round(original_action.frame_range[1])
scene.name = original_action.name
# Remove only triangles that cross the lip seam on the front of the face.
bm = bmesh.new()
bm.from_mesh(mesh.data)
remove = []
for face in bm.faces:
    center = mesh.matrix_world @ face.calc_center_median()
    if abs(center.x) > 0.041 or center.y > -0.065 or not 1.82 < center.z < 1.85:
        continue
    positions = [mesh.matrix_world @ vertex.co for vertex in face.verts]
    distances = [point.z - seam(point.x) for point in positions]
    if min(distances) <= 0.0 <= max(distances):
        remove.append(face)
removed_count = len(remove)
if removed_count < 10:
    raise ValueError('The mouth seam was not found.')
bmesh.ops.delete(bm, geom=remove, context='FACES_ONLY')
bm.to_mesh(mesh.data)
bm.free()
mesh.data.update()
mesh.shape_key_add(name='Basis')
shape = mesh.shape_key_add(name='ScreamOpen')
inverse_mesh = mesh.matrix_world.inverted()
changed = 0
for vertex in mesh.data.vertices:
    point = mesh.matrix_world @ vertex.co
    if abs(point.x) > .10 or point.y > .015 or not 1.75 < point.z < 1.86:
        continue
    front = smooth((.005 - point.y) / .065)
    width = 1.0 - smooth((abs(point.x) - .025) / .06)
    height = point.z - seam(point.x)
    if height < 0:
        mouth_width = max(0.0, 1.0 - (abs(point.x) / .043) ** 2) ** .7
        lip = 1.0 - smooth(-height / .025)
        jaw_width = width * (1.0 - lip) + mouth_width * lip
        weight = front * jaw_width * smooth((point.z - 1.755) / .04)
        point.z -= .044 * weight
        point.y += .009 * weight
    else:
        weight = front * width * (1.0 - smooth(height / .014))
        point.z += .003 * weight
    shape.data[vertex.index].co = inverse_mesh @ point
    changed += 1


def material(name, color):
    result = bpy.data.materials.new(name)
    result.diffuse_color = (*color, 1.0)
    result.use_nodes = True
    shader = result.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*color, 1.0)
    shader.inputs['Roughness'].default_value = 1.0
    shader.inputs['Specular IOR Level'].default_value = 0.0
    return result


interior = material('Mouth interior', (.004, .001, .001))
ivory = material('Broken teeth', (.36, .30, .20))
parts = []
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, -.030, 1.822))
cavity = bpy.context.object
cavity.name = 'MouthInterior'
cavity.scale = (.084, .070, .060)
cavity.data.materials.append(interior)
for polygon in cavity.data.polygons:
    polygon.use_smooth = True
parts.append(cavity)
for index, (x, length) in enumerate([(-.026, .008), (-.010, .011), (.007, .006), (.023, .009)]):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x, -.082, seam(x) + .005 - length / 2))
    tooth = bpy.context.object
    tooth.name = f'Tooth{index}'
    tooth.scale = (.009, .008, length)
    tooth.rotation_euler.y = [.14, -.12, .22, -.15][index]
    tooth.data.materials.append(ivory)
    bevel = tooth.modifiers.new('Worn edges', 'BEVEL')
    bevel.width = .1
    bevel.segments = 1
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    parts.append(tooth)
# Bind the interior and teeth to the existing head bone.
bpy.ops.object.select_all(action='DESELECT')
for part in parts:
    part.select_set(True)
bpy.context.view_layer.objects.active = cavity
bpy.ops.object.join()
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
group = cavity.vertex_groups.new(name='Head')
group.add(list(range(len(cavity.data.vertices))), 1.0, 'REPLACE')
modifier = cavity.modifiers.new('Head skin', 'ARMATURE')
modifier.object = armature
cavity.parent = armature
cavity.matrix_parent_inverse = armature.matrix_world.inverted()

# Open during the scream, then close before the end of the clip.
for frame in range(scene.frame_end + 1):
    time = frame / 30.0
    shape.value = smooth((time - .30) / .35) * (1.0 - smooth((time - 2.05) / .52))
    shape.keyframe_insert(data_path='value', frame=frame)
scene.frame_set(0)
path = OUTPUT / 'anim_386_mouth.glb'
bpy.ops.export_scene.gltf(
    filepath=str(path), export_format='GLB',
    export_animation_mode='SCENE', export_anim_scene_split_object=False,
    export_frame_range=True, export_frame_step=1,
    export_animations=True, export_morph=True, export_morph_animation=True,
    export_skins=True, export_morph_normal=True,
    export_draco_mesh_compression_enable=True,
)
(OUTPUT / 'build.json').write_text(json.dumps({
    'source': '../animations/expanded/anim_386.glb',
    'output': path.name, 'shape': 'ScreamOpen',
    'removedSeamTriangles': removed_count, 'jawVertices': changed,
    'duration': scene.frame_end / 30.0, 'bytes': path.stat().st_size,
}, indent=2) + '\n')
# Render the edited face at rest for inspection.
armature.animation_data_clear()
armature.data.pose_position = 'REST'
mesh.data.shape_keys.animation_data_clear()
scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x = 768
scene.render.resolution_y = 768
scene.render.resolution_percentage = 100
scene.world = bpy.data.worlds.new('Review world')
scene.world.color = (.2, .2, .2)
center = Vector((0, -.04, 1.90))
bpy.ops.object.camera_add(location=center + Vector((0, -1, 0)))
camera = bpy.context.object
scene.camera = camera
camera.rotation_euler = (center - camera.location).to_track_quat('-Z', 'Y').to_euler()
camera.data.type = 'ORTHO'
camera.data.ortho_scale = .38
bpy.ops.object.light_add(type='AREA', location=center + Vector((.3, -1, .5)))
light = bpy.context.object
light.data.energy = 55
light.data.size = .8
light.rotation_euler = (center - light.location).to_track_quat('-Z', 'Y').to_euler()
for name, value in [('closed', 0), ('open', 1)]:
    shape.value = value
    scene.render.filepath = f'/tmp/scream-mouth-{name}.png'
    bpy.ops.render.render(write_still=True)
