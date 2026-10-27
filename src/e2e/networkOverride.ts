export type E2ENetworkOverride = 'auto' | 'cell';

let current: E2ENetworkOverride = 'auto';

export function getE2ENetworkOverride(): E2ENetworkOverride {
  return current;
}

export async function setE2ENetworkOverride(next: E2ENetworkOverride): Promise<E2ENetworkOverride> {
  current = next;
  return current;
}

export async function toggleE2ENetworkOverride(): Promise<E2ENetworkOverride> {
  return setE2ENetworkOverride(current === 'cell' ? 'auto' : 'cell');
}

