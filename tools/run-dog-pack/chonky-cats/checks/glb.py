import json, struct, numpy as np, sys
def load(path):
    b = open(path,'rb').read()
    assert b[:4]==b'glTF'
    off=12; js=None; bin_=None
    while off < len(b):
        ln, typ = struct.unpack_from('<II', b, off); off+=8
        chunk=b[off:off+ln]; off+=ln
        if typ==0x4E4F534A: js=json.loads(chunk)
        else: bin_=chunk
    return js, bin_
CT={5126:('f',4),5123:('H',2),5121:('B',1),5125:('I',4),5122:('h',2),5120:('b',1)}
NC={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}
def acc(js,bin_,i):
    a=js['accessors'][i]; bv=js['bufferViews'][a['bufferView']]
    fmt,sz=CT[a['componentType']]; n=NC[a['type']]
    start=bv.get('byteOffset',0)+a.get('byteOffset',0)
    stride=bv.get('byteStride',sz*n)
    out=np.zeros((a['count'],n))
    for k in range(a['count']):
        out[k]=struct.unpack_from('<'+fmt*n, bin_, start+k*stride)
    if a.get('normalized'):
        mx={5123:65535,5121:255,5122:32767,5120:127}[a['componentType']]
        out=np.maximum(out/mx,-1)
    return out
def anims(path):
    js,bin_=load(path)
    res={}
    for an in js['animations']:
        ch={}
        for c in an['channels']:
            s=an['samplers'][c['sampler']]
            node=js['nodes'][c['target']['node']]['name']
            ch[(node,c['target']['path'])]=(acc(js,bin_,s['input'])[:,0], acc(js,bin_,s['output']), s.get('interpolation','LINEAR'))
        res[an['name']]=ch
    return js,res
