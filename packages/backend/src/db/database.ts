import 'dotenv/config'
import Database, { Database as DatabaseType } from 'better-sqlite3'
import path from 'path'

const dbPath = process.env.DATABASE_PATH ?? './inventrack.db'
const resolvedPath = path.resolve(dbPath)

const db: DatabaseType = new Database(resolvedPath)

// Enable WAL mode for better concurrent read performance (Requirement 2.10)
db.pragma('journal_mode = WAL')

// Enforce foreign key constraints (Requirement 11.4)
db.pragma('foreign_keys = ON')

export { db }
