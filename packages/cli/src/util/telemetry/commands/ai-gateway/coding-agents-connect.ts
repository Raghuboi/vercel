import { TelemetryClient } from '../..';
import type { TelemetryMethods } from '../../types';
import type { connectSubcommand } from '../../../../commands/ai-gateway/command';

export class AiGatewayCodingAgentsConnectTelemetryClient
  extends TelemetryClient
  implements TelemetryMethods<typeof connectSubcommand>
{
  trackCliOptionAgent(agents: [string] | undefined) {
    if (agents && agents.length) {
      for (const agent of agents) {
        this.trackCliOption({ option: 'agent', value: agent });
      }
    }
  }

  trackCliFlagAll(all: boolean | undefined) {
    if (all) {
      this.trackCliFlag('all');
    }
  }

  trackCliOptionKey(key: string | undefined) {
    if (key) {
      this.trackCliOption({ option: 'key', value: this.redactedValue });
    }
  }

  trackCliFlagYes(yes: boolean | undefined) {
    if (yes) {
      this.trackCliFlag('yes');
    }
  }
}
