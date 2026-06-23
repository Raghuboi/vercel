import type { ExperimentalService } from '@vercel/fs-detectors';
import { isPythonFramework, type Builder } from '@vercel/build-utils';
import npa from 'npm-package-arg';
import output from '../../output-manager';
import { importBuilders, type BuilderWithPkg } from '../build/import-builders';
import type { BuildMatch } from './types';

interface PythonFrameworkBuild {
  use: string;
  config?: Builder['config'];
  builderWithPkg: BuilderWithPkg;
}

function getPythonFrameworkBuildMatches(
  buildMatches: Iterable<BuildMatch>
): BuildMatch[] {
  return [...buildMatches].filter(match => {
    const framework =
      typeof match.config?.framework === 'string'
        ? match.config.framework
        : undefined;
    return (
      (match.use === '@vercel/python' ||
        match.builderWithPkg.pkg.name === '@vercel/python') &&
      match.config?.middleware !== true &&
      isPythonFramework(framework)
    );
  });
}

function getPythonFrameworkBuildConfigs(builds: Iterable<Builder>): Builder[] {
  return [...builds].filter(build => {
    const framework =
      typeof build.config?.framework === 'string'
        ? build.config.framework
        : undefined;
    let packageName: string | null | undefined;
    try {
      packageName = npa(build.use).name;
    } catch {
      return false;
    }
    return (
      packageName === '@vercel/python' &&
      build.config?.middleware !== true &&
      isPythonFramework(framework)
    );
  });
}

function getOnlyPythonFrameworkBuild<T>(matches: T[]): T | null {
  if (matches.length === 0) {
    return null;
  }

  if (matches.length > 1) {
    output.debug(
      `Skipping pyproject subscribers: expected one Python framework build match, found ${matches.length}`
    );
    return null;
  }
  return matches[0];
}

export async function getPyprojectSubscriberServices({
  buildMatches,
  builds,
  workPath,
}: {
  buildMatches: Iterable<BuildMatch>;
  builds?: Builder[];
  workPath: string;
}): Promise<ExperimentalService[]> {
  const loadedMatches = getPythonFrameworkBuildMatches(buildMatches);
  let match: PythonFrameworkBuild | null =
    getOnlyPythonFrameworkBuild(loadedMatches);

  // A custom Development Command filters framework builders out of the normal
  // dev build matches. Fall back to the unfiltered build specs captured during
  // zero-config detection so pyproject subscribers can still load the Python
  // builder hook without making that builder eligible to serve web requests.
  if (!match && loadedMatches.length === 0 && builds) {
    const build = getOnlyPythonFrameworkBuild(
      getPythonFrameworkBuildConfigs(builds)
    );
    if (build) {
      const importedBuilders = await importBuilders(
        new Set([build.use]),
        workPath
      );
      const builderWithPkg = importedBuilders.get(build.use);
      if (builderWithPkg) {
        match = {
          use: build.use,
          config: build.config,
          builderWithPkg,
        };
      }
    }
  }

  if (!match) {
    return [];
  }

  const { builder } = match.builderWithPkg;

  if (typeof builder.getDevQueueSubscribers !== 'function') {
    return [];
  }

  const descriptors = await builder.getDevQueueSubscribers({ workPath });
  const framework = match.config?.framework || 'python';

  return descriptors.map(descriptor => ({
    schema: 'experimentalServices',
    name: descriptor.name,
    type: 'worker',
    trigger: 'queue',
    consumer: descriptor.consumer,
    workspace: '.',
    framework,
    runtime: 'python',
    builder: {
      use: match.use || '@vercel/python',
      src: descriptor.entrypoint,
      config: {
        handlerModuleName: descriptor.moduleName,
        handlerFunction: descriptor.variableName,
      },
    },
    topics: descriptor.topics,
  }));
}
