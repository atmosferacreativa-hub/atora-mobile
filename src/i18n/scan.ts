/**
 * Detector de textos sin traducir (1.0.0). Lo usan la prueba de catálogo y
 * `scripts/i18n-check.js`. Recorre el árbol de TypeScript de cada pantalla y
 * marca lo que el usuario vería sin pasar por `t()`:
 * - texto JSX con letras;
 * - textos literales (o plantillas) dentro de una expresión JSX, también en
 *   ternarios, `??`, `||` y concatenaciones;
 * - props visibles con texto literal (title, label, placeholder, accesibilidad…);
 * - argumentos de texto de `Alert.alert` y `text:` de sus botones;
 * - textos en `setError`, `setNotice` y similares, y en `throw new Error(...)`.
 * Además reúne todas las claves usadas en `t('...')`.
 */
import * as ts from 'typescript';

const VISIBLE_PROPS = new Set([
  'title', 'label', 'placeholder', 'accessibilityLabel', 'accessibilityHint', 'description', 'message', 'subtitle', 'headline', 'emptyText', 'hint', 'actionLabel', 'buttonText', 'badge',
]);
const SETTERS = /^set(Error|Notice|Message|FormError|Info|Warning|Hint|Status|Material|Feedback)$/;
const LETTERS = /[A-Za-zÁÉÍÓÚáéíóúÑñ]{2,}/;

export type Finding = { line: number; text: string; kind: string };

function isTCall(node: ts.Node): boolean {
  return ts.isCallExpression(node) && ts.isIdentifier(node.expression) && (node.expression.text === 't' || node.expression.text === 'tk');
}

function literalText(node: ts.Node, source: ts.SourceFile): string | null {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isTemplateExpression(node)) return node.getText(source);
  return null;
}

/** Textos literales visibles dentro de una expresión (sin entrar en llamadas a t()). */
function visibleLiterals(node: ts.Node, source: ts.SourceFile, out: { node: ts.Node; text: string }[]): void {
  if (isTCall(node)) return;
  const text = literalText(node, source);
  if (text !== null) {
    if (ts.isTemplateExpression(node)) {
      const raw = node.head.text + node.templateSpans.map((span) => span.literal.text).join('');
      if (LETTERS.test(raw)) out.push({ node, text });
    } else if (LETTERS.test(text)) {
      out.push({ node, text });
    }
    return;
  }
  if (ts.isConditionalExpression(node)) {
    visibleLiterals(node.whenTrue, source, out);
    visibleLiterals(node.whenFalse, source, out);
  } else if (ts.isBinaryExpression(node) && [ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.PlusToken, ts.SyntaxKind.AmpersandAmpersandToken].includes(node.operatorToken.kind)) {
    visibleLiterals(node.left, source, out);
    visibleLiterals(node.right, source, out);
  } else if (ts.isParenthesizedExpression(node)) {
    visibleLiterals(node.expression, source, out);
  }
}

export function scanSource(fileName: string, code: string): { findings: Finding[]; keys: string[] } {
  const source = ts.createSourceFile(fileName, code, ts.ScriptTarget.Latest, true, fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const findings: Finding[] = [];
  const keys: string[] = [];
  const lines = code.split('\n');
  const add = (node: ts.Node, text: string, kind: string) => {
    const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line;
    // La marca no se traduce; un error de programación se marca con `i18n-ignore`.
    if (/^(ATORA|Vimeo|YouTube)$/.test(text.trim()) || /^https?:\/\/\S+$/.test(text.trim()) || /i18n-ignore/.test(lines[line] ?? '') || /i18n-ignore/.test(lines[line - 1] ?? '')) return;
    findings.push({ line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1, text: text.trim().slice(0, 120), kind });
  };
  const visit = (node: ts.Node): void => {
    if (isTCall(node)) {
      const first = (node as ts.CallExpression).arguments[0];
      if (first && (ts.isStringLiteral(first) || ts.isNoSubstitutionTemplateLiteral(first))) keys.push(first.text);
    }
    if (ts.isJsxText(node) && LETTERS.test(node.text)) add(node, node.text, 'jsx-text');
    if (ts.isJsxExpression(node) && node.expression && !ts.isJsxAttribute(node.parent)) {
      const found: { node: ts.Node; text: string }[] = [];
      visibleLiterals(node.expression, source, found);
      found.forEach((item) => add(item.node, item.text, 'jsx-expression'));
    }
    if (ts.isJsxAttribute(node) && VISIBLE_PROPS.has(node.name.getText(source)) && node.initializer) {
      if (ts.isStringLiteral(node.initializer) && LETTERS.test(node.initializer.text)) add(node, node.initializer.text, 'prop');
      if (ts.isJsxExpression(node.initializer) && node.initializer.expression) {
        const found: { node: ts.Node; text: string }[] = [];
        visibleLiterals(node.initializer.expression, source, found);
        found.forEach((item) => add(item.node, item.text, 'prop'));
      }
    }
    if (ts.isCallExpression(node)) {
      const callee = node.expression.getText(source);
      if (callee === 'Alert.alert' || SETTERS.test(callee)) {
        node.arguments.slice(0, callee === 'Alert.alert' ? 2 : 1).forEach((argument) => {
          const found: { node: ts.Node; text: string }[] = [];
          visibleLiterals(argument, source, found);
          found.forEach((item) => add(item.node, item.text, callee));
        });
      }
    }
    if (ts.isNewExpression(node) && /^(Error|ApiError|OutboxDefinitiveError)$/.test(node.expression.getText(source)) && node.arguments?.[0]) {
      const found: { node: ts.Node; text: string }[] = [];
      visibleLiterals(node.arguments[0], source, found);
      found.filter((item) => / /.test(item.text)).forEach((item) => add(item.node, item.text, 'error'));
    }
    if (ts.isPropertyAssignment(node) && node.name.getText(source) === 'text' && ts.isObjectLiteralExpression(node.parent)) {
      const found: { node: ts.Node; text: string }[] = [];
      visibleLiterals(node.initializer, source, found);
      found.forEach((item) => add(item.node, item.text, 'alert-button'));
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return { findings, keys };
}
