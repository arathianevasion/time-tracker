// Import this FIRST (before ./client or anything that transitively imports it) in any test that
// touches the database — DB_PATH is read once at module-load time in client.ts.
process.env.TT_DB_PATH = ":memory:";
