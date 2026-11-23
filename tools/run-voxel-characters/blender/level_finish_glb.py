"""Export the material textures for the Cubix level meshes."""

import struct
import zlib
from math import isfinite

import voxchar as vk
from level_scene_glb import linear_color


GRAIN_SIZE = 16
FLAT_FACE_TEXEL = -999 % GRAIN_SIZE
GRAIN_TRANSFORM = 'KHR_texture_transform'
GRAIN_REPEAT = {'scale': [1 / GRAIN_SIZE, 1 / GRAIN_SIZE], 'offset': [1 / 4096, 1 / 4096]}
EMISSIVE_STRENGTH = 'KHR_materials_emissive_strength'


def load_finishes():
    data = vk.load_json('level-finishes.json')
    regions = data['regions']
    if set(regions) != set(vk.REGIONS):
        raise ValueError('Level finishes must define every palette region.')
    for name, pair in {**regions, 'water': data['water'], 'glass': data['glass']}.items():
        if len(pair) != 2 or not all(type(value) in (int, float) and 0 <= value <= 1 for value in pair):
            raise ValueError(f'{name}: level finish needs roughness and metalness from 0 to 1.')
    opacity = data['glassOpacity']
    strength = data['emissiveStrength']
    if (type(opacity) not in (int, float) or not 0 <= opacity <= 1
            or type(strength) not in (int, float) or not isfinite(strength) or strength <= 0):
        raise ValueError('Invalid opacity or lamp strength in level finishes.')
    grain = data['grain']
    if len(grain) != GRAIN_SIZE or any(
            len(row) != GRAIN_SIZE or any(type(pixel) is not int or not 0 <= pixel <= 255 for pixel in row)
            for row in grain):
        raise ValueError('The level grain needs a 16 by 16 table of byte values.')
    if grain[FLAT_FACE_TEXEL][FLAT_FACE_TEXEL] != 255:
        raise ValueError('The flat-face grain texel must be white.')
    return data


FINISHES = load_finishes()
GRAIN = FINISHES['grain']


def level_builder():
    builder = vk.GlbBuilder()
    builder.doc['materials'] = []
    return builder


def _png_chunk(kind, data):
    chunk = kind + data
    return struct.pack('>I', len(data)) + chunk + struct.pack('>I', zlib.crc32(chunk))


def _rgb_png(width, rows):
    return (b'\x89PNG\r\n\x1a\n'
            + _png_chunk(b'IHDR', struct.pack('>IIBBBBB', width, len(rows), 8, 2, 0, 0, 0))
            + _png_chunk(b'IDAT', zlib.compress(b''.join(b'\x00' + row for row in rows)))
            + _png_chunk(b'IEND', b''))


def finish_png(surface):
    values = [FINISHES[surface] if surface else FINISHES['regions'][region]
              for region in vk.REGIONS]
    # glTF reads roughness from green and metalness from blue.
    row = b''.join(bytes((255, round(rough * 255), round(metal * 255))) for rough, metal in values)
    return _rgb_png(len(values), [row])


def grain_png():
    # The flat voxel coordinates (-999, -999) repeat to texel (9, 9), which is white.
    return _rgb_png(GRAIN_SIZE, [bytes(value for gray in row for value in (gray, gray, gray))
                               for row in GRAIN])


def lamp_png():
    # Ordinary shading uses V at most 0.85. Lamps use V equal to 0.96.
    return _rgb_png(1, [b'\x00' * 3] * 7 + [b'\xff' * 3])


def lamp_color(mesh, palette):
    return palette['accent'] if (mesh.uvs[:, 1] > 0.92).any() else None


def add_texture(builder, name, png, sampler):
    images = builder.doc.setdefault('images', [])
    textures = builder.doc.setdefault('textures', [])
    for index, texture in enumerate(textures):
        if texture.get('name') == name:
            return index
    images.append({'bufferView': builder._view(png), 'mimeType': 'image/png'})
    textures.append({'name': name, 'sampler': sampler, 'source': len(images) - 1})
    return len(textures) - 1


def add_finish(builder, surface, lamp):
    doc = builder.doc
    materials = doc['materials']
    name = f'{vk.MATERIAL_NAME}_{surface.title()}' if surface else vk.MATERIAL_NAME
    if lamp:
        name += f'_Lamp_{lamp[1:]}'

    if 'textures' not in doc:
        doc.setdefault('extensionsUsed', []).append(GRAIN_TRANSFORM)
        # The finish lookup uses nearest sampling. The grain repeats and uses mipmaps.
        doc['samplers'] = [
            {'magFilter': 9728, 'minFilter': 9728, 'wrapS': 33071, 'wrapT': 33071},
            {'magFilter': 9728, 'minFilter': 9987, 'wrapS': 10497, 'wrapT': 10497},
        ]
    for index, material in enumerate(materials):
        if material['name'] == name:
            return index

    grain = add_texture(builder, 'Cubix cell grain', grain_png(), 1)
    finish_name = f'Cubix {surface or "palette"} finish'
    finish = add_texture(builder, finish_name, finish_png(surface), 0)
    material = {
        'name': name,
        'doubleSided': surface == 'glass',
        'pbrMetallicRoughness': {
            'baseColorFactor': [1, 1, 1, FINISHES['glassOpacity'] if surface == 'glass' else 1],
            'metallicFactor': 1,
            'roughnessFactor': 1,
            'baseColorTexture': {
                'index': grain,
                'texCoord': 1,
                'extensions': {GRAIN_TRANSFORM: GRAIN_REPEAT},
            },
            'metallicRoughnessTexture': {'index': finish},
        },
    }
    if surface == 'glass':
        material['alphaMode'] = 'BLEND'
    if lamp:
        if EMISSIVE_STRENGTH not in doc['extensionsUsed']:
            doc['extensionsUsed'].append(EMISSIVE_STRENGTH)
        mask = add_texture(builder, 'Cubix lamp mask', lamp_png(), 0)
        material['emissiveFactor'] = linear_color(lamp)
        material['emissiveTexture'] = {'index': mask}
        material['extensions'] = {EMISSIVE_STRENGTH: {'emissiveStrength': FINISHES['emissiveStrength']}}
    materials.append(material)
    return len(materials) - 1


def add_level_mesh(builder, mesh, colors, surface, lamp):
    material = add_finish(builder, surface, lamp)
    return builder.add_mesh(mesh, colors=colors, material_groups=[(material, mesh.indices)])
