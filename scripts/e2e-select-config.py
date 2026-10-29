"""Copia config.yaml de Maestro dejando en flowsOrder solo los recorridos pedidos (en el orden de config.yaml).

Uso: e2e-select-config.py <config de origen> <config de destino> <recorrido>...
Los recorridos pedidos que no figuran en flowsOrder se agregan al final, en el orden pedido: con flowsOrder, Maestro
no garantizaba correr los que no estaban en la lista (en el CI se saltaba algunos en silencio).
"""
import sys


def main() -> None:
    src, dst, requested = sys.argv[1], sys.argv[2], sys.argv[3:]
    names = set(requested)
    out, in_order, listed, indent = [], False, [], "    - "
    for line in open(src, encoding="utf-8").read().splitlines():
        stripped = line.strip()
        if stripped == "flowsOrder:":
            in_order = True
            out.append(line)
            continue
        if in_order:
            if stripped.startswith("- "):
                name = stripped[2:].strip().strip('"\'')
                indent = line[: len(line) - len(line.lstrip())] + "- "
                if name in names:
                    out.append(line)
                    listed.append(name)
                continue
            if stripped and not stripped.startswith("#"):
                out.extend(indent + n for n in requested if n not in listed)
                listed.extend(n for n in requested if n not in listed)
                in_order = False
        out.append(line)
    if in_order:
        out.extend(indent + n for n in requested if n not in listed)
    open(dst, "w", encoding="utf-8").write("\n".join(out) + "\n")


if __name__ == "__main__":
    main()
