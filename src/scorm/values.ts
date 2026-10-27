export function mergeScormValues(
  localValues: Record<string, string>,
  serverValues: Record<string, string> | null,
): Record<string, string> {
  return serverValues ? { ...localValues, ...serverValues } : { ...localValues };
}

