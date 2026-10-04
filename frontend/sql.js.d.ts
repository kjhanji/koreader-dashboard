declare module "sql.js" {
  type QueryExecResult = {
    columns: string[];
    values: unknown[][];
  };

  type Statement = {
    step(): boolean;
    getAsObject(): Record<string, unknown>;
    free(): void;
  };

  export type Database = {
    exec(sql: string): QueryExecResult[];
    prepare(sql: string): Statement;
    close(): void;
  };

  type SqlJsStatic = {
    Database: new (data?: Uint8Array) => Database;
  };

  export default function initSqlJs(config?: {
    wasmBinary?: ArrayBuffer;
  }): Promise<SqlJsStatic>;
}
