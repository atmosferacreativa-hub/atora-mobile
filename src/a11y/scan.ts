/**
 * Accesibilidad (1.0.0): revisión estática de los elementos tocables.
 *
 * - Un botón sin texto visible (solo ícono o imagen) necesita `accessibilityLabel`.
 * - El área táctil debe medir al menos 44 puntos de alto: se estima con
 *   `minHeight`/`height` del estilo (resuelto en el `StyleSheet.create` del
 *   archivo), o con el relleno vertical más una línea de texto, más `hitSlop`.
 */
import * as ts from 'typescript';

const TOUCHABLES = new Set(['Pressable', 'TouchableOpacity', 'TouchableHighlight']);
export const MIN_TARGET = 44;
/** Alto de una línea de texto en el tamaño de letra normal. */
const LINE = 20;

export type A11yFinding = { line: number; problem: 'sin-etiqueta' | 'objetivo-pequeno'; detail: string };

type StyleProps = Record<string, number>;

function numericStyles(source: ts.SourceFile): Record<string, StyleProps> {
  const styles: Record<string, StyleProps> = {};
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && node.expression.getText(source) === 'StyleSheet.create' && node.arguments[0] && ts.isObjectLiteralExpression(node.arguments[0])) {
      for (const prop of node.arguments[0].properties) {
        if (!ts.isPropertyAssignment(prop) || !ts.isObjectLiteralExpression(prop.initializer)) continue;
        const values: StyleProps = {};
        for (const inner of prop.initializer.properties) {
          if (ts.isPropertyAssignment(inner) && ts.isNumericLiteral(inner.initializer)) values[inner.name.getText(source)] = Number(inner.initializer.text);
          // spacing.md / spacing.sm…
          if (ts.isPropertyAssignment(inner) && ts.isPropertyAccessExpression(inner.initializer) && inner.initializer.expression.getText(source) === 'spacing') {
            const scale: Record<string, number> = { xs: 6, sm: 10, md: 16, lg: 24, xl: 32 };
            values[inner.name.getText(source)] = scale[inner.initializer.name.text] ?? 0;
          }
        }
        styles[prop.name.getText(source)] = values;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return styles;
}

function styleNames(expression: ts.Expression | undefined, source: ts.SourceFile): string[] {
  if (!expression) return [];
  const text = expression.getText(source);
  return [...text.matchAll(/styles\.(\w+)/g)].map((match) => match[1]!);
}

function estimatedHeight(names: string[], styles: Record<string, StyleProps>): number {
  let min = 0;
  let padding = 0;
  for (const name of names) {
    const style = styles[name] ?? {};
    min = Math.max(min, style.minHeight ?? 0, style.height ?? 0);
    const vertical = (style.paddingTop ?? style.paddingVertical ?? style.padding ?? 0) + (style.paddingBottom ?? style.paddingVertical ?? style.padding ?? 0);
    padding = Math.max(padding, vertical);
  }
  return Math.max(min, padding + LINE);
}

function hasVisibleText(element: ts.JsxElement): boolean {
  let found = false;
  const visit = (node: ts.Node) => {
    if (found) return;
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && /^(Text|ActivityIndicator)$/.test(node.tagName.getText())) found = true;
    ts.forEachChild(node, visit);
  };
  element.children.forEach(visit);
  return found;
}

export function scanA11y(fileName: string, code: string): A11yFinding[] {
  const source = ts.createSourceFile(fileName, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const styles = numericStyles(source);
  const findings: A11yFinding[] = [];
  const lines = code.split('\n');
  const visit = (node: ts.Node) => {
    const opening = ts.isJsxElement(node) ? node.openingElement : ts.isJsxSelfClosingElement(node) ? node : null;
    if (opening && TOUCHABLES.has(opening.tagName.getText(source))) {
      const attrs = new Map<string, ts.JsxAttribute>();
      opening.attributes.properties.forEach((attr) => { if (ts.isJsxAttribute(attr)) attrs.set(attr.name.getText(source), attr); });
      const line = source.getLineAndCharacterOfPosition(opening.getStart(source)).line + 1;
      if (/a11y-ignore/.test(lines[line - 1] ?? '') || /a11y-ignore/.test(lines[line - 2] ?? '')) {
        ts.forEachChild(node, visit);
        return;
      }
      const labelled = attrs.has('accessibilityLabel');
      if (!labelled && (!ts.isJsxElement(node) || !hasVisibleText(node))) {
        findings.push({ line, problem: 'sin-etiqueta', detail: opening.getText(source).slice(0, 90) });
      }
      const styleAttr = attrs.get('style');
      const styleExpr = styleAttr?.initializer && ts.isJsxExpression(styleAttr.initializer) ? styleAttr.initializer.expression : undefined;
      const hitSlopAttr = attrs.get('hitSlop');
      const hitSlop = hitSlopAttr?.initializer && ts.isJsxExpression(hitSlopAttr.initializer) && hitSlopAttr.initializer.expression && ts.isNumericLiteral(hitSlopAttr.initializer.expression)
        ? Number(hitSlopAttr.initializer.expression.text)
        : hitSlopAttr ? 12 : 0;
      const height = estimatedHeight(styleNames(styleExpr, source), styles) + hitSlop * 2;
      if (height < MIN_TARGET) {
        findings.push({ line, problem: 'objetivo-pequeno', detail: `~${height} pt · ${opening.getText(source).slice(0, 80)}` });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return findings;
}
