#!/usr/bin/env python3
"""
Extrait quelques instruments d'une banque de sons SoundFont (.sf2 / .sf3) pour l'alléger.

    python3 -I scripts/trim-soundfont.py MuseScore_General.sf3 public/soundfont/string-coach.sf3

Instruments gardés (banque, preset General MIDI) : guitares nylon et acier,
basses acoustique et doigts, violon, ensemble de cordes, batterie standard.
Les échantillons compressés (sf3, Ogg Vorbis) sont recopiés tels quels : seules les
positions dans le bloc de données sont recalculées.
"""
import struct
import sys

KEEP = [(0, 24), (0, 25), (0, 32), (0, 33), (0, 40), (0, 48), (128, 0)]


def chunks(data, start, end):
    """Itère sur les sous-blocs RIFF : (id, début des données, taille)."""
    pos = start
    while pos < end:
        cid = data[pos:pos + 4]
        size = struct.unpack_from('<I', data, pos + 4)[0]
        yield cid, pos + 8, size
        pos += 8 + size + (size & 1)


def records(buf, size):
    return [buf[i:i + size] for i in range(0, len(buf), size)]


def main(src, dst):
    data = open(src, 'rb').read()
    assert data[:4] == b'RIFF' and data[8:12] == b'sfbk', 'pas une banque SoundFont'
    lists = {}
    for cid, off, size in chunks(data, 12, len(data)):
        if cid == b'LIST':
            lists[data[off:off + 4]] = (off + 4, off + size)
    info_start, info_end = lists[b'INFO']
    sdta = {cid: data[off:off + size] for cid, off, size in chunks(data, *lists[b'sdta'])}
    pdta = {cid: data[off:off + size] for cid, off, size in chunks(data, *lists[b'pdta'])}
    smpl = sdta[b'smpl']

    phdr = records(pdta[b'phdr'], 38)
    pbag = records(pdta[b'pbag'], 4)
    pmod = records(pdta[b'pmod'], 10)
    pgen = records(pdta[b'pgen'], 4)
    inst = records(pdta[b'inst'], 22)
    ibag = records(pdta[b'ibag'], 4)
    imod = records(pdta[b'imod'], 10)
    igen = records(pdta[b'igen'], 4)
    shdr = records(pdta[b'shdr'], 46)

    def zones(bags, gens, mods, first, last):
        """Zones (générateurs, modulateurs) d'un preset ou instrument."""
        out = []
        for b in range(first, last):
            g0, m0 = struct.unpack('<HH', bags[b])
            g1, m1 = struct.unpack('<HH', bags[b + 1])
            out.append((gens[g0:g1], mods[m0:m1]))
        return out

    # Presets gardés
    kept_presets = []
    for i in range(len(phdr) - 1):
        preset, bank = struct.unpack_from('<HH', phdr[i], 20)
        if (bank, preset) in KEEP:
            bag0 = struct.unpack_from('<H', phdr[i], 24)[0]
            bag1 = struct.unpack_from('<H', phdr[i + 1], 24)[0]
            kept_presets.append((phdr[i], zones(pbag, pgen, pmod, bag0, bag1)))
    found = {struct.unpack_from('<HH', p[0], 20)[::-1] for p in kept_presets}
    missing = [k for k in KEEP if k not in found]
    if missing:
        print('Absents de la banque :', missing)

    # Instruments utilisés (générateur 41)
    inst_map = {}
    for _, zs in kept_presets:
        for gens, _ in zs:
            for g in gens:
                op, amt = struct.unpack('<HH', g)
                if op == 41 and amt not in inst_map:
                    inst_map[amt] = len(inst_map)
    kept_insts = []
    for old in sorted(inst_map, key=inst_map.get):
        bag0 = struct.unpack_from('<H', inst[old], 20)[0]
        bag1 = struct.unpack_from('<H', inst[old + 1], 20)[0]
        kept_insts.append((inst[old], zones(ibag, igen, imod, bag0, bag1)))

    # Échantillons utilisés (générateur 53), avec leurs échantillons liés (stéréo)
    sample_ids = set()
    for _, zs in kept_insts:
        for gens, _ in zs:
            for g in gens:
                op, amt = struct.unpack('<HH', g)
                if op == 53:
                    sample_ids.add(amt)
    changed = True
    while changed:
        changed = False
        for s in list(sample_ids):
            link, stype = struct.unpack_from('<HH', shdr[s], 42)
            # 2 = droite, 4 = gauche, 8 = lié : garder l'échantillon associé.
            if stype & 0x0E and link not in sample_ids and link < len(shdr) - 1:
                sample_ids.add(link)
                changed = True
    sample_map = {old: new for new, old in enumerate(sorted(sample_ids))}

    # Nouveau bloc de données et en-têtes d'échantillons
    new_smpl = bytearray()
    new_shdr = []
    for old in sorted(sample_ids):
        rec = bytearray(shdr[old])
        start, end, sloop, eloop = struct.unpack_from('<IIII', rec, 20)
        link, stype = struct.unpack_from('<HH', rec, 42)
        compressed = bool(stype & 0x10)
        if compressed:
            blob = smpl[start:end]
            new_start = len(new_smpl)
            new_smpl += blob
            struct.pack_into('<II', rec, 20, new_start, new_start + len(blob))
        else:
            blob = smpl[start * 2:end * 2]
            new_start = len(new_smpl) // 2
            new_smpl += blob + b'\0' * 92  # 46 échantillons de silence imposés par la norme
            shift = new_start - start
            struct.pack_into('<IIII', rec, 20, new_start, new_start + (end - start), sloop + shift, eloop + shift)
        struct.pack_into('<H', rec, 42, sample_map.get(link, 0))
        new_shdr.append(bytes(rec))
    new_shdr.append(shdr[-1])

    def rebuild(items, header_size, bag_offset, remap_op, remap):
        """Reconstruit en-têtes, sacs, générateurs et modulateurs."""
        heads, bags, gens, mods = [], [], [], []
        for head, zs in items:
            h = bytearray(head)
            struct.pack_into('<H', h, bag_offset, len(bags))
            heads.append(bytes(h))
            for zg, zm in zs:
                bags.append(struct.pack('<HH', len(gens), len(mods)))
                for g in zg:
                    op, amt = struct.unpack('<HH', g)
                    gens.append(struct.pack('<HH', op, remap[amt]) if op == remap_op else g)
                mods.extend(zm)
        return heads, bags, gens, mods

    p_heads, p_bags, p_gens, p_mods = rebuild(kept_presets, 38, 24, 41, inst_map)
    i_heads, i_bags, i_gens, i_mods = rebuild(kept_insts, 22, 20, 53, sample_map)
    # Terminaux
    eop = bytearray(phdr[-1]); struct.pack_into('<H', eop, 24, len(p_bags)); p_heads.append(bytes(eop))
    p_bags.append(struct.pack('<HH', len(p_gens), len(p_mods)))
    p_gens.append(b'\0' * 4); p_mods.append(b'\0' * 10)
    eoi = bytearray(inst[-1]); struct.pack_into('<H', eoi, 20, len(i_bags)); i_heads.append(bytes(eoi))
    i_bags.append(struct.pack('<HH', len(i_gens), len(i_mods)))
    i_gens.append(b'\0' * 4); i_mods.append(b'\0' * 10)

    def chunk(cid, payload):
        pad = b'\0' if len(payload) & 1 else b''
        return cid + struct.pack('<I', len(payload)) + payload + pad

    def lst(kind, body):
        return chunk(b'LIST', kind + body)

    info = data[info_start:info_end]
    sdta_body = chunk(b'smpl', bytes(new_smpl))
    pdta_body = b''.join([
        chunk(b'phdr', b''.join(p_heads)), chunk(b'pbag', b''.join(p_bags)),
        chunk(b'pmod', b''.join(p_mods)), chunk(b'pgen', b''.join(p_gens)),
        chunk(b'inst', b''.join(i_heads)), chunk(b'ibag', b''.join(i_bags)),
        chunk(b'imod', b''.join(i_mods)), chunk(b'igen', b''.join(i_gens)),
        chunk(b'shdr', b''.join(new_shdr)),
    ])
    body = b'sfbk' + lst(b'INFO', info) + lst(b'sdta', sdta_body) + lst(b'pdta', pdta_body)
    open(dst, 'wb').write(b'RIFF' + struct.pack('<I', len(body)) + body)
    names = [p[0][:20].split(b'\0')[0].decode('latin-1') for p in kept_presets]
    print(f'{len(kept_presets)} presets ({", ".join(names)}), {len(kept_insts)} instruments, '
          f'{len(new_shdr) - 1} échantillons, {len(new_smpl) / 1e6:.1f} Mo de données')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
