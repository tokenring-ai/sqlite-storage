import HistoryStorage, {HistoryConfig} from "@token-ring/chat/HistoryStorage";

/**
 * SQLite-based implementation of HistoryStorage that provides persistent
 * storage for command line history using a SQLite database.
 *
 * This implementation:
 * - Persists command history to a SQLite database
 * - Maintains up to 200 most recent commands
 * - Supports efficient navigation through command history
 * - Prevents duplicate entries in history
 *
 * Database Schema:
 * - CommandHistory table with id, command, and timestamp columns
 *
 */

// Interface for database row structure
interface CommandHistoryRow {
  command: string;
}

export default class SQLiteCLIHistoryStorage extends HistoryStorage {
  /** The SQLite database connection */
  private db: any;

  /** Cached history list */
  private history: string[] = [];

  /**
   * Creates a new SQLiteCLIHistoryStorage instance
   *
   * @param options - Configuration options
   * @param options.db - SQLite database connection object
   * @param options.config - History configuration options
   * @throws {Error} When db object is not provided
   */
  constructor({db, config = {}}: { db: any; config?: HistoryConfig }) {
    // Set default limit to 200 as specified in the requirements
    super({limit: 200, ...config});

    if (!db) {
      throw new Error("Missing db object in constructor");
    }
    this.db = db;
  }

  /**
   * Initialize the history storage by creating necessary tables if they don't exist
   * and loading the command history into memory
   */
  init(): void {
    try {
      this.load();
    } catch (error) {
      console.error("Error initializing SQLiteCLIHistoryStorage:", error);
    }
  }

  /**
   * Add a command to history
   * @param command - The command to add
   */
  add(command: string): void {
    // Skip empty commands or commands in the blacklist
    if (!command.trim() ||
      (this.config.blacklist && this.config.blacklist.includes(command))) {
      return;
    }

    // Avoid adding duplicate of the most recent command
    if (this.history.length > 0 &&
      this.history[this.history.length - 1] === command) {
      return;
    }

    try {
      const timestamp = Date.now();
      const insertSql = `
             INSERT INTO CommandHistory (command, timestamp)
             VALUES (?, ?)
            `;

      this.db.prepare(insertSql).run([command, timestamp]);

      // Add command to in-memory history
      this.history.push(command);

      // If history exceeds limit, trim the oldest entries from the database
      if (this.history.length > (this.config.limit || 200)) {
        const deleteOldestSql = `
                 DELETE FROM CommandHistory
                 WHERE id NOT IN (
                  SELECT id FROM CommandHistory
                  ORDER BY timestamp DESC
                  LIMIT ?
                 )
                `;

        this.db.prepare(deleteOldestSql).run([this.config.limit || 200]);

        // Also trim from in-memory history
        this.history = this.history.slice(-1 * (this.config.limit || 200));
      }

      // Reset history index to point after the last item
      this.historyIndex = this.history.length;
    } catch (error) {
      console.error("Error adding command to history:", error);
    }
  }

  /**
   * Get the previous command in history
   * @returns The previous command or null if at beginning
   */
  getPrevious(): string | null {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      return this.history[this.historyIndex];
    }
    return null;
  }

  /**
   * Get the next command in history
   * @returns The next command or the current line if at end
   */
  getNext(): string | null {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      return this.history[this.historyIndex];
    } else if (this.historyIndex === this.history.length - 1) {
      // If at the last item, increment index to point "after" it
      this.historyIndex++;
      return this.currentLine; // Return the saved current line
    }
    return null;
  }

  /**
   * Get all commands in history
   * @returns Array of all commands in history
   */
  getAll(): string[] {
    return [...this.history]; // Return a copy of the array
  }

  /**
   * Clear command history from database and memory
   * @returns Promise that resolves when history is cleared
   */
  clear(): void {
    try {
      const sql = "DELETE FROM CommandHistory";
      this.db.prepare(sql).run();
      this.history = [];
      this.historyIndex = 0;
    } catch (error) {
      console.error("Error clearing command history:", error);
    }
  }

  /**
   * Closes the database connection
   * Should be called when the service is no longer needed
   */
  close(): void {
    this.db.close();
  }

  /**
   * Load command history from the database into memory
   * @private
   */
  private load(): void {
    try {
      const sql = `
             SELECT command
             FROM CommandHistory
             ORDER BY timestamp DESC
             LIMIT ?
            `;

      const rows = this.db.prepare(sql).all([this.config.limit]) as CommandHistoryRow[];
      // Store history in reverse order (oldest first) for easier navigation
      this.history = rows.map((row: CommandHistoryRow) => row.command).reverse();
      // Set history index to point after the last item
      this.historyIndex = this.history.length;
    } catch (error) {
      console.error("Error loading command history:", error);
      this.history = [];
      this.historyIndex = 0;
    }
  }
}