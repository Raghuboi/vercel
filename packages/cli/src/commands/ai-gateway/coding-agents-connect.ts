import { homedir } from 'node:os';
import chalk from 'chalk';
import type Client from '../../util/client';
import output from '../../output-manager';
import { parseArguments } from '../../util/get-args';
import { getFlagsSpecification } from '../../util/get-flags-specification';
import { printError } from '../../util/error';
import { printAlignedLabel } from '../../util/output/print-aligned-label';
import { resolveAgents } from '../../util/ai-gateway/coding-agents/resolve';
import {
  buildSetupPlan,
  applyPlan,
} from '../../util/ai-gateway/coding-agents/apply';
import {
  printNotes,
  printKey,
} from '../../util/ai-gateway/coding-agents/render';
import { runMachine } from '../../util/ai-gateway/coding-agents/machine';
import {
  outputAgentError,
  shouldEmitNonInteractiveCommandError,
} from '../../util/agent-output';
import { AGENT_STATUS, AGENT_REASON } from '../../util/agent-output-constants';
import { connectSubcommand } from './command';
import { AiGatewayCodingAgentsConnectTelemetryClient } from '../../util/telemetry/commands/ai-gateway/coding-agents-connect';

export default async function codingAgentsConnect(
  client: Client,
  argv: string[]
): Promise<number> {
  const telemetry = new AiGatewayCodingAgentsConnectTelemetryClient({
    opts: { store: client.telemetryEventStore },
  });

  let parsedArgs;
  const flagsSpecification = getFlagsSpecification(connectSubcommand.options);
  try {
    parsedArgs = parseArguments(argv, flagsSpecification);
  } catch (error) {
    printError(error);
    return 1;
  }
  const { flags: opts } = parsedArgs;

  const agentFlags = opts['--agent'] as string[] | undefined;
  const all = opts['--all'] as boolean | undefined;
  const providedKey = opts['--key'] as string | undefined;
  const yes = opts['--yes'] as boolean | undefined;

  telemetry.trackCliOptionAgent(agentFlags as [string] | undefined);
  telemetry.trackCliFlagAll(all);
  telemetry.trackCliOptionKey(providedKey);
  telemetry.trackCliFlagYes(yes);

  const machine = shouldEmitNonInteractiveCommandError(client);
  const canPrompt = Boolean(client.stdin.isTTY) && !machine;
  const home = homedir();

  if (!providedKey) {
    return failValidation(
      client,
      machine,
      AGENT_REASON.INVALID_ARGUMENTS,
      'An existing AI Gateway API key is required. Pass --key <key>.'
    );
  }

  const selection = await resolveAgents({
    client,
    agentFlags,
    all,
    canPrompt,
    yes: Boolean(yes),
    home,
  });
  if ('error' in selection) {
    if (machine) {
      outputAgentError(client, {
        status: AGENT_STATUS.ERROR,
        reason: selection.reason,
        message: selection.error,
      });
    }
    output.error(selection.error);
    return 1;
  }
  const { selected, guidance, unsupported } = selection;
  for (const note of guidance) {
    output.warn(note);
  }

  if (machine) {
    return runMachine({
      client,
      selected,
      unsupported,
      key: providedKey,
      backup: true,
      home,
    });
  }

  const plan = await buildSetupPlan(selected, { apiKey: providedKey, home });
  const changed = plan.changes.filter(
    c => c.status === 'create' || c.status === 'update'
  );
  const errored = plan.changes.filter(c => c.status === 'error');

  if (changed.length === 0 && errored.length === 0) {
    output.log(
      'All selected agents are already configured for the AI Gateway.'
    );
    printKey(providedKey);
    return 0;
  }

  const results = await applyPlan(plan, { backup: true });

  output.print('\n');
  for (const result of results) {
    printAlignedLabel(
      result.action === 'created' ? 'Created' : 'Updated',
      result.path,
      { gutter: '✓' }
    );
  }
  for (const change of errored) {
    output.warn(
      `Skipped ${change.label} (${change.path}): ${change.error}. Fix or remove the file, then re-run.`
    );
  }
  if (results.some(r => r.backupPath)) {
    output.log(chalk.dim('Previous files saved alongside as .bak'));
  }

  printNotes(plan);
  printKey(providedKey);
  return 0;
}

function failValidation(
  client: Client,
  machine: boolean,
  reason: string,
  message: string
): number {
  if (machine) {
    outputAgentError(client, {
      status: AGENT_STATUS.ERROR,
      reason,
      message,
    });
  }
  output.error(message);
  return 1;
}
