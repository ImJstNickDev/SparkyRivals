export const challengeKeys = {
  all: (actor: string) => ['challenges', actor] as const,
  list: (actor: string) => [...challengeKeys.all(actor), 'list'] as const,
  detail: (actor: string, id: string) =>
    [...challengeKeys.all(actor), 'detail', id] as const,
  results: (actor: string, id: string) =>
    [...challengeKeys.all(actor), 'results', id] as const,
  connections: (actor: string) =>
    [...challengeKeys.all(actor), 'connections'] as const,
};
