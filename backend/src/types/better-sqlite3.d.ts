declare module "better-sqlite3" {
  export interface RunResult {
    changes: number;
    lastInsertRowid: number | bigint;
  }

  export interface Statement<TBind = unknown> {
    run(...params: any[]): RunResult;
    get(...params: any[]): unknown;
    all(...params: any[]): unknown[];
  }

  export interface Transaction<TArgs extends unknown[] = []> {
    (...args: TArgs): unknown;
  }

  export default class Database {
    constructor(filename: string, options?: { readonly?: boolean; fileMustExist?: boolean });
    readonly name: string;
    pragma(statement: string): unknown;
    exec(sql: string): void;
    prepare<TBind = unknown>(sql: string): Statement<TBind>;
    transaction<TArgs extends unknown[]>(fn: (...args: TArgs) => unknown): Transaction<TArgs>;
    close(): void;
  }
}