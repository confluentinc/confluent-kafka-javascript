// Copyright 2026 Confluent Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * CEL bindings for the {@code timestamp} constructor.
 *
 * @bufbuild/cel already provides a stdlib {@code timestamp(string)} (RFC 3339 parsing),
 * {@code timestamp(timestamp)} (identity) and the standard timestamp operators. Two overloads
 * are added here, both on the standard name — there is no {@code timestamp.of} namespace:
 *
 *   - {@code timestamp(int)} — replaces the stdlib overload, which reads the int as epoch
 *     millis, with the spec (and cross-client) reading of epoch SECONDS.
 *   - {@code timestamp(dyn, int)} — an epoch value at a Flink-style decimal precision:
 *     0 seconds, 3 millis, 6 micros, 9 nanos.
 *
 * Nothing extra is needed for the one-argument non-int cases: this client's in-CEL timestamp
 * representation *is* {@code google.protobuf.Timestamp}, which stdlib's identity overload
 * already accepts, so an Avro or Protobuf timestamp field needs no wrapper at all. (The Java
 * client has to add an overload there only because its runtime values are {@code java.time}
 * objects that stdlib binds narrowly.)
 */

import { celFunc, CelScalar, objectType, type CelFunc } from "@bufbuild/cel";
import { create } from "@bufbuild/protobuf";
import { isReflectMessage, reflect, type ReflectMessage } from "@bufbuild/protobuf/reflect";
import {
  TimestampSchema,
  type Timestamp,
  timestampFromDate,
} from "@bufbuild/protobuf/wkt";

const { DYN, INT } = CelScalar;
const TIMESTAMP = objectType(TimestampSchema);

/**
 * Splits an epoch value in `unit` into seconds + nanos, flooring toward negative infinity so a
 * pre-epoch value yields a non-negative nano-of-second (BigInt `/` and `%` truncate toward
 * zero, which would produce a negative `nanos` that no proto Timestamp may carry). Matches
 * Java's Math.floorDiv/floorMod and Python's `//`.
 */
function splitEpoch(v: bigint, perSecond: bigint, nanosPerUnit: bigint): Timestamp {
  let seconds = v / perSecond;
  let remainder = v % perSecond;
  if (remainder < 0n) {
    seconds -= 1n;
    remainder += perSecond;
  }
  return create(TimestampSchema, { seconds, nanos: Number(remainder * nanosPerUnit) });
}

function fromEpoch(value: bigint | number, unit: string): Timestamp {
  const v = typeof value === "bigint" ? value : BigInt(Math.trunc(value));
  switch (unit) {
    case "millis":
      return splitEpoch(v, 1_000n, 1_000_000n);
    case "micros":
      return splitEpoch(v, 1_000_000n, 1_000n);
    case "nanos":
      return splitEpoch(v, 1_000_000_000n, 1n);
    case "seconds":
      return create(TimestampSchema, { seconds: v, nanos: 0 });
    default:
      throw new Error(
        `timestamp: unknown unit '${unit}'; expected one of millis, micros, nanos, seconds`,
      );
  }
}

/**
 * The `timestamp(dyn, int)` precision form. Precisions outside {0, 3, 6, 9} are rejected rather
 * than generalized to "any p means 10^-p": with the unit a number rather than a name, that check
 * is the only thing between a typo and a silently wrong instant.
 */
function fromEpochPrecision(value: unknown, precision: unknown): Timestamp {
  if (typeof value !== "bigint" && typeof value !== "number") {
    throw new Error(`timestamp: epoch value must be int, got ${typeof value}`);
  }
  const p = typeof precision === "bigint" ? Number(precision) : precision;
  if (typeof p !== "number") {
    throw new Error(`timestamp: precision must be int, got ${typeof precision}`);
  }
  switch (p) {
    case 0:
      return fromEpoch(value, "seconds");
    case 3:
      return fromEpoch(value, "millis");
    case 6:
      return fromEpoch(value, "micros");
    case 9:
      return fromEpoch(value, "nanos");
    default:
      throw new Error(
        `timestamp: unknown precision ${p}; expected 0 (seconds), 3 (millis), ` +
          "6 (micros) or 9 (nanos)",
      );
  }
}

