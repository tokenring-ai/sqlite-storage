import type Database from "bun:sqlite";
import {
  AgentCheckpointListItem,
  AgentCheckpointProvider,
  NamedAgentCheckpoint, StoredAgentCheckpoint
} from "@tokenring-ai/checkpoint/AgentCheckpointProvider";
import {z} from "zod";
import initializeLocalDatabase from "./db/initializeLocalDatabase.js";

type AgentStateRow = {
  id: number;
  agentId: string;
  name: string;
  state: string;
  createdAt: number;
};

export const SQLiteAgentStateStorageConfigSchema = z.object({
  databasePath: z.string(),
  busyTimeout: z.number().optional(),
  maxRetries: z.number().optional(),
  retryDelayMs: z.number().optional(),
});

export default class SQLiteAgentStateStorage implements AgentCheckpointProvider {
  private db: Database;
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;

  constructor({databasePath, busyTimeout = 5000, maxRetries = 3, retryDelayMs = 100}: z.infer<typeof SQLiteAgentStateStorageConfigSchema>) {
    this.db = initializeLocalDatabase(databasePath);
    this.maxRetries = maxRetries;
    this.retryDelayMs = retryDelayMs
    
    // Enable WAL mode for better concurrency
    this.db.prepare('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = ?').run(busyTimeout);
  }

  private async retryOnBusy<T>(operation: () => T): Promise<T> {
    for (let i = 0; i < this.maxRetries; i++) {
      try {
        return operation();
      } catch (error: any) {
        if (error.code === 'SQLITE_BUSY' && i < this.maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, this.retryDelayMs * (i + 1)));
          continue;
        }
        throw error;
      }
    }
    throw new Error('Max retries reached');
  }

  async storeCheckpoint(checkpoint: NamedAgentCheckpoint) : Promise<string> {
    const row = await this.retryOnBusy(() =>
      this.db.prepare(`
        INSERT OR REPLACE INTO AgentState (agentId, name, state, createdAt)
        VALUES (?, ?, ?,?)
        RETURNING id
      `).get(checkpoint.agentId, checkpoint.name, JSON.stringify(checkpoint.state), checkpoint.createdAt)
    ) as AgentStateRow;
    return row.id.toString();
  }

  async retrieveCheckpoint(agentId: string): Promise<StoredAgentCheckpoint|null> {
    const row= await this.retryOnBusy(() =>
      this.db.prepare(`
        SELECT id, agentId, name, state FROM AgentState WHERE id = ?
      `).get(agentId)
    ) as AgentStateRow | undefined;
    
    if (row) {
      return {
        id: row.id.toString(),
        name: row.name,
        agentId,
        state: JSON.parse(row.state),
        createdAt: row.createdAt
      }
    }

    return null;
  }

  async listCheckpoints(): Promise<AgentCheckpointListItem[]> {
    const rows = await this.retryOnBusy(() =>
      this.db.prepare(`
        SELECT id, agentId, name, createdAt FROM AgentState ORDER BY createdAt DESC
      `).all()
    ) as AgentStateRow[];
    
    return rows.map((row) => ({
      id: row.id.toString(),
      name: row.name,
      agentId: row.agentId,
      createdAt: row.createdAt
    }));
  }
}