import type { Nullable } from './mapped.js';

export type UnixTimestamp = number;
export type Milliseconds = number;
export type Seconds = number;
export type Minutes = number;
export type Hours = number;

export type Threshold = number;
export type Percentage = number;

export type Label = string;
export type Index = number;

export type PackageID = string;

export type RecordKey = string | number | symbol;
export type PersistableRecordKey = Exclude<RecordKey, symbol>;

export type Primitive = boolean | number | string | bigint;
export type PersistablePrimitive = Nullable<Primitive>;

export type ObjMap = Record<string, any>;
export type PersistableObjMap = Record<PersistableRecordKey, PersistablePrimitive | { [Key in PersistableRecordKey]: PersistableObjMap }>;
