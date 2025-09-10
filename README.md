# @tokenring-ai/sqlite-storage

SQLite-backed storage adapters for the Token Ring ecosystem. This package provides concrete implementations for
persisting chat messages, browsing chat history, creating/restoring checkpoints, and recording CLI command history using
a local SQLite database.

It also includes a small helper to initialize a local database file with the required schema.

## What this package offers

- SQLiteChatMessageStorage
- Persists chat sessions and messages implementing @tokenring-ai/ai-client ChatMessageStorage.
- Creates ChatSession records as needed and stores ChatMessage request/response JSON.
- SQLiteChatHistoryStorage
- Implements @tokenring-ai/history ChatHistoryService to list sessions, recent messages, full thread trees, simple LIKE
  search, and reconstruct history by message id (recursive CTE).
- SQLiteChatCheckpointStorage
- Implements @tokenring-ai/history CheckpointService to create/list/retrieve checkpoints linked to specific messages.
- SQLiteCLIHistoryStorage
- Implements @tokenring-ai/chat HistoryStorage for shell/CLI command history (keeps most recent N commands, defaults to
  200).
- db/initializeLocalDatabase
- Helper to open a SQLite database via bun:sqlite and apply the schema from db/db.sql.

## Database schema (db/db.sql)

The initializer applies the following tables if they don’t exist:

- ChatSession(id, title, createdAt)
- ChatMessage(id, previousMessageId, sessionId, request, response, createdAt, updatedAt)
- Checkpoint(id, label, messageId, createdAt)
- CommandHistory(id, command, timestamp)

Timestamps are stored as UNIX epoch milliseconds. Foreign keys relate ChatMessage to ChatSession and to preceding
messages.

## Exports

From index.ts and sub-path exports:

- name, version, description (from package.json)
- SQLiteChatMessageStorage
- SQLiteChatHistoryStorage
- SQLiteChatCheckpointStorage
- SQLiteCLIHistoryStorage
- db/initializeLocalDatabase (path: @tokenring-ai/sqlite-storage/db/initializeLocalDatabase)

## Installation

This package is part of the monorepo and typically consumed by the Token Ring runtime. If you need it directly in a
workspace:

- Add dependency: "@tokenring-ai/sqlite-storage": "0.1.0"
- Runtime: requires Bun, as it uses bun:sqlite.
- Peer packages: @tokenring-ai/ai-client, @tokenring-ai/history, @tokenring-ai/chat, @tokenring-ai/registry as used by your
  application.

## Usage

### Initialize a local SQLite database

```ts
import initializeLocalDatabase from "@tokenring-ai/sqlite-storage/db/initializeLocalDatabase";

const dbFile = "/path/to/tokenring.sqlite"; // will be created if missing
const db = initializeLocalDatabase(dbFile);
```

### Persist chat messages

```ts
import {SQLiteChatMessageStorage} from "@tokenring-ai/sqlite-storage";
import {ChatMessageStorage} from "@tokenring-ai/ai-client";

const messageStorage: ChatMessageStorage = new SQLiteChatMessageStorage({db});

// store a chat turn
const stored = await messageStorage.storeChat(
  /* currentMessage */ undefined,
  /* request */ {messages: [{role: "user", content: "Hello world"}]},
  /* response */ {role: "assistant", content: "Hi!"}
);

// later retrieve by id
const again = await messageStorage.retrieveMessageById(stored.id);
```

### Browse chat history and checkpoints via services

```ts
import {ServiceRegistry} from "@tokenring-ai/registry";
import {ChatService} from "@tokenring-ai/chat";
import {chatCommands, ChatHistoryService, CheckpointService} from "@tokenring-ai/history";
import {SQLiteChatHistoryStorage, SQLiteChatCheckpointStorage} from "@tokenring-ai/sqlite-storage";

const registry = new ServiceRegistry();
await registry.start();

await registry.services.addServices(
  new ChatService({personas: {/* ... */}}),
  // Register concrete implementations backed by SQLite
  new SQLiteChatHistoryStorage({db}),
  new SQLiteChatCheckpointStorage({db})
);

// Use history command (interactive if a HumanInterfaceService is registered)
await chatCommands.history.execute(undefined, registry);
```

### CLI command history

```ts
import {SQLiteCLIHistoryStorage} from "@tokenring-ai/sqlite-storage";

const cliHistory = new SQLiteCLIHistoryStorage({db, config: {limit: 200}});
cliHistory.init();
cliHistory.add("/search sqlite");
const prev = cliHistory.getPrevious();
```

## Notes and limitations

- Bun required: This package uses bun:sqlite; run under Bun.
- JSON payloads: ChatMessage.request and ChatMessage.response are stored as JSON strings and parsed on read.
- Simple search: History search uses SQL LIKE; for semantic search, use other indexing/search packages in the monorepo.
- Resource management: Call close() on storages when you’re done to release the SQLite handle.

## File map

- pkg/sqlite-storage/index.ts
- pkg/sqlite-storage/SQLiteChatMessageStorage.ts
- pkg/sqlite-storage/SQLiteChatHistoryStorage.ts
- pkg/sqlite-storage/SQLiteChatCheckpointStorage.ts
- pkg/sqlite-storage/SQLiteCLIHistoryStorage.ts
- pkg/sqlite-storage/db/initializeLocalDatabase.ts
- pkg/sqlite-storage/db/db.sql

## License

MIT
