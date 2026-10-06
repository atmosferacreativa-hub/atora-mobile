/**
 * Señal de riesgo (0.7.0). Módulo puro, para Jest. Siempre color **y** texto:
 * nunca solo color. El texto es la etiqueta del servidor con su motivo.
 */
import type { Risk, RiskLevel } from './types';

export type RiskBadge = { text: string; detail: string; icon: 'alert-circle' | 'warning' | 'checkmark-circle'; tone: 'danger' | 'warning' | 'ok' };

const TONES: Record<RiskLevel, Pick<RiskBadge, 'icon' | 'tone'>> = {
  alto: { icon: 'alert-circle', tone: 'danger' },
  medio: { icon: 'warning', tone: 'warning' },
  bajo: { icon: 'checkmark-circle', tone: 'ok' },
};

const FALLBACK_LABELS: Record<RiskLevel, string> = { alto: 'Riesgo alto', medio: 'Riesgo medio', bajo: 'Sin riesgo' };

export function riskBadge(risk: Risk | null | undefined): RiskBadge {
  const level: RiskLevel = risk && risk.level in TONES ? risk.level : 'bajo';
  const reasons = (risk?.reasons ?? []).filter(Boolean);
  return {
    ...TONES[level],
    text: risk?.label || FALLBACK_LABELS[level],
    detail: reasons.length ? reasons.join(' · ') : level === 'bajo' ? 'Al día' : '',
  };
}

/** Texto para lectores de pantalla: nivel y motivo en una frase. */
export function riskA11y(risk: Risk | null | undefined): string {
  const badge = riskBadge(risk);
  return badge.detail ? `${badge.text}: ${badge.detail}` : badge.text;
}
