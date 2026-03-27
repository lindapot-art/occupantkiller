#!/usr/bin/env python3
"""Generate tiny GLB placeholder files under supergame_extracted/example/model

Run: python3 tools/make_placeholders.py
"""
import os, struct, json, base64

MODEL_PATHS = [
    "model/biped_9/Meshy_AI_biped/Meshy_AI_Animation_run_fast_5_withSkin.glb",
    "model/fps_q1_1/fps_q1_1.glb",
    "model/fps_q2_1/fps_q2_1.glb",
    "model/fps_q3_2/fps_q3_2.glb",
    "model/npc_njs2/npc_njs2.glb",
    "model/xz_map1/xz_map1.glb",
    "model/putin_unrigged/Meshy_AI_biped/Meshy_AI_Animation_run_fast_5_withSkin.glb",
]

def pad4(b, pad_byte=b'\x00'):
    rem = (4 - (len(b) % 4)) % 4
    return b + pad_byte * rem

def write_minimal_glb(path, color=(0.6,0.6,0.6)):
    # Simple triangle positions and indices
    positions = [0.0,0.0,0.0, 1.0,0.0,0.0, 0.0,1.0,0.0]
    indices = [0,1,2]
    pos_bytes = struct.pack('<' + 'f'*len(positions), *positions)
    idx_bytes = struct.pack('<' + 'H'*len(indices), *indices)
    bin_buf = pos_bytes + idx_bytes
    bin_buf = pad4(bin_buf, pad_byte=b'\x00')
    bin_len = len(bin_buf)
    pos_min = [min(positions[i::3]) for i in range(3)]
    pos_max = [max(positions[i::3]) for i in range(3)]
    json_dict = {
        "asset": {"version":"2.0", "generator":"make_placeholders.py"},
        "buffers":[{"byteLength": bin_len}],
        "bufferViews":[
            {"buffer":0,"byteOffset":0,"byteLength":len(pos_bytes)},
            {"buffer":0,"byteOffset":len(pos_bytes),"byteLength":len(idx_bytes)}
        ],
        "accessors":[
            {"bufferView":0,"componentType":5126,"count":3,"type":"VEC3","min":pos_min,"max":pos_max},
            {"bufferView":1,"componentType":5123,"count":3,"type":"SCALAR"}
        ],
        "meshes":[{"primitives":[{"attributes":{"POSITION":0},"indices":1,"material":0}]}],
        "materials":[{"pbrMetallicRoughness":{"baseColorFactor":[color[0],color[1],color[2],1.0],"metallicFactor":0.0,"roughnessFactor":1.0}}],
        "nodes":[{"mesh":0}],
        "scenes":[{"nodes":[0]}],
        "scene":0
    }
    json_str = json.dumps(json_dict, separators=(',',':')).encode('utf-8')
    json_padded = pad4(json_str, pad_byte=b' ')
    json_chunk_header = struct.pack('<I4s', len(json_padded), b'JSON')
    bin_chunk_header  = struct.pack('<I4s', len(bin_buf), b'BIN\x00')
    total_len = 12 + 8 + len(json_padded) + 8 + len(bin_buf)
    header = struct.pack('<4sII', b'glTF', 2, total_len)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'wb') as f:
        f.write(header)
        f.write(json_chunk_header); f.write(json_padded)
        f.write(bin_chunk_header);  f.write(bin_buf)

def write_png(path):
    # 1x1 white PNG (base64)
    white_png_b64 = b'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII='
    data = base64.b64decode(white_png_b64)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'wb') as f:
        f.write(data)

def main():
    out_root = "supergame_extracted/example"
    created = []
    for p in MODEL_PATHS:
        out_path = os.path.join(out_root, p)
        if "fps_q1" in p or "q1" in p:
            col=(0.4,0.6,0.9)
        elif "fps_q2" in p or "q2" in p:
            col=(0.9,0.6,0.4)
        elif "fps_q3" in p or "q3" in p:
            col=(0.8,0.8,0.2)
        elif "putin" in p or "biped" in p:
            col=(0.8,0.2,0.2)
        else:
            col=(0.6,0.6,0.6)
        write_minimal_glb(out_path, color=col)
        created.append(out_path)
    # also create a generic placeholder file used by loader fallbacks
    placeholder_path = os.path.join(out_root, 'model', 'placeholder', 'placeholder.glb')
    write_minimal_glb(placeholder_path, color=(0.5,0.5,0.5))
    created.append(placeholder_path)
    write_png(os.path.join(out_root,"textures","white.png"))
    write_png(os.path.join(out_root,"textures","gray.png"))
    print("Created placeholders:")
    for c in created:
        print("  -", c)
    print("Textures: supergame_extracted/example/textures/white.png, gray.png")

if __name__ == '__main__':
    main()
