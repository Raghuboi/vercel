import { describe, expect, it, vi } from 'vitest';
import type { Builder, DevSidecar } from '@vercel/build-utils';
import type { BuilderWithPkg } from '../../../../src/util/build/import-builders';
import { collectBuilderDevSidecars } from '../../../../src/util/dev/dev-sidecars';
import type { BuildMatch } from '../../../../src/util/dev/types';

const build: Builder = {
  use: '@vercel/example-runtime',
  src: '<detect>',
  config: { framework: 'example' },
};

const sidecar: DevSidecar = {
  schema: 'experimentalServices',
  name: 'background-worker',
  type: 'worker',
  trigger: 'queue',
  consumer: 'background-consumer',
  workspace: '.',
  runtime: 'example',
  builder: {
    use: build.use,
    src: 'worker.ts',
  },
  topics: [{ topic: 'jobs' }],
};

function makeBuilderWithPkg(
  packageName: string,
  getDevSidecars?: ReturnType<typeof vi.fn>
): BuilderWithPkg {
  return {
    path: '',
    pkgPath: '',
    dynamicallyInstalled: false,
    pkg: { name: packageName },
    builder: {
      version: -1 as const,
      build: vi.fn(),
      getDevSidecars,
    },
  } as unknown as BuilderWithPkg;
}

function makeBuildMatch(
  builderWithPkg: BuilderWithPkg,
  buildConfig: Builder = build
): BuildMatch {
  return {
    ...buildConfig,
    buildConfig,
    entrypoint: '<detect>',
    builderWithPkg,
  } as unknown as BuildMatch;
}

describe('collectBuilderDevSidecars', () => {
  it('collects sidecars from any builder that implements getDevSidecars', async () => {
    const getDevSidecars = vi.fn().mockResolvedValue([sidecar]);
    const builderWithPkg = makeBuilderWithPkg(build.use, getDevSidecars);

    await expect(
      collectBuilderDevSidecars({
        buildMatches: [makeBuildMatch(builderWithPkg)],
        workPath: '/project',
      })
    ).resolves.toEqual([sidecar]);

    expect(getDevSidecars).toHaveBeenCalledWith({
      workPath: '/project',
      build,
    });
  });

  it('invokes each contributing build configuration once', async () => {
    const getDevSidecars = vi.fn().mockResolvedValue([sidecar]);
    const builderWithPkg = makeBuilderWithPkg(build.use, getDevSidecars);

    await expect(
      collectBuilderDevSidecars({
        buildMatches: [
          makeBuildMatch(builderWithPkg),
          makeBuildMatch(builderWithPkg),
        ],
        workPath: '/project',
      })
    ).resolves.toEqual([sidecar]);

    expect(getDevSidecars).toHaveBeenCalledOnce();
  });

  it('rejects duplicate contributed sidecar names', async () => {
    const duplicateBuild = { ...build, use: '@vercel/other-runtime' };
    const first = makeBuilderWithPkg(
      build.use,
      vi.fn().mockResolvedValue([sidecar])
    );
    const second = makeBuilderWithPkg(
      duplicateBuild.use,
      vi.fn().mockResolvedValue([sidecar])
    );

    await expect(
      collectBuilderDevSidecars({
        buildMatches: [
          makeBuildMatch(first),
          makeBuildMatch(second, duplicateBuild),
        ],
        workPath: '/project',
      })
    ).rejects.toThrow(
      'Multiple builders contributed a development sidecar named "background-worker"'
    );
  });

  it('does not invoke builders whose source patterns did not match', async () => {
    const getDevSidecars = vi.fn().mockResolvedValue([sidecar]);

    await expect(
      collectBuilderDevSidecars({
        buildMatches: [],
        workPath: '/project',
      })
    ).resolves.toEqual([]);

    expect(getDevSidecars).not.toHaveBeenCalled();
  });
});
