declare module "better-sqlite3" {
  type SqlitePrepareResult = {
    all(...params: unknown[]): unknown[];
    get(...params: unknown[]): unknown;
  };

  type SqliteDatabase = {
    prepare(sql: string): SqlitePrepareResult;
    close(): void;
  };

  type SqliteConstructor = new (filename: string, options?: unknown) => SqliteDatabase;

  const Sqlite: SqliteConstructor;
  export default Sqlite;
}
