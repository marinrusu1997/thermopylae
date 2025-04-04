// oxlint-disable-next-line no-explicit-any
type Any = any;

const SOFT_DELETE: Any = undefined;

type OrderedArray<T> = readonly T[];

export { SOFT_DELETE };
export type { Any, OrderedArray };
