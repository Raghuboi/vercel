import chalk from 'chalk';
import output from '../../../output-manager';
import { maskSecret } from './gateway';
import type { SetupPlan } from './apply';

export function printNotes(plan: SetupPlan): void {
  if (plan.notes.length === 0) {
    return;
  }
  output.print('\n');
  for (const note of plan.notes) {
    for (const line of note.notes) {
      output.log(`${note.displayName}: ${line}`);
    }
  }
}

export function printKey(key: string): void {
  output.print('\n');
  output.log(
    chalk.dim(
      `AI Gateway API key ${maskSecret(key)} written to the configs above — keep it secret.`
    )
  );
}
