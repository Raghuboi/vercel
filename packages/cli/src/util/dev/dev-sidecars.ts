import type { DevSidecar } from '@vercel/build-utils';
import type { BuildMatch } from './types';

export async function collectBuilderDevSidecars({
  buildMatches,
  workPath,
}: {
  buildMatches: Iterable<BuildMatch>;
  workPath: string;
}): Promise<DevSidecar[]> {
  const matches = [...buildMatches];
  const contributingMatches = new Map(
    matches.map(match => [match.buildConfig, match] as const)
  );

  const nestedSidecars = await Promise.all(
    [...contributingMatches.values()].map(async match => {
      return (
        match.builderWithPkg.builder.getDevSidecars?.({
          workPath,
          build: match.buildConfig,
        }) ?? []
      );
    })
  );
  const sidecars = nestedSidecars.flat();

  const names = new Set<string>();
  for (const sidecar of sidecars) {
    if (names.has(sidecar.name)) {
      throw new Error(
        `Multiple builders contributed a development sidecar named "${sidecar.name}"`
      );
    }
    names.add(sidecar.name);
  }

  return sidecars;
}
