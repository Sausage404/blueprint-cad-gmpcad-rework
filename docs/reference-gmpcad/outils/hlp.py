"""Extrait le texte des rubriques d'un fichier d'aide WinHelp (.HLP) en texte brut.
Usage : python3 -I hlp.py fichier.hlp sortie.txt
Format décrit dans « helpfile.txt » (M. Winterhoff) ; seules les parties utiles au texte sont lues.
"""
import struct
import sys


def lz77(data, maxout=None):
    out = bytearray()
    i = 0
    n = len(data)
    while i < n:
        flags = data[i]
        i += 1
        for bit in range(8):
            if i >= n:
                break
            if flags & (1 << bit):
                if i + 1 >= n:
                    i = n
                    break
                (w,) = struct.unpack_from('<H', data, i)
                i += 2
                pos = (w & 0x0FFF) + 1
                ln = (w >> 12) + 3
                for _ in range(ln):
                    out.append(out[-pos])
            else:
                out.append(data[i])
                i += 1
    return bytes(out)


class Hlp:
    def __init__(self, data):
        self.d = data
        magic, dirstart, _free, size = struct.unpack_from('<IiiI', data, 0)
        assert magic == 0x00035F3F, 'pas un fichier WinHelp'
        self.files = self.read_btree_dir(dirstart)

    def internal(self, off):
        reserved, used, _flags = struct.unpack_from('<IIB', self.d, off)
        return off + 9, used

    def read_btree_dir(self, off):
        start, _ = self.internal(off)
        (magic, flags, pagesize, _struct, _z, _splits, root, _neg1, totalpages, nlevels, _entries) = struct.unpack_from(
            '<HHH16sHHHhHHI', self.d, start)
        assert magic == 0x293B, 'B-arbre invalide'
        pages = start + 38
        page = root
        for _ in range(nlevels - 1):  # descendre jusqu'à la première feuille
            p = pages + page * pagesize
            (_unused, _n, prev) = struct.unpack_from('<HHh', self.d, p)
            page = prev
        files = {}
        while page != -1:
            p = pages + page * pagesize
            (_unused, n, _prev, nxt) = struct.unpack_from('<HHhh', self.d, p)
            q = p + 8
            for _ in range(n):
                e = self.d.index(0, q)
                name = self.d[q:e].decode('latin-1')
                (fo,) = struct.unpack_from('<i', self.d, e + 1)
                files[name] = fo
                q = e + 5
            page = nxt
        return files

    def file(self, name):
        start, used = self.internal(self.files[name])
        return self.d[start:start + used]

    # ---- phrases (WinHelp 3.1 : |Phrases ; WinHelp 4 : |PhrIndex + |PhrImage)
    def phrases(self, minor):
        if '|Phrases' in self.files:
            p = self.file('|Phrases')
            num, oneh = struct.unpack_from('<HH', p, 0)
            if minor <= 16:
                offs_at = 4
                comp = False
            else:
                offs_at = 8
                comp = True
            offs = struct.unpack_from('<%dH' % (num + 1), p, offs_at)
            body = p[offs_at + 2 * (num + 1):]
            if comp:
                body = lz77(body)
            base = offs[0]
            return [body[offs[k] - base:offs[k + 1] - base] for k in range(num)], 'old'
        if '|PhrIndex' in self.files:
            idx = self.file('|PhrIndex')
            img = self.file('|PhrImage')
            (_magic, nentries, _cidx, phrimagesize, phrimagecsize, _u, bits_raw) = struct.unpack_from('<IIIIIIH', idx, 0)
            bitcount = bits_raw & 0x0F
            if phrimagesize != phrimagecsize:
                img = lz77(img)
            # Longueurs codées en unaire + bitcount bits
            data = idx[28:]  # en-tête PHRINDEXHDR de 28 octets
            pos = 0
            bitbuf = 0
            nbits = 0

            def getbit():
                nonlocal pos, bitbuf, nbits
                if nbits == 0:
                    (bitbuf,) = struct.unpack_from('<I', data, pos)
                    pos += 4
                    nbits = 32
                b = bitbuf & 1
                bitbuf >>= 1
                nbits -= 1
                return b

            out = []
            off = 0
            for _ in range(nentries):
                n = 1
                while getbit():
                    n += 1 << bitcount
                if getbit():
                    n += 1
                if bitcount > 1 and getbit():
                    n += 2
                if bitcount > 2 and getbit():
                    n += 4
                if bitcount > 3 and getbit():
                    n += 8
                if bitcount > 4 and getbit():
                    n += 16
                out.append(img[off:off + n])
                off += n
            return out, 'hall'
        return [], None

    def expand_old(self, s, phr):
        out = bytearray()
        i = 0
        while i < len(s):
            c = s[i]
            if 0 < c < 0x10 and i + 1 < len(s):
                num = 256 * (c - 1) + s[i + 1]
                i += 2
                k = num // 2
                if k < len(phr):
                    out += phr[k]
                    if num & 1:
                        out.append(0x20)
            else:
                out.append(c)
                i += 1
        return bytes(out)

    def expand_hall(self, s, phr):
        out = bytearray()
        i = 0
        while i < len(s):
            c = s[i]
            if c & 1 == 0:  # phrase 0..127
                k = c // 2
                out += phr[k] if k < len(phr) else b''
                i += 1
            elif c & 3 == 1:  # phrase 128 + ...
                k = 128 + (c // 4) * 256 + s[i + 1]
                out += phr[k] if k < len(phr) else b''
                i += 2
            elif c & 7 == 3:  # 1..32 octets bruts
                n = c // 8 + 1
                out += s[i + 1:i + 1 + n]
                i += 1 + n
            elif c & 15 == 7:  # espaces
                out += b' ' * (c // 16 + 1)
                i += 1
            else:  # c & 15 == 15 : zéros
                out += b'\0' * (c // 16 + 1)
                i += 1
        return bytes(out)

    def topics(self):
        sysf = self.file('|SYSTEM')
        (magic, minor, _major, _gendate, flags) = struct.unpack_from('<HHHIH', sysf, 0)
        assert magic == 0x036C
        if minor <= 16:
            blocksize, compressed = 2048, False
        else:
            compressed = flags in (4, 8)
            blocksize = 2048 if flags == 8 else 4096
        phr, kind = self.phrases(minor)
        topic = self.file('|TOPIC')
        bufs = []
        first = None
        for b in range(0, len(topic), blocksize):
            blk = topic[b:b + blocksize]
            if len(blk) < 12:
                break
            (_last, firstlink, _lasthdr) = struct.unpack_from('<iii', blk, 0)
            if first is None:
                first = firstlink
            bufs.append(lz77(blk[12:]) if compressed else blk[12:])
        span = 0x4000 if compressed else blocksize

        def lire(k, o, n, suite):
            """n octets du lien qui commence au bloc k, position o ; `suite` = octets déjà dans le bloc suivant."""
            if suite <= 0:
                return bufs[k][o:o + n]
            return bufs[k][o:o + n - suite] + bufs[k + 1][:suite]

        results = []
        cur_title = None
        cur_text = []
        pos = first
        vus = set()
        while pos is not None and pos >= 0 and pos not in vus:
            vus.add(pos)
            k, o = divmod(pos, span)
            o -= 12
            if k >= len(bufs) or o < 0:
                break
            hdr = bufs[k][o:o + 21]
            if len(hdr) < 21:
                break
            (blocksz, datalen2, _prev, nxt, datalen1, rtype) = struct.unpack_from('<iiiiiB', hdr, 0)
            if blocksz <= 0:
                break
            nk, no = divmod(nxt, span) if nxt >= 0 else (k, 0)
            suite = (no - 12) if nk == k + 1 else 0
            rec = lire(k, o, blocksz, suite)
            ld2 = rec[datalen1:]
            if datalen2 > blocksz - datalen1 and kind is not None:
                ld2 = self.expand_old(ld2, phr) if kind == 'old' else self.expand_hall(ld2, phr)
            if rtype == 0x02:
                if cur_title is not None or cur_text:
                    results.append((cur_title, cur_text))
                cur_title = ld2.split(b'\0')[0].decode('cp1252', 'replace')
                cur_text = []
            elif rtype in (0x20, 0x23):
                parts = [x.decode('cp1252', 'replace') for x in ld2.split(b'\0')]
                line = ' '.join(x for x in parts if x.strip())
                if line.strip():
                    cur_text.append(line)
            pos = nxt if nxt != -1 else None
        if cur_title is not None or cur_text:
            results.append((cur_title, cur_text))
        return results, dict(minor=minor, flags=flags, phrases=kind, nphr=len(phr))


if __name__ == '__main__':
    h = Hlp(open(sys.argv[1], 'rb').read())
    res, info = h.topics()
    with open(sys.argv[2], 'w', encoding='utf-8') as f:
        for title, lines in res:
            f.write('\n=== ' + (title or '(sans titre)') + '\n')
            for l in lines:
                f.write(l + '\n')
    print(info, 'fichiers internes:', sorted(h.files), 'rubriques:', len(res))
