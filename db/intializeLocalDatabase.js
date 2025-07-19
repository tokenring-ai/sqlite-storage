import Database from "better-sqlite3";


import sql from './db.sql.js';


export default function intializeLocalDatabase(databaseFile) {
 const db = new Database(databaseFile);

 db.exec(sql);

 return db;
}