import * as SQLite from 'expo-sqlite';

/**
 * Kleine Hilfsfunktionen, um expo-sqlite in Promises zu verwenden.
 * Bietet executeSqlAsync und transactionAsync, die in anderen Modulen
 * den Callback-basierten Stil vermeiden.
 */

export const openDatabase = (name: string) => {
  return SQLite.openDatabase(name);
};

export const executeSqlAsync = (db: any, sql: string, params: any[] = []) => {
  return new Promise<any>((resolve, reject) => {
    db.transaction(
      (tx: any) => {
        tx.executeSql(
          sql,
          params,
          (_: any, result: any) => resolve(result),
          (_: any, error: any) => {
            // Returning false prevents the transaction error callback from firing twice
            reject(error);
            return false;
          }
        );
      },
      (txError: any) => {
        reject(txError);
      }
    );
  });
};

export const transactionAsync = (db: any, callback: (tx: any) => Promise<void> | void) => {
  return new Promise<void>((resolve, reject) => {
    db.transaction(
      (tx: any) => {
        try {
          const ret = callback(tx);
          // If callback returns a Promise, wait for it
          if (ret && typeof (ret as any).then === 'function') {
            (ret as any).then(() => resolve()).catch((err: any) => reject(err));
          } else {
            resolve();
          }
        } catch (err) {
          reject(err);
        }
      },
      (error: any) => reject(error)
    );
  });
};
