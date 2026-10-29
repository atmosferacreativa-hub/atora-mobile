"""Copia config.yaml de Maestro dejando en flowsOrder solo los recorridos pedidos (en el orden de config.yaml).

Uso: e2e-select-config.py <config de origen> <config de destino> <recorrido>...
Los recorridos pedidos que no figuran en flowsOrder quedan después, como hace Maestro con la carpeta completa.
"""
import sys


def main() -> None:
    src, dst, names = sys.argv[1], sys.argv[2], set(sys.argv[3:])
    out, in_order = [], False
    for line in open(src, encoding="utf-8").read().splitlines():
        stripped = line.strip()
        if stripped == "flowsOrder:":
            in_order = True
            out.append(line)
            continue
        if in_order:
            if stripped.startswith("- "):
                if stripped[2:].strip().strip('"\'') in names:
                    out.append(line)
                continue
            if stripped and not stripped.startswith("#"):
                in_order = False
        out.append(line)
    open(dst, "w", encoding="utf-8").write("\n".join(out) + "\n")


if __name__ == "__main__":
    main()
