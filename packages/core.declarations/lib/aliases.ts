import { type Brand, make } from 'ts-brand';
import type { Nullable } from './mapped.js';

type UnixTimestamp = Brand<number, 'UnixTimestamp'>;
const UnixTimestampC = make<UnixTimestamp>();

type Milliseconds = Brand<number, 'Milliseconds'>;
const MillisecondsC = make<Milliseconds>();

type Seconds = Brand<number, 'Seconds'>;
const SecondsC = make<Seconds>();

type Minutes = Brand<number, 'Minutes'>;
const MinutesC = make<Minutes>();

type Hours = Brand<number, 'Hours'>;
const HoursC = make<Hours>();

type Threshold = Brand<number, 'Threshold'>;
const ThresholdC = make<Threshold>();

type Percentage = Brand<number, 'Percentage'>;
const PercentageC = make<Percentage>();

type Label = Brand<string, 'Label'>;
const LabelC = make<Label>();

type Index = Brand<number, 'Index'>;
const IndexC = make<Index>();

type PackageID = Brand<string, 'PackageID'>;
const PackageIDC = make<PackageID>();

type RecordKey = string | number | symbol;
type PersistableRecordKey = Exclude<RecordKey, symbol>;

type Primitive = boolean | number | string | bigint;
type PersistablePrimitive = Nullable<Primitive>;

// oxlint-disable-next-line no-explicit-any
type ObjMap = Record<string, any>;
type PersistableObjMap = Record<PersistableRecordKey, PersistablePrimitive | { [Key in PersistableRecordKey]: PersistableObjMap }>;

export { UnixTimestampC, MillisecondsC, SecondsC, MinutesC, HoursC, ThresholdC, PercentageC, LabelC, IndexC, PackageIDC };

export type {
	UnixTimestamp,
	Milliseconds,
	Seconds,
	Minutes,
	Hours,
	Threshold,
	Percentage,
	Label,
	Index,
	PackageID,
	RecordKey,
	PersistableRecordKey,
	Primitive,
	PersistablePrimitive,
	ObjMap,
	PersistableObjMap
};
