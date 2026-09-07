"""Build the wound, cover, dressing, and leg brace for the patient asset."""
from pathlib import Path
import math
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'source-assets/patient/treatment-parts.glb'
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

def point(p):
    return (p[0], -p[2], p[1])

def group(name, parent=None):
    o=bpy.data.objects.new(name,None); bpy.context.collection.objects.link(o); o.parent=parent
    return o

root=group('PatientRoot')
chest=group('Chest',root)

def material(name, color, rough=.9, metal=0):
    m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(1,1,1,1)
    bs.inputs['Roughness'].default_value=rough;bs.inputs['Metallic'].default_value=metal
    attr=m.node_tree.nodes.new('ShaderNodeVertexColor');attr.layer_name='Surface'
    m.node_tree.links.new(attr.outputs['Color'],bs.inputs['Base Color'])
    return m
skin=material('PatientSkin',(.43,.33,.23),.88)
linen=material('PatientLinen',(.25,.24,.18))
trousers=material('PatientTrousers',(.22,.185,.13))
leather=material('PatientLeather',(.042,.032,.025))
blood=material('PatientBlood',(.09,.012,.014),.56)
raw=material('PatientWound',(.18,.038,.04),.62)
metal=material('PatientIron',(.065,.065,.058),.53,.6)
thread=material('PatientThread',(.017,.012,.01))

objects=[]
def mesh(name,verts,faces,mat,parent=root, morph=False):
    data=bpy.data.meshes.new(name);data.from_pydata([point(p) for p in verts],[],faces);data.update()
    o=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(o);o.parent=parent
    data.materials.append(mat)
    for f in data.polygons:f.use_smooth=True
    colors=data.color_attributes.new(name='Surface',type='FLOAT_COLOR',domain='POINT')
    base=mat.diffuse_color
    for i,p in enumerate(verts):
        x,y,z=p
        noise=.91+.055*math.sin(x*417+z*173)*math.sin(z*491+y*211)+.045*math.sin(x*39+z*57)
        shade=1
        if mat==skin:
            bruise=math.exp(-((z+.06)/.105)**2)*(0.5+0.5*math.sin(x*24+1))
            shade-=bruise*.36
        if mat in (linen,trousers):shade-=.21*max(0,math.sin(x*31+z*23))
        colors.data[i].color=(base[0]*noise*shade,base[1]*noise*shade,base[2]*noise*shade,1)
    if morph:
        o.shape_key_add(name='Basis')
        for name,amp in [('Breath',.009),('Crushed',-.045)]:
            key=o.shape_key_add(name=name)
            for i,p in enumerate(verts):
                x,y,z=p
                envelope=math.exp(-((z+.10)/.26)**2)*max(0,min(1,(y+.82)/.16))
                key.data[i].co.z+=amp*envelope
    objects.append(o)
    return o

def tube(name, centers, radii, mat, parent=root, segments=16, wrinkles=0):
    verts=[];faces=[]
    for i,(c,r) in enumerate(zip(centers,radii)):
        tangent=Vector(centers[min(i+1,len(centers)-1)])-Vector(centers[max(0,i-1)])
        tangent.normalize();axis=tangent.cross(Vector((0,1,0)))
        if axis.length<.01:axis=tangent.cross(Vector((1,0,0)))
        axis.normalize();other=tangent.cross(axis).normalized()
        for j in range(segments):
            a=j*math.tau/segments
            w=1+wrinkles*(math.sin(i*1.5+a*4)+.4*math.sin(i*3-a*7))
            v=Vector(c)+axis*(r[0]*math.cos(a)*w)+other*(r[1]*math.sin(a)*w)
            verts.append(tuple(v))
            if i:
                k=i*segments+j;prev=(j+1)%segments
                faces.append((k,k-segments,(i-1)*segments+prev,i*segments+prev))
    faces.extend([tuple(range(segments-1,-1,-1)),tuple((len(centers)-1)*segments+j for j in range(segments))])
    return mesh(name,verts,faces,mat,parent)

