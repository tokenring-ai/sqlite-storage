import {TokenRingPackage} from "@tokenring-ai/agent";
import packageJSON from './package.json' with {type: 'json'};

export const packageInfo: TokenRingPackage = {
  name: packageJSON.name,
  version: packageJSON.version,
  description: packageJSON.description
};


export {default as SQLiteChatCheckpointStorage} from "./SQLiteChatCheckpointStorage.ts";
export {default as SQLiteChatHistoryStorage} from "./SQLiteChatHistoryStorage.ts";
export {default as SQLiteChatMessageStorage} from "./SQLiteChatMessageStorage.ts";
export {default as SQLiteCLIHistoryStorage} from "./SQLiteCLIHistoryStorage.ts";