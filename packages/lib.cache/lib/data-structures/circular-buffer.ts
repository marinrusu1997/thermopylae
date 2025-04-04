/** @private */
class CircularBuffer<T> {
	private readonly storage: Set<T>;

	private readonly capacity: number;

	public constructor(capacity: number) {
		this.storage = new Set<T>();
		this.capacity = capacity;
	}

	public get size(): number {
		return this.storage.size;
	}

	public add(element: T): void {
		if (this.storage.size === this.capacity) {
			this.storage.delete(this.storage.values().next().value as T);
		}
		this.storage.add(element);
	}

	public has(element: T): boolean {
		return this.storage.has(element);
	}

	public delete(element: T): boolean {
		return this.storage.delete(element);
	}

	public clear(): void {
		this.storage.clear();
	}
}

export { CircularBuffer };
