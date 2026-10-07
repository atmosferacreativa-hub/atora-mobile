#!/usr/bin/env python3
"""Aplica reemplazos exactos (lista de pares) y agrega el import de t. Uso: i18n-apply.py archivo core|index < pares.json"""
import json, os, re, sys
path, which = sys.argv[1], sys.argv[2]
pairs = json.load(sys.stdin)
s = open(path).read()
for a, b in pairs:
    if a not in s:
        sys.exit(f'NO ENCONTRADO en {path}: {a[:80]}')
    s = s.replace(a, b)
if not re.search(r"import \{[^}]*\bt\b[^}]*\} from '[./]*(?:i18n|i18n/core)'", s):
    rel = os.path.relpath('src/i18n' + ('/core' if which == 'core' else ''), os.path.dirname(path)).replace(os.sep, '/')
    rel = rel if rel.startswith('.') else './' + rel
    imports = list(re.finditer(r"^import [^;]+;\n", s, flags=re.M))
    pos = imports[-1].end() if imports else 0
    s = s[:pos] + f"import {{ t }} from '{rel}';\n" + s[pos:]
open(path, 'w').write(s)
print('ok', path)
