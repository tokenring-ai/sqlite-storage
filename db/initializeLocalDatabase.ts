import Database from "bun:sqlite";

import sql from "./db.sql" with { type: "text" };

export default function initializeLocalDatabase(databaseFile: string) {
  const db = new Database(databaseFile);

  db.exec(sql);

  return db ;
}