function timestampOf(v: unknown): Timestamp {
  if (v === null || v === undefined) {
    throw new Error("timestamp: cannot convert null to Timestamp");
  }
  // celpy/celpy-equivalent: already a Timestamp ReflectMessage — pass through.
  if (isReflectMessage(v, TimestampSchema)) {
    return v.message as Timestamp;
  }
  // Generic proto duck-typing for DynamicMessage / alternate bindings.
  const anyV = v as any;
  if (anyV && anyV.$typeName === "google.protobuf.Timestamp") {
    return create(TimestampSchema, {
      seconds: typeof anyV.seconds === "bigint" ? anyV.seconds : BigInt(anyV.seconds ?? 0),
      nanos: Number(anyV.nanos ?? 0),
    });
  }
  if (v instanceof Date) {
    return timestampFromDate(v);
  }
  if (typeof v === "string") {
    // Parse RFC 3339 via the Date constructor.
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) {
      throw new Error(`timestamp: invalid RFC 3339 string '${v}'`);
    }
    return timestampFromDate(d);
  }
  if (typeof v === "boolean") {
    throw new Error("timestamp: cannot convert bool to Timestamp");
  }
  if (typeof v === "bigint" || typeof v === "number") {
    throw new Error(
      "timestamp: a bare number has no unit here; use timestamp(value, precision) " +
        "with a precision of 0, 3, 6 or 9",
    );
  }
  throw new Error(`timestamp: cannot convert ${typeof v} to Timestamp`);
}

export const TIMESTAMP_FUNCS: CelFunc[] = [
  // ---- timestamp(int): epoch SECONDS ----
  // @bufbuild/cel's stdlib reads the bare `timestamp(int)` argument as epoch MILLIS
  // (`timestampFromMs`, packages/cel/src/std/cast.ts). The CEL specification and every other
  // Schema Registry client (Java, Go, C++, C#, Python) read it as epoch SECONDS, so a rule like
  // `timestamp(this.epoch) < now` was off by a factor of 1000 in JS only. Registering the same
  // name with the same [INT] parameter list makes @bufbuild/cel's func-group dedup (exact match on
  // the func id `timestamp(int)`) REPLACE the stdlib overload with this one; user funcs are
  // appended after the stdlib groups, so this one wins.
  //
  // BREAKING CHANGE for any JS user who relied on the millis reading. That is deliberate: it
  // aligns this client with the CEL spec and the other Schema Registry clients. Callers who
  // really do have millis should say so explicitly with `timestamp(v, 3)`.
  //
  // Only the [INT] overload is displaced — the stdlib `timestamp(string)` (RFC 3339) and
  // `timestamp(timestamp)` (identity) overloads keep their ids and stay in the group. The
  // identity one is what makes an Avro or Protobuf timestamp field usable directly, since this
  // client's in-CEL timestamp representation is google.protobuf.Timestamp itself.
  celFunc("timestamp", [INT], TIMESTAMP, (v) => fromEpoch(v, "seconds")),

  // ---- timestamp(dyn, int): epoch value at a decimal precision ----
  // The epoch value is DYN rather than INT because a plain JS number is CEL `double`, and avsc
  // hands out a Number for a timestamp-millis field; requiring INT would reject it.
  celFunc("timestamp", [DYN, INT], TIMESTAMP, (v, p) => fromEpochPrecision(v, p)),
];

/**
 * Presents an Avro logical timestamp (epoch value in `unit`) to CEL as a self-describing
 * Timestamp, so a rule reads `message.tsField` as a timestamp with no wrapper and no unit
 * literal. Returned as a ReflectMessage so `@bufbuild/cel`'s `toCel` recognizes it as a
 * timestamp inside the message.
 */
export function avroTimestampToCel(value: number, unit: string): ReflectMessage {
  return reflect(TimestampSchema, fromEpoch(value, unit));
}

/** Whether a CEL value is a Timestamp this module can encode back to Avro. */
export function isCelTimestamp(value: unknown): boolean {
  if (isReflectMessage(value, TimestampSchema)) {
    return true;
  }
  return (
    typeof value === "object" &&
    value != null &&
    (value as any).$typeName === "google.protobuf.Timestamp"
  );
}

/**
 * Encodes a CEL Timestamp back to an Avro epoch value in `unit`, the inverse of
 * {@link avroTimestampToCel}.
 */
export function timestampToEpoch(value: unknown, unit: string): number {
  const ts = timestampOf(value);
  const seconds = Number(ts.seconds);
  const nanos = ts.nanos ?? 0;
  switch (unit) {
    case "millis":
      return seconds * 1_000 + Math.trunc(nanos / 1_000_000);
    case "micros":
      return seconds * 1_000_000 + Math.trunc(nanos / 1_000);
    case "nanos":
      return seconds * 1_000_000_000 + nanos;
    case "seconds":
      return seconds;
    default:
      throw new Error(
        `timestamp: unknown unit '${unit}'; expected one of millis, micros, nanos, seconds`,
      );
  }
}
