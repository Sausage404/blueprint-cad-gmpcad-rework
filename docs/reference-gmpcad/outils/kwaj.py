"""Décompresse les fichiers MS-Setup « KWAJ » (méthodes 0, 1, 2 et 3 = LZ + Huffman).
Usage : python3 -I kwaj.py fichier_entree fichier_sortie
"""
import struct
import sys


class Bits:
    """Lecture de bits, poids fort en premier."""

    def __init__(self, data, pos):
        self.data = data
        self.pos = pos  # octet suivant
        self.buf = 0
        self.n = 0
        self.total = (len(data) - pos) * 8
        self.used = 0

    def fill(self, need):
        while self.n < need:
            b = self.data[self.pos] if self.pos < len(self.data) else 0
            self.pos += 1
            self.buf = (self.buf << 8) | b
            self.n += 8

    def peek(self, k):
        self.fill(k)
        return (self.buf >> (self.n - k)) & ((1 << k) - 1)

    def skip(self, k):
        self.n -= k
        self.buf &= (1 << self.n) - 1
        self.used += k

    def read(self, k):
        v = self.peek(k)
        self.skip(k)
        return v

    @property
    def fini(self):
        return self.used > self.total


def read_lens(bits, typ, n):
    lens = [0] * n
    if typ == 0:
        c = {16: 4, 32: 5, 64: 6, 256: 8}[n]
        lens = [c] * n
    elif typ == 1:
        c = bits.read(4)
        lens[0] = c
        for i in range(1, n):
            if bits.read(1) == 0:
                lens[i] = c
            elif bits.read(1) == 0:
                c += 1
                lens[i] = c
            else:
                c = bits.read(4)
                lens[i] = c
    elif typ == 2:
        c = bits.read(4)
        lens[0] = c
        for i in range(1, n):
            sel = bits.read(2)
            if sel == 3:
                c = bits.read(4)
            else:
                c += sel - 1
            lens[i] = c
    elif typ == 3:
        for i in range(n):
            lens[i] = bits.read(4)
    else:
        raise ValueError('type de table inconnu %d' % typ)
    return lens


class Huff:
    """Code de Huffman canonique (codes attribués par longueur croissante, puis par symbole)."""

    def __init__(self, lens):
        self.maxlen = max(lens) or 1
        size = 1 << self.maxlen
        self.table = [None] * size
        code = 0
        for L in range(1, self.maxlen + 1):
            for sym, l in enumerate(lens):
                if l == L:
                    start = code << (self.maxlen - L)
                    for k in range(start, start + (1 << (self.maxlen - L))):
                        self.table[k] = (sym, L)
                    code += 1
            code <<= 1

    def decode(self, bits):
        e = self.table[bits.peek(self.maxlen)]
        if e is None:
            raise ValueError('code de Huffman invalide')
        bits.skip(e[1])
        return e[0]


def lzh(data, pos):
    bits = Bits(data, pos)
    types = [bits.read(4) for _ in range(6)]  # 6 types lus (alignement sur l'octet), 5 utilisés
    t_ml1 = Huff(read_lens(bits, types[0], 16))
    t_ml2 = Huff(read_lens(bits, types[1], 16))
    t_ll = Huff(read_lens(bits, types[2], 32))
    t_off = Huff(read_lens(bits, types[3], 64))
    t_lit = Huff(read_lens(bits, types[4], 256))
    window = bytearray(b' ' * 4096)
    wpos = 0
    out = bytearray()
    lit_run = False
    while True:
        length = (t_ml2 if lit_run else t_ml1).decode(bits)
        if bits.fini:
            break
        if length > 0:
            length += 2
            lit_run = False
            offset = t_off.decode(bits) << 6
            offset |= bits.read(6)
            if bits.fini:
                break
            for _ in range(length):
                b = window[(wpos - offset) & 4095]
                window[wpos] = b
                out.append(b)
                wpos = (wpos + 1) & 4095
        else:
            length = t_ll.decode(bits) + 1
            lit_run = length != 32
            for _ in range(length):
                b = t_lit.decode(bits)
                if bits.fini:
                    return bytes(out)
                window[wpos] = b
                out.append(b)
                wpos = (wpos + 1) & 4095
    return bytes(out)


def szdd_lzss(data, pos):
    window = bytearray(b' ' * 4096)
    wpos = 4096 - 16
    out = bytearray()
    i = pos
    while i < len(data):
        flags = data[i]
        i += 1
        for bit in range(8):
            if i >= len(data):
                break
            if flags & (1 << bit):
                b = data[i]
                i += 1
                window[wpos] = b
                out.append(b)
                wpos = (wpos + 1) & 4095
            else:
                if i + 1 >= len(data):
                    i = len(data)
                    break
                lo, hi = data[i], data[i + 1]
                i += 2
                mpos = lo | ((hi & 0xF0) << 4)
                mlen = (hi & 0x0F) + 3
                for _ in range(mlen):
                    b = window[mpos]
                    window[wpos] = b
                    out.append(b)
                    wpos = (wpos + 1) & 4095
                    mpos = (mpos + 1) & 4095
    return bytes(out)


def kwaj(data):
    assert data[:8] == b'KWAJ\x88\xf0\x27\xd1', 'pas un fichier KWAJ'
    method, dataoff, flags = struct.unpack_from('<HHH', data, 8)
    p = 14
    length = None
    name = None
    if flags & 1:
        (length,) = struct.unpack_from('<I', data, p)
        p += 4
    if flags & 2:
        p += 2
    if flags & 4:
        (n,) = struct.unpack_from('<H', data, p)
        p += 2 + n
    if flags & 8:
        e = data.index(0, p)
        name = data[p:e].decode('latin-1')
        p = e + 1
    if flags & 16:
        e = data.index(0, p)
        name = (name or '') + '.' + data[p:e].decode('latin-1')
        p = e + 1
    if method == 0:
        out = data[dataoff:]
    elif method == 1:
        out = bytes(b ^ 0xFF for b in data[dataoff:])
    elif method == 2:
        out = szdd_lzss(data, dataoff)
    elif method == 3:
        out = lzh(data, dataoff)
    else:
        raise ValueError('méthode KWAJ %d non gérée' % method)
    if length is not None:
        out = out[:length]
    return out, name


if __name__ == '__main__':
    src, dst = sys.argv[1], sys.argv[2]
    out, name = kwaj(open(src, 'rb').read())
    open(dst, 'wb').write(out)
    print(f'{src} -> {dst} ({len(out)} octets){" nom: " + name if name else ""}')
