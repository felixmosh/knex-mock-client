export class MockConnection {
  public __knexUid = Math.trunc(Math.random() * 1e6);
  public readonly fakeConnection = true;

  public transactionStack: string[] = [];

  public beginTransaction(cb: () => void) { cb(); }
  public commitTransaction(cb: () => void) { cb(); }

  /**
   * Points the transaction stack to the given transaction.
   * 
   * If the given transaction ID is no on the stack, push it to the top.
   * If the given transaction ID is already in the stack, remove all the transactions above it.
   * If the given transaction ID is undefined, clears the stack.
   */
  public pointStackTo(txId: string | undefined) {
    if (txId === undefined) {
      this.transactionStack.splice(0);

      return;
    }

    const index = this.transactionStack.indexOf(txId)

    if (index >= 0) {
      this.transactionStack.splice(index + 1);
    } else {
      this.transactionStack.push(txId);
    }
  }

  /**
   * Transaction ID managed by Knex.
   */
  get __knexTxId(): string | undefined {
    return this.transactionStack.at(-1);
  }

  set __knexTxId(txId: string | undefined) {
    this.pointStackTo(txId);
  }
}

