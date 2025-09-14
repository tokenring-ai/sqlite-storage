import {
  AgentCheckpointListItem,
  AgentCheckpointProvider,
  NamedAgentCheckpoint, StoredAgentCheckpoint
} from "@tokenring-ai/agent/AgentCheckpointProvider";

type AgentStateRow = {
  id: number;
  agentId: string;
  name: string;
  state: string;
  createdAt: number;
};

export default class SQLiteAgentStateStorage implements AgentCheckpointProvider {
  private db: any;

  constructor({db}: {db: any}) {
    this.db = db;
  }

  async storeCheckpoint(checkpoint: NamedAgentCheckpoint) : Promise<string> {
    const row: AgentStateRow = this.db.prepare(`
      INSERT OR REPLACE INTO AgentState (agentId, name, state, createdAt)
      VALUES (?, ?, ?,?)
      RETURNING id
    `).get(checkpoint.agentId, checkpoint.name, JSON.stringify(checkpoint.state), checkpoint.createdAt);
    return row.id.toString();
  }

  async retrieveCheckpoint(agentId: string): Promise<StoredAgentCheckpoint|null> {
    const row: AgentStateRow = this.db.prepare(`
      SELECT id, agentId, name, state FROM AgentState WHERE id = ?
    `).get(agentId);
    
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
    const rows: Omit<AgentStateRow,"state">[] = this.db.prepare(`
      SELECT id, name, createdAt FROM AgentState ORDER BY createdAt DESC
    `).all();
    
    return rows.map((row) => ({
      id: row.id.toString(),
      name: row.name,
      agentId: row.agentId,
      createdAt: row.createdAt
    }));
  }
}