#!/usr/bin/env python3
"""Envuelve en t() los textos visibles evidentes (uso único en la migración a i18n, 1.0.0)."""
import re, sys, os

LETTERS = re.compile(r'[A-Za-zÁÉÍÓÚáéíóúÑñ¿¡]{2,}')
PROPS = r'(placeholder|accessibilityLabel|accessibilityHint|title|label|subtitle|headline|emptyText|hint|confirmText|cancelText|description|message|actionLabel|buttonText)'

def q(text):
    return "'" + text.replace('\\', '\\\\').replace("'", "\\'") + "'"

def wrap_file(path):
    s = open(path).read()
    orig = s
    # 1) Props con texto literal: prop="Texto" -> prop={t('Texto')}
    def prop(m):
        name, val = m.group(1), m.group(2)
        if not LETTERS.search(val) or re.match(r'^[a-z0-9_.-]+$', val):
            return m.group(0)
        return f'{name}={{t({q(val)})}}'
    s = re.sub(PROPS + r'="([^"{}]*)"', prop, s)
    # 2) Texto JSX entre etiquetas (sin llaves)
    def jsx(m):
        before, text, after = m.group(1), m.group(2), m.group(3)
        core = text.strip()
        if not LETTERS.search(core) or '=>' in core or core.startswith(('//', '=')) or core in ('ATORA',) or re.match(r'^[)(:?&|]', core) or '? (' in core or ') :' in core or re.search(r'\b(?:const|type|return|extends|keyof)\b', core):
            return m.group(0)
        lead = text[:len(text) - len(text.lstrip())]
        trail = text[len(text.rstrip()):]
        return f'{before}{lead}{{t({q(core)})}}{trail}{after}'
    # Solo entre etiquetas JSX (con mayúscula): <Text ...>texto</Text>, </X>texto<Y
    s = re.sub(r'((?:<[A-Z][\w.]*(?:\s[^<>]*?)?|</[A-Z][\w.]*)>)([^<>{}`;]*?)((?=<(?:/[A-Z]|[A-Z])))', jsx, s)
    # 3) Alert.alert('Título', 'Mensaje' ...) y botones { text: 'X' }
    def alert(m):
        inner = m.group(0)
        inner = re.sub(r"(Alert\.alert\(\s*)'((?:[^'\\]|\\.)*)'", lambda k: k.group(1) + f"t('{k.group(2)}')" if LETTERS.search(k.group(2)) else k.group(0), inner)
        inner = re.sub(r"(Alert\.alert\(\s*t\('(?:[^'\\]|\\.)*'\)\s*,\s*)'((?:[^'\\]|\\.)*)'", lambda k: k.group(1) + f"t('{k.group(2)}')" if LETTERS.search(k.group(2)) else k.group(0), inner)
        return inner
    s = re.sub(r"Alert\.alert\([^;]*?\)", alert, s, flags=re.S)
    s = re.sub(r"(\btext:\s*)'((?:[^'\\]|\\.)*)'", lambda k: k.group(1) + f"t('{k.group(2)}')" if LETTERS.search(k.group(2)) else k.group(0), s)
    # 4) set*/throw con texto literal
    s = re.sub(r"(\b(?:setNotice|setError|setMessage|setStatus|setInfo|setWarning|setHint)\()'((?:[^'\\]|\\.)*)'\)", lambda k: k.group(1) + f"t('{k.group(2)}'))" if LETTERS.search(k.group(2)) else k.group(0), s)
    if s != orig:
        if not re.search(r"import \{[^}]*\bt\b[^}]*\} from '[./]*i18n", s):
            depth = path.count('/') - 1  # src/x.tsx -> 1
            rel = '../' * (depth - 0) if depth > 0 else './'
            rel = os.path.relpath('src/i18n', os.path.dirname(path)).replace(os.sep, '/')
            if not rel.startswith('.'):
                rel = './' + rel
            # tras el último import
            imports = list(re.finditer(r"^import [^;]+;\n", s, flags=re.M))
            pos = imports[-1].end() if imports else 0
            s = s[:pos] + f"import {{ t }} from '{rel}';\n" + s[pos:]
        open(path, 'w').write(s)
        return True
    return False

if __name__ == '__main__':
    changed = [p for p in sys.argv[1:] if wrap_file(p)]
    print('\n'.join(changed))
