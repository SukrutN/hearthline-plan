export class MinHeap<T> {
  private readonly items: T[] = [];

  constructor(private readonly before: (left: T, right: T) => boolean) {}

  get size(): number {
    return this.items.length;
  }

  push(value: T): void {
    this.items.push(value);
    this.lift(this.items.length - 1);
  }

  pop(): T | undefined {
    const heap = this.items;
    if (heap.length === 0) return undefined;
    const top = heap[0];
    const last = heap.pop();
    if (heap.length > 0 && last !== undefined) {
      heap[0] = last;
      this.sink(0);
    }
    return top;
  }

  private lift(index: number): void {
    const heap = this.items;
    let cursor = index;
    while (cursor > 0) {
      const parent = (cursor - 1) >> 1;
      const current = heap[cursor];
      const above = heap[parent];
      if (current === undefined || above === undefined || !this.before(current, above)) return;
      heap[cursor] = above;
      heap[parent] = current;
      cursor = parent;
    }
  }

  private sink(index: number): void {
    const heap = this.items;
    let cursor = index;
    for (;;) {
      const left = cursor * 2 + 1;
      const right = left + 1;
      let best = cursor;
      const leftItem = heap[left];
      const bestItem = heap[best];
      if (left < heap.length && leftItem !== undefined && bestItem !== undefined && this.before(leftItem, bestItem)) {
        best = left;
      }
      const rightItem = heap[right];
      const nextBest = heap[best];
      if (right < heap.length && rightItem !== undefined && nextBest !== undefined && this.before(rightItem, nextBest)) {
        best = right;
      }
      if (best === cursor) return;
      const chosen = heap[best];
      const current = heap[cursor];
      if (chosen === undefined || current === undefined) return;
      heap[cursor] = chosen;
      heap[best] = current;
      cursor = best;
    }
  }
}
