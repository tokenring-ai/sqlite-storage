import {AgentTeam, TokenRingPackage} from "@tokenring-ai/agent";
import packageJSON from './package.json' with {type: 'json'};
import SQLiteAgentStateStorage, {SQLiteAgentStateStorageConfigSchema} from "./SQLiteAgentStateStorage.js";
import AgentCheckpointService from "@tokenring-ai/checkpoint/AgentCheckpointService";
import { CheckpointPackageConfigSchema } from "@tokenring-ai/checkpoint";

export const packageInfo: TokenRingPackage = {
  name: packageJSON.name,
  version: packageJSON.version,
  description: packageJSON.description,
  install(agentTeam: AgentTeam) {
    const config = agentTeam.getConfigSlice("checkpoint", CheckpointPackageConfigSchema);

    if (config) {
      agentTeam.services.waitForItemByType(AgentCheckpointService).then(checkpointService => {
        for (const name in config.providers) {
          const provider = config.providers[name];
          if (provider.type === "sqlite") {
            checkpointService.registerProvider(name, new SQLiteAgentStateStorage(SQLiteAgentStateStorageConfigSchema.parse(provider)));
          }
        }
      }).catch(console.error);
    }
  }
};