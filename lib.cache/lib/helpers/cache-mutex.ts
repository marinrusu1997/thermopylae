class CacheMutex<Key = string, Value = any> {
	private readonly;

	public acquire(key: Key): Promise<Value> | boolean {}

	public release(value: Value | Error): void {}
}
