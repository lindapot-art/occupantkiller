#!/usr/bin/env python3
"""
Convert a BabylonJS .babylon (JSON) file to GLTF 2.0 binary (.glb)
Usage: python3 babylon2glb.py input.babylon output.glb
"""
import json, struct, sys, os, math, array

def pad4(n):
    return (n + 3) & ~3

def pack_f32(lst):
    return struct.pack(f"{len(lst)}f", *lst)

def pack_u16(lst):
    return struct.pack(f"{len(lst)}H", *lst)

def pack_u32(lst):
    return struct.pack(f"{len(lst)}I", *lst)

def euler_to_quat(rx, ry, rz):
    """BabylonJS uses YXZ Euler order → quaternion"""
    cx, sx = math.cos(rx/2), math.sin(rx/2)
    cy, sy = math.cos(ry/2), math.sin(ry/2)
    cz, sz = math.cos(rz/2), math.sin(rz/2)
    qx = sx*cy*cz + cx*sy*sz
    qy = cx*sy*cz - sx*cy*sz
    qz = cx*cy*sz + sx*sy*cz
    qw = cx*cy*cz - sx*sy*sz
    return [qx, qy, qz, qw]

def convert(src, dst):
    with open(src) as f:
        scene = json.load(f)

    # Build material lookup
    mat_map = {}
    for mat in scene.get("materials", []):
        d = mat.get("diffuse", [0.8, 0.8, 0.8])
        a = float(mat.get("alpha", 1.0))
        mat_map[mat["id"]] = {"baseColor": [d[0], d[1], d[2], a]}

    # GLTF structures
    gltf = {
        "asset": {"version": "2.0", "generator": "babylon2glb.py"},
        "scene": 0,
        "scenes": [{"nodes": []}],
        "nodes": [],
        "meshes": [],
        "materials": [],
        "accessors": [],
        "bufferViews": [],
        "buffers": [{"byteLength": 0}]
    }

    gltf_materials = []
    gltf_mat_index = {}  # mat_id → index in gltf_materials

    bin_parts = []
    byte_offset = 0

    def add_accessor(data_bytes, count, component_type, accessor_type, min_v=None, max_v=None):
        nonlocal byte_offset
        # Align to component size
        csize = {5120:1,5121:1,5122:2,5123:2,5125:4,5126:4}[component_type]
        # pad bin_parts to alignment
        rem = byte_offset % csize
        if rem:
            padding = bytes(csize - rem)
            bin_parts.append(padding)
            byte_offset += len(padding)

        bv_idx = len(gltf["bufferViews"])
        gltf["bufferViews"].append({
            "buffer": 0,
            "byteOffset": byte_offset,
            "byteLength": len(data_bytes)
        })
        bin_parts.append(data_bytes)
        byte_offset += len(data_bytes)

        acc = {
            "bufferView": bv_idx,
            "byteOffset": 0,
            "componentType": component_type,
            "count": count,
            "type": accessor_type
        }
        if min_v is not None: acc["min"] = list(min_v)
        if max_v is not None: acc["max"] = list(max_v)
        idx = len(gltf["accessors"])
        gltf["accessors"].append(acc)
        return idx

    def get_mat_index(mat_id):
        if mat_id not in gltf_mat_index:
            info = mat_map.get(mat_id, {"baseColor": [0.8,0.8,0.8,1.0]})
            bc = info["baseColor"]
            gltf_mat_index[mat_id] = len(gltf["materials"])
            gltf["materials"].append({
                "name": mat_id or "default",
                "pbrMetallicRoughness": {
                    "baseColorFactor": [bc[0], bc[1], bc[2], bc[3]],
                    "metallicFactor": 0.0,
                    "roughnessFactor": 0.8
                },
                "alphaMode": "BLEND" if bc[3] < 1.0 else "OPAQUE",
                "doubleSided": True
            })
        return gltf_mat_index[mat_id]

    mesh_count = 0

    for bm in scene.get("meshes", []):
        if not bm.get("isVisible", True):
            continue

        positions = bm.get("positions", [])
        indices   = bm.get("indices", [])

        if not positions or not indices:
            continue  # skip empty / pivot meshes

        # Positions
        pos_flat = list(map(float, positions))
        v_count = len(pos_flat) // 3
        pos_bytes = pack_f32(pos_flat)
        # min/max for accessor
        xs = pos_flat[0::3]; ys = pos_flat[1::3]; zs = pos_flat[2::3]
        pos_acc = add_accessor(pos_bytes, v_count, 5126, "VEC3",
                               [min(xs),min(ys),min(zs)], [max(xs),max(ys),max(zs)])

        attrs = {"POSITION": pos_acc}

        # Normals
        normals = bm.get("normals", [])
        if normals and len(normals) == len(positions):
            nor_bytes = pack_f32(list(map(float, normals)))
            nor_acc = add_accessor(nor_bytes, v_count, 5126, "VEC3")
            attrs["NORMAL"] = nor_acc

        # UVs
        uvs = bm.get("uvs", [])
        if uvs:
            uv_flat = list(map(float, uvs))
            # flip V for GLTF (V = 1 - V)
            uv_flipped = []
            for k in range(0, len(uv_flat), 2):
                uv_flipped.append(uv_flat[k])
                uv_flipped.append(1.0 - uv_flat[k+1])
            uv_bytes = pack_f32(uv_flipped)
            uv_acc = add_accessor(uv_bytes, v_count, 5126, "VEC2")
            attrs["TEXCOORD_0"] = uv_acc

        # Indices
        idx_list = list(map(int, indices))
        idx_count = len(idx_list)
        if v_count > 65535:
            idx_bytes = pack_u32(idx_list)
            idx_acc = add_accessor(idx_bytes, idx_count, 5125, "SCALAR")
        else:
            idx_bytes = pack_u16(idx_list)
            idx_acc = add_accessor(idx_bytes, idx_count, 5123, "SCALAR")

        # Material
        mat_id = bm.get("materialId", None)
        mat_idx = get_mat_index(mat_id)

        # Sub-mesh primitives (use subMeshes if available, else whole mesh)
        submeshes = bm.get("subMeshes", [])
        if submeshes and len(submeshes) > 1:
            primitives = []
            for sm in submeshes:
                # Create per-submesh accessor slices
                # indices slice
                si = sm.get("indexStart", 0)
                ic = sm.get("indexCount", idx_count)
                sub_idx = idx_list[si:si+ic]
                if not sub_idx: continue
                vi = sm.get("verticesStart", 0)
                vc = sm.get("verticesCount", v_count)
                # re-compute sub positions
                sub_pos = pos_flat[vi*3:(vi+vc)*3]
                sx2 = sub_pos[0::3]; sy2 = sub_pos[1::3]; sz2 = sub_pos[2::3]
                sub_pos_acc = add_accessor(pack_f32(sub_pos), vc, 5126, "VEC3",
                                           [min(sx2),min(sy2),min(sz2)],[max(sx2),max(sy2),max(sz2)])
                sub_attrs = {"POSITION": sub_pos_acc}
                if "NORMAL" in attrs:
                    sub_nor = list(map(float, normals))[vi*3:(vi+vc)*3]
                    sub_attrs["NORMAL"] = add_accessor(pack_f32(sub_nor), vc, 5126, "VEC3")
                # adjust indices to be relative to verticesStart
                if vi > 0:
                    sub_idx = [ii - vi for ii in sub_idx]
                if vc > 65535:
                    sub_idx_bytes = pack_u32(sub_idx)
                    sub_idx_acc = add_accessor(sub_idx_bytes, len(sub_idx), 5125, "SCALAR")
                else:
                    sub_idx_bytes = pack_u16(sub_idx)
                    sub_idx_acc = add_accessor(sub_idx_bytes, len(sub_idx), 5123, "SCALAR")
                sm_mat = get_mat_index(mat_id)
                primitives.append({"attributes": sub_attrs, "indices": sub_idx_acc, "material": sm_mat})
        else:
            primitives = [{"attributes": attrs, "indices": idx_acc, "material": mat_idx}]

        mesh_idx = len(gltf["meshes"])
        gltf["meshes"].append({"name": bm.get("name","mesh_"+str(mesh_count)), "primitives": primitives})
        mesh_count += 1

        # Node
        pos3 = bm.get("position", [0,0,0])
        rot3 = bm.get("rotation", [0,0,0])
        sc3  = bm.get("scaling", [1,1,1])
        quat = euler_to_quat(rot3[0], rot3[1], rot3[2])

        node = {
            "name": bm.get("name","node_"+str(mesh_idx)),
            "mesh": mesh_idx,
            "translation": [float(pos3[0]), float(pos3[1]), float(pos3[2])],
            "rotation":    [float(quat[0]), float(quat[1]), float(quat[2]), float(quat[3])],
            "scale":       [float(sc3[0]),  float(sc3[1]),  float(sc3[2])],
        }
        nidx = len(gltf["nodes"])
        gltf["nodes"].append(node)
        gltf["scenes"][0]["nodes"].append(nidx)

    # Finalize binary buffer
    bin_data = b"".join(bin_parts)
    # Pad to 4 bytes
    rem = len(bin_data) % 4
    if rem:
        bin_data += bytes(4 - rem)
    gltf["buffers"][0]["byteLength"] = len(bin_data)

    # Serialize JSON chunk
    json_str = json.dumps(gltf, separators=(",",":"))
    json_bytes = json_str.encode("utf-8")
    # Pad to 4 bytes with spaces
    rem = len(json_bytes) % 4
    if rem:
        json_bytes += b" " * (4 - rem)

    # Build GLB
    json_chunk_len = len(json_bytes)
    bin_chunk_len  = len(bin_data)
    total_len = 12 + 8 + json_chunk_len + 8 + bin_chunk_len

    with open(dst, "wb") as f:
        # Header
        f.write(struct.pack("<III", 0x46546C67, 2, total_len))
        # JSON chunk
        f.write(struct.pack("<II", json_chunk_len, 0x4E4F534A))
        f.write(json_bytes)
        # BIN chunk
        f.write(struct.pack("<II", bin_chunk_len, 0x004E4942))
        f.write(bin_data)

    print(f"✓ {os.path.basename(src)} → {os.path.basename(dst)}  ({len(gltf['meshes'])} meshes, {len(gltf['materials'])} materials, {total_len//1024}KB)")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python3 babylon2glb.py input.babylon output.glb")
        sys.exit(1)
    convert(sys.argv[1], sys.argv[2])
