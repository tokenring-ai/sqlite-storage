import { Database } from "bun:sqlite";

import sql from "./db.sql";

export default function intializeLocalDatabase(databaseFile: string) {
  const db = new Database(databaseFile);

  db.exec(sql);

  return db as any;
}
