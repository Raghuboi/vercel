import type { ExperimentalService } from '@vercel/fs-detectors';
import type { DevSidecar, DevSubscriber } from '@vercel/build-utils';
import type { BuildMatch } from './types';

type OrchestratorSubscriber = ExperimentalService &
  Pick<DevSubscriber, 'consumer' | 'topics'>;

export function toOrchestratorSubscriber(
  sidecar: DevSubscriber
): OrchestratorSubscriber {
  const { type: _type, ...subscriber } = sidecar;

  // ServicesOrchestrator predates subscribers and still consumes this process
  // shape internally. Keep that legacy vocabulary at this adapter boundary.
  return {
    ...subscriber,
    schema: 'experimentalServices',
    type: 'worker',
    trigger: 'queue',
  };
}

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
    [...contributingMatches.values()].map(
      match =>
        match.builderWithPkg.builder.getDevSidecars?.({
          workPath,
          build: match.buildConfig,
        }) ?? []
    )
  );
  const sidecars = nestedSidecars.flat();

  const names = new Set<string>();
  for (const sidecar of sidecars) {
    if (sidecar.type !== 'subscriber') {
      throw new Error(
        `Development sidecar "${sidecar.name}" must be a subscriber`
      );
    }
    if (names.has(sidecar.name)) {
      throw new Error(
        `Multiple builders contributed a development sidecar named "${sidecar.name}"`
      );
    }
    names.add(sidecar.name);
  }

  return sidecars;
}
