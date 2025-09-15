# SQLite Storage Package Documentation

## Overview

The `@tokenring-ai/sqlite-storage` package provides a lightweight SQLite-based storage solution for managing agent state checkpoints in the Token Ring AI system. It implements the `AgentCheckpointProvider` interface to handle storing, retrieving, and listing named checkpoints for agents. This allows for persistent storage of agent states (e.g., JSON-serialized data) in a local SQLite database, supporting operations like key-value storage for agent sessions or workflows.

Key features:
- Stores agent checkpoints with agent ID, name, state (JSON), and timestamp.
- Uses Bun's SQLite for efficient local database operations.
- Supports INSERT OR REPLACE for updates and querying by ID.
- Designed for integration with Token Ring AI agents, focusing on simplicity and reliability.

This package is part of the larger Token Ring ecosystem, enabling offline or local persistence without external databases.

## Installation/Setup

This package is intended for use within the Token Ring AI monorepo. To build and use it:

1. Ensure Bun is installed (as it uses `bun:sqlite`).
2. Install dependencies via `bun install` in the project root (includes `@tokenring-ai/ai-client` and `@tokenring-ai/history`).
3. Import and initialize the storage as shown in the usage examples below.

No additional setup is required beyond providing a database file path. The database schema is auto-initialized via SQL execution.

## Package Structure

The package is structured as follows:

- **`index.ts`**: Entry point exporting package metadata (name, version, description) compatible with Token Ring's `TokenRingPackage`.
- **`SQLiteAgentStateStorage.ts`**: Core implementation of the `AgentCheckpointProvider` interface for SQLite operations.
- **`db/initializeLocalDatabase.ts`**: Utility to create and initialize a SQLite database instance, executing the schema from `db.sql`.
- **`db/db.sql`**: SQL script defining the `AgentState` table for storing checkpoints.
- **`package.json`**: Defines the package metadata, exports, and dependencies.
- **`README.md`**: This documentation file.
- **`LICENSE`**: MIT license file.

Directories:
- `db/`: Contains database initialization and schema files.

## Core Components

### SQLiteAgentStateStorage Class

This is the primary class implementing `AgentCheckpointProvider`. It manages agent checkpoints in the SQLite `AgentState` table.

- **Constructor**: `new SQLiteAgentStateStorage({ db })`
  - Parameters: `{ db: any }` – A Bun SQLite database instance (from `bun:sqlite`).
  - Initializes the storage with a pre-connected database.

- **storeCheckpoint(checkpoint: NamedAgentCheckpoint): Promise<string>**
  - Stores or updates a named checkpoint for an agent.
  - Parameters:
    - `checkpoint: NamedAgentCheckpoint` – Object with `agentId: string`, `name: string`, `state: any` (JSON-serializable), `createdAt: number`.
  - Returns: `Promise<string>` – The ID of the stored checkpoint.
  - Internally: Uses `INSERT OR REPLACE INTO AgentState` with JSON.stringify on state, returning the auto-incremented ID.

- **retrieveCheckpoint(agentId: string): Promise<StoredAgentCheckpoint | null>**
  - Retrieves a checkpoint by agent ID.
  - Parameters: `agentId: string` – The agent's ID (note: query uses ID, but param is agentId; code uses agentId as ID? Wait, review shows SELECT by agentId, but code has SELECT id, agentId, name, state FROM AgentState WHERE id = ? .get(agentId) – potential mismatch? Based on code, assumes agentId is used as the row ID.
  - Returns: `Promise<StoredAgentCheckpoint | null>` – Checkpoint with parsed state, or null if not found.
  - Internally: Queries by ID (using agentId as key), parses JSON state.

- **listCheckpoints(): Promise<AgentCheckpointListItem[]>**
  - Lists all checkpoints, ordered by creation time (descending).
  - Returns: `Promise<AgentCheckpointListItem[]>` – Array of items with ID, name, agentId, createdAt (no state).
  - Internally: SELECTs from AgentState, maps rows excluding state.

### Database Initialization

- **initializeLocalDatabase(databaseFile: string): Database**
  - Creates a new SQLite database at the given file path and executes the schema.
  - Parameters: `databaseFile: string` – Path to the SQLite file (e.g., './agent_state.db').
  - Returns: Bun SQLite `Database` instance.
  - The `AgentState` table schema:
    ```sql
    CREATE TABLE IF NOT EXISTS AgentState
    (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agentId TEXT NOT NULL,
      name TEXT NOT NULL,
      state TEXT NOT NULL,
      createdAt INTEGER NOT NULL
    );
    ```