def curve(name,points,rad,mat,parent=root):
    data=bpy.data.curves.new(name,'CURVE');data.dimensions='3D';data.bevel_depth=rad;data.bevel_resolution=2
    s=data.splines.new('POLY');s.points.add(len(points)-1)
    for dst,p in zip(s.points,points):dst.co=(*point(p),1)
    o=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(o);o.parent=parent
    bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.convert(target='MESH');o.select_set(False)
    # Recreate with the same color boundary as the other surfaces.
    verts=[(v.co.x,v.co.z,-v.co.y) for v in o.data.vertices];faces=[tuple(f.vertices) for f in o.data.polygons]
    bpy.data.objects.remove(o,do_unlink=True)
    return mesh(name,verts,faces,mat,parent)

# The cavity, shard, edges, closure, and dressing are individually addressable.
wound=group('WoundOpen',chest)
verts=[(0,-.682,.20)];faces=[]
for i in range(64):
    a=i*math.tau/64;r=1+.045*math.sin(a*9)
    verts.append((.033*math.cos(a)*r,-.629+.002*math.sin(a*5),.20+.094*math.sin(a)*r))
    faces.append((0,i+1,(i+1)%64+1))
mesh('WoundCavity',verts,faces,blood,wound)
for side in [-1,1]:
    curve('WoundEdge'+str(side),[(side*.033*math.sqrt(max(0,1-t*t)),-.627+.002*math.sin(t*17),.2+t*.094) for t in [-1+i*2/60 for i in range(61)]],.003,raw,wound)
shard=group('EmbeddedShard',chest)
mesh('Splinter',[(0,-.68,.18),(-.014,-.62,.20),(.008,-.55,.23),(.017,-.64,.24),(.008,-.665,.19)],[(0,1,2),(0,2,3),(0,3,4),(1,4,3,2)],metal,shard)
cover=group('WoundCovered',chest)
dressing=group('WoundDressed',chest)
for name,parent,width,length,mat in [('TornShirtFlap',cover,.16,.25,linen),('FoldedDressing',dressing,.12,.23,linen)]:
    verts=[];faces=[]
    for i in range(25):
        for j in range(17):
            x=(j/16-.5)*width;z=.20+(i/24-.5)*length
            y=-.616+.003*math.sin(i*1.3+j*.6)+.003*math.sin(j*1.5)
            verts.append((x,y,z))
            if i and j:k=i*17+j;faces.append((k,k-1,k-18,k-17))
    mesh(name,verts,faces,mat,parent)
closed=group('WoundClosed',chest)
mesh('ClosedSkin',[(-.038,-.629,.10),(.038,-.629,.10),(.038,-.629,.30),(-.038,-.629,.30)],[(0,1,2,3)],skin,closed)
curve('ClosedIncision',[(.002*math.sin(i*2),-.623,.112+i*.009) for i in range(21)],.0017,blood,closed)
for i in range(7):
    z=.132+i*.023
    curve('Suture'+str(i),[(-.024,-.626,z-.004),(-.01,-.62,z),(.014,-.62,z+.003),(.023,-.626,z+.004)],.0014,thread,closed)
# Blood is irregular and follows the local skin surface.
bruise=group('BloodLoss',chest)
for i in range(10):
    cx=.04*math.sin(i*2.8);cz=.20+.011*i
    verts=[(cx,-.626,cz)];faces=[]
    for j in range(20):
        a=j*math.tau/20;r=.008*(1+.3*math.sin(j*3+i))
        verts.append((cx+r*math.cos(a),-.625,cz+r*1.8*math.sin(a)));faces.append((0,j+1,(j+1)%20+1))
    mesh('BloodTrace'+str(i),verts,faces,blood,bruise)

# A loose leg splint remains distinct from the anatomy.
brace=group('LegBrace',root)
for side in [-1,1]:
    tube('Splint'+str(side),[(.12+side*.087,-.72,.56),(.15+side*.075,-.72,.92)],[(.012,.015),(.012,.015)],leather,brace,segments=8)
curve('BraceStrap',[(.055,-.68,.70),(.13,-.625,.70),(.21,-.68,.70)],.012,leather,brace)

# Export the treatment parts for the final body build.
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=str(OUT),export_format='GLB',use_selection=True,export_animations=False)
