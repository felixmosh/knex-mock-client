class Stack<T> {
  private readonly values: T[] = [];

  public push(value: T) {
    this.values.push(value);
  }

  public pop(): T | undefined {
    const [lastItem] = this.values.splice(this.values.length - 1);

    return lastItem;
  }

  /**
   * Peek at a value on the stack without removing it.
   * 
   * @param offset {number} Offset from the top of the stack to peek. Default to 0.
   */
  public peek(offset = 0): T | undefined {
    return this.values[this.values.length - offset - 1];
  }

  /**
   * Points the stack to the first occurrence of the given value.
   * 
   * If the given value is not on the stack, push it to the top.
   * If the given value is already in the stack, remove all the transactions above it.
   * If the given value is undefined, clears the stack.
   */
  public pointTo(value: T | undefined) {
    if (this.peek() === value) return;

    if (value === undefined) {
      // Clear the stack
      this.values.splice(0);

      return;
    }

    const index = this.values.indexOf(value)

    if (index >= 0) {
      this.values.splice(index + 1);
    } else {
      this.values.push(value);
    }
  }
}

export class MockConnection {
  public __knexUid = Math.trunc(Math.random() * 1e6);
  public readonly fakeConnection = true;

  public transactionStack = new Stack<number>();

  public beginTransaction(cb: () => void) { cb(); }
  public commitTransaction(cb: () => void) { cb(); }
}

