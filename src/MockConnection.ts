export class MockConnection {
  public __knexUid = Math.trunc(Math.random() * 1e6);
  public readonly fakeConnection = true;

  public transactionStack: string[] = [];

  public beginTransaction(cb: () => void) { cb(); }
  public commitTransaction(cb: () => void) { cb(); }

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

