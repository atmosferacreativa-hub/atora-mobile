#!/usr/bin/env python3
"""Comprueba que las bibliotecas nativas (.so) de un APK o AAB soportan páginas de 16 KB.

Google Play exige, para apps que apuntan a Android 15+, que cada segmento PT_LOAD de las .so
de 64 bits (arm64-v8a, x86_64) esté alineado a 16 KB (p_align >= 16384). Además, en el APK las .so
sin comprimir deben estar alineadas a 16 KB dentro del ZIP (se comprueba aparte con zipalign -P 16).

Uso: check-16kb.py <archivo.apk|archivo.aab> [...]
Sale con código 1 si alguna .so de 64 bits no cumple.
"""
import struct
import sys
import zipfile

PT_LOAD = 1
MIN_ALIGN = 16384
ABIS_64 = ("arm64-v8a", "x86_64")


def load_aligns(data: bytes):
    if data[:4] != b"\x7fELF":
        raise ValueError("no es ELF")
    is64 = data[4] == 2
    endian = "<" if data[5] == 1 else ">"
    if is64:
        phoff = struct.unpack_from(endian + "Q", data, 0x20)[0]
        phentsize, phnum = struct.unpack_from(endian + "HH", data, 0x36)
    else:
        phoff = struct.unpack_from(endian + "I", data, 0x1C)[0]
        phentsize, phnum = struct.unpack_from(endian + "HH", data, 0x2A)
    out = []
    for i in range(phnum):
        off = phoff + i * phentsize
        p_type = struct.unpack_from(endian + "I", data, off)[0]
        if p_type != PT_LOAD:
            continue
        if is64:
            p_align = struct.unpack_from(endian + "Q", data, off + 0x30)[0]
        else:
            p_align = struct.unpack_from(endian + "I", data, off + 0x1C)[0]
        out.append(p_align)
    return out


def check(path: str) -> int:
    bad = 0
    total = 0
    with zipfile.ZipFile(path) as zf:
        for name in zf.namelist():
            if not name.endswith(".so"):
                continue
            if not any(f"/{abi}/" in f"/{name}" for abi in ABIS_64):
                continue
            total += 1
            aligns = load_aligns(zf.read(name))
            low = [a for a in aligns if a < MIN_ALIGN]
            if low:
                bad += 1
                print(f"FAIL {name}: PT_LOAD p_align={sorted(set(aligns))}")
    print(f"{path}: {total} .so de 64 bits, {bad} sin alineación de 16 KB")
    return bad


def main(argv):
    if len(argv) < 2:
        print(__doc__)
        return 2
    bad = sum(check(p) for p in argv[1:])
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
