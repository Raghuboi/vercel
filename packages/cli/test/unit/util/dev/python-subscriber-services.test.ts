import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BuildMatch } from '../../../../src/util/dev/types';
import type { BuilderWithPkg } from '../../../../src/util/build/import-builders';
import { importBuilders } from '../../../../src/util/build/import-builders';
import { getPyprojectSubscriberServices } from '../../../../src/util/dev/python-subscriber-services';

vi.mock('../../../../src/output-manager', () => ({
  default: { debug: vi.fn() },
}));

vi.mock('../../../../src/util/build/import-builders', () => ({
  importBuilders: vi.fn(),
}));

function makeBuilderWithPkg(
  getDevQueueSubscribers: ReturnType<typeof vi.fn>
): BuilderWithPkg {
  return {
    path: '',
    pkgPath: '',
    dynamicallyInstalled: false,
    pkg: { name: '@vercel/python' },
    builder: {
      version: -1 as const,
      getDevQueueSubscribers,
    },
  } as unknown as BuilderWithPkg;
}

function makePythonBuildMatch(
  getDevQueueSubscribers: ReturnType<typeof vi.fn>
): BuildMatch {
  return {
    use: '@vercel/python',
    src: 'pyproject.toml',
    entrypoint: '<detect>',
    config: { framework: 'fastapi' },
    builderWithPkg: makeBuilderWithPkg(getDevQueueSubscribers),
  } as unknown as BuildMatch;
}

const subscriberDescriptor = {
  name: 'high-priority-worker',
  consumer: '__py__subscribers_Shigh-priority-worker',
  entrypoint: 'worker_a/__init__.py',
  moduleName: 'worker_a',
  variableName: 'app',
  topics: [{ topic: 'high-priority', maxConcurrency: 1 }],
};

describe('getPyprojectSubscriberServices', () => {
  beforeEach(() => {
    vi.mocked(importBuilders).mockReset();
  });

  it('preserves the package module and queue consumer in the worker service', async () => {
    const getDevQueueSubscribers = vi
      .fn()
      .mockResolvedValue([subscriberDescriptor]);

    await expect(
      getPyprojectSubscriberServices({
        buildMatches: [makePythonBuildMatch(getDevQueueSubscribers)],
        workPath: '/project',
      })
    ).resolves.toEqual([
      {
        schema: 'experimentalServices',
        name: 'high-priority-worker',
        type: 'worker',
        trigger: 'queue',
        consumer: '__py__subscribers_Shigh-priority-worker',
        workspace: '.',
        framework: 'fastapi',
        runtime: 'python',
        builder: {
          use: '@vercel/python',
          src: 'worker_a/__init__.py',
          config: {
            handlerFunction: 'app',
            handlerModuleName: 'worker_a',
          },
        },
        topics: [{ topic: 'high-priority', maxConcurrency: 1 }],
      },
    ]);
    expect(getDevQueueSubscribers).toHaveBeenCalledWith({
      workPath: '/project',
    });
  });

  it('loads the Python builder from detected builds when a dev command removed its build match', async () => {
    const getDevQueueSubscribers = vi
      .fn()
      .mockResolvedValue([subscriberDescriptor]);
    const use = '@vercel/python@canary';
    vi.mocked(importBuilders).mockResolvedValue(
      new Map([[use, makeBuilderWithPkg(getDevQueueSubscribers)]])
    );

    const services = await getPyprojectSubscriberServices({
      buildMatches: [],
      builds: [{ src: '<detect>', use, config: { framework: 'fastapi' } }],
      workPath: '/project',
    });

    expect(importBuilders).toHaveBeenCalledWith(new Set([use]), '/project');
    expect(getDevQueueSubscribers).toHaveBeenCalledWith({
      workPath: '/project',
    });
    expect(services).toHaveLength(1);
    expect(services[0]).toMatchObject({
      name: 'high-priority-worker',
      consumer: '__py__subscribers_Shigh-priority-worker',
      framework: 'fastapi',
      builder: {
        use,
        src: 'worker_a/__init__.py',
        config: {
          handlerFunction: 'app',
          handlerModuleName: 'worker_a',
        },
      },
    });
  });
});
