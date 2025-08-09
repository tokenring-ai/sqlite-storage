export default `
CREATE TABLE IF NOT EXISTS ChatSession (
                          id INTEGER PRIMARY KEY AUTOINCREMENT,
                          title TEXT,
                          createdAt INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE TABLE IF NOT EXISTS ChatMessage (
                          id INTEGER PRIMARY KEY AUTOINCREMENT,
                          previousMessageId INTEGER,
                          sessionId INTEGER NOT NULL,
                          request TEXT NOT NULL,
                          response TEXT,
                          createdAt INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
                          updatedAt INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
                          FOREIGN KEY (previousMessageId) REFERENCES ChatMessage(id) ON DELETE CASCADE,
                          FOREIGN KEY (sessionId) REFERENCES ChatSession(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS Checkpoint (
                         id INTEGER PRIMARY KEY AUTOINCREMENT,
                         label TEXT NOT NULL,
                         messageId INTEGER NOT NULL,
                         createdAt INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
 `
