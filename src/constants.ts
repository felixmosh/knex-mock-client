export const queryMethods = ['select', 'insert', 'update', 'delete', 'any'] as const;

export const transactionCommands = [
  'BEGIN;',
  'COMMIT;',
  'ROLLBACK',
  'SAVEPOINT',
  'RELEASE SAVEPOINT',
  'SET TRANSACTION ISOLATION LEVEL',
  'BEGIN TRANSACTION ISOLATION LEVEL',
] as const;
