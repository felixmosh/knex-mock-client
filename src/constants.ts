export const queryMethods = ['select', 'insert', 'update', 'delete', 'any'] as const;

export const transactionCommands = [
  'BEGIN;',
  'COMMIT;',
  'ROLLBACK',
  'SAVEPOINT',
  'RELEASE SAVEPOINT',
] as const;