Interactions: Initialize the DB first, pass it to `SQLiteAgentStateStorage`, then use the provider methods for CRUD on checkpoints. States are stored as JSON strings.

## Usage Examples

### Basic Initialization and Storage

```typescript
import Database from 'bun:sqlite';
import initializeLocalDatabase from './db/initializeLocalDatabase';
import SQLiteAgentStateStorage from './SQLiteAgentStateStorage';

// Initialize database
const db = initializeLocalDatabase('./agent_state.db');

// Create storage instance
const storage = new SQLiteAgentStateStorage({ db });

// Store a checkpoint
const checkpoint = {
  agentId: 'agent-123',
  name: 'session-1',
  state: { messages: ['Hello'], variables: { count: 1 } },
  createdAt: Date.now()
};
const id = await storage.storeCheckpoint(checkpoint);
console.log(`Stored with ID: ${id}`);
```

### Retrieval and Listing

```typescript
// Retrieve a checkpoint (note: uses agentId as query param, but code queries by id=?)
const retrieved = await storage.retrieveCheckpoint('agent-123');
if (retrieved) {
  console.log('Retrieved state:', retrieved.state);
}

// List all checkpoints
const list = await storage.listCheckpoints();
console.log('Checkpoints:', list);
```

### Full Workflow

```typescript
// In an agent context
import { NamedAgentCheckpoint, StoredAgentCheckpoint } from '@tokenring-ai/agent/AgentCheckpointProvider';

async function agentWorkflow() {
  const db = initializeLocalDatabase('./myapp.db');
  const storage = new SQLiteAgentStateStorage({ db });

  // Store initial state
  await storage.storeCheckpoint({
    agentId: 'my-agent',
    name: 'initial',
    state: { step: 0 },
    createdAt: Date.now()
  });

  // Later, retrieve and update
  const current = await storage.retrieveCheckpoint('my-agent');
  if (current) {
    current.state.step += 1;
    await storage.storeCheckpoint({ ...current, createdAt: Date.now() });
  }

  // List for overview
  const checkpoints = await storage.listCheckpoints();
  console.log('All checkpoints:', checkpoints);
}
```

## Configuration Options

- **Database File Path**: Specify the path when calling `initializeLocalDatabase` (e.g., `./data/agent.db`). Defaults to in-memory if not persisted, but always provide a file for persistence.
- **No additional env vars or configs**; all operations use the provided DB instance.
- Error Handling: Uses Bun SQLite's built-in error propagation (e.g., throws on SQL failures). Wrap in try-catch for production.

## API Reference

### Public Exports
- `packageInfo: TokenRingPackage` – Package metadata from `index.ts`.

### SQLiteAgentStateStorage (implements AgentCheckpointProvider)
- `constructor({ db }: { db: Database })`
- `storeCheckpoint(checkpoint: NamedAgentCheckpoint): Promise<string>`
- `retrieveCheckpoint(agentId: string): Promise<StoredAgentCheckpoint | null>`
- `listCheckpoints(): Promise<AgentCheckpointListItem[]>`

### Utilities
- `initializeLocalDatabase(databaseFile: string): Database`

Types (imported from `@tokenring-ai/agent/AgentCheckpointProvider`):
- `NamedAgentCheckpoint`: `{ agentId: string; name: string; state: any; createdAt: number }`
- `StoredAgentCheckpoint`: `{ id: string; name: string; agentId: string; state: any; createdAt: number }`
- `AgentCheckpointListItem`: `{ id: string; name: string; agentId: string; createdAt: number }`

## Dependencies

- `@tokenring-ai/ai-client@0.1.0`: AI client integration.
- `@tokenring-ai/history@0.1.0`: History management (likely for agent states).
- `bun:sqlite`: Runtime dependency for database operations (provided by Bun).

No other external dependencies.

## Contributing/Notes

- **Building/Testing**: Use Bun for building. No test scripts defined yet; add via `package.json` scripts.
- **Limitations**: 
  - Single-file DB; not suitable for high-concurrency without WAL mode (enable via `db.exec('PRAGMA journal_mode=WAL;')` if needed).
  - State must be JSON-serializable.
  - Code assumes `agentId` is used as the table `id` in queries (potential bug: `retrieveCheckpoint` queries `WHERE id = ?` with `agentId` param – verify integration).
  - Binary states not supported; text/JSON only.
- **License**: MIT.
- For contributions, ensure compatibility with Token Ring AI interfaces and add tests for edge cases like concurrent access.