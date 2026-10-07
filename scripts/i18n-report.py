#!/usr/bin/env python3
"""Lista textos visibles candidatos que aún no pasan por t()."""
import re, sys, glob
SPANISH = re.compile(r"[áéíóúñ¿¡]|\b(?:de|la|el|los|las|tu|tus|para|con|sin|una?|que|del|en|no|se|al|por|ya|más|hoy|está|son|es|ver|aún)\b", re.I)
def strip_comments(s):
    s = re.sub(r'/\*.*?\*/', lambda m: '\n' * m.group(0).count('\n'), s, flags=re.S)
    return re.sub(r'(^|[^:])//[^\n]*', r'\1', s)
def candidates(path):
    s = strip_comments(open(path).read())
    out = []
    for i, line in enumerate(s.split('\n'), 1):
        if line.strip().startswith('import ') or 'testID' in line and line.count("'") <= 2:
            pass
        for m in re.finditer(r"(?<![\w$])(['\"`])((?:\\.|(?!\1).)*?)\1", line):
            text = m.group(2)
            before = line[:m.start()]
            if re.search(r"\bt\(\s*$", before) or re.search(r"\b(?:import|from|require)\b", line):
                continue
            if not re.search(r'[A-Za-zÁÉÍÓÚáéíóúñ]{3,}', text) or not (' ' in text or re.search(r'[áéíóúñ¿¡]', text)):
                continue
            if re.match(r'^[\w./:@%?&=#-]+$', text) or text.startswith(('http', 'atora.', 'SELECT', 'CREATE', 'INSERT')):
                continue
            if not SPANISH.search(text) and not re.match(r'^[A-ZÁÉÍÓÚ][a-záéíóúñ]+( [a-záéíóúñ]+)*$', text):
                continue
            out.append((i, text[:90]))
        for m in (re.finditer(r'>([^<>{}]*[A-Za-zÁÉÍÓÚáéíóúñ]{3,}[^<>{}]*)<', line) if path.endswith('.tsx') else []):
            if '=>' not in m.group(1) and not re.search(r'\b(?:extends|keyof|const|type)\b', m.group(1)):
                out.append((i, 'JSX: ' + m.group(1).strip()[:80]))
    return out
if __name__ == '__main__':
    files = sys.argv[1:] or [f for f in glob.glob('src/**/*.ts*', recursive=True) if '__tests__' not in f and 'pdfjs.generated' not in f and '/i18n/' not in f]
    total = 0
    for f in sorted(files):
        c = candidates(f)
        if c:
            total += len(c)
            print(f'== {f} ({len(c)})')
            for i, t in c:
                print(f'  {i}: {t}')
    print('TOTAL', total)
