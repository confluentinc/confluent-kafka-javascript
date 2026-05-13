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
 * CEL binding for the {@code timestamp.of} constructor.
 *
 * @bufbuild/cel already provides a stdlib {@code timestamp(string)} (RFC 3339
 * parsing) plus standard timestamp operators. The extension we add here is
 * the namespaced {@code timestamp.of(...)} constructor:
 *
 *   - {@code timestamp.of(dyn)} — runtime-dispatches on the value's JS type
 *     (Date, ReflectMessage of Timestamp, bigint with hint about the 2-arg form, etc.).
 *   - {@code timestamp.of(int, string)} — epoch numeric + unit string.
 *
 * Singular namespace mirrors CEL stdlib's {@code optional.of(x)} pattern.
 */

import { celFunc, CelScalar, objectType, type CelFunc } from "@bufbuild/cel";
import { create } from "@bufbuild/protobuf";
import { isReflectMessage } from "@bufbuild/protobuf/reflect";
import {
  TimestampSchema,
  type Timestamp,
  timestampFromDate,
  timestampFromMs,
} from "@bufbuild/protobuf/wkt";

const { DYN, STRING } = CelScalar;
const TIMESTAMP = objectType(TimestampSchema);

function fromEpoch(value: bigint | number, unit: string): Timestamp {
  const v = typeof value === "bigint" ? value : BigInt(Math.trunc(value));
  switch (unit) {
    case "millis":
      return timestampFromMs(Number(v));
    case "micros": {
      const seconds = v / 1_000_000n;
      const nanos = Number((v % 1_000_000n) * 1_000n);
      return create(TimestampSchema, { seconds, nanos });
    }
    case "nanos": {
      const seconds = v / 1_000_000_000n;
      const nanos = Number(v % 1_000_000_000n);
      return create(TimestampSchema, { seconds, nanos });
    }
    case "seconds":
      return create(TimestampSchema, { seconds: v, nanos: 0 });
    default:
      throw new Error(
        `timestamp.of: unknown unit '${unit}'; expected one of millis, micros, nanos, seconds`,
      );
  }
}

function timestampOf(v: unknown): Timestamp {
  if (v === null || v === undefined) {
    throw new Error("timestamp.of: cannot convert null to Timestamp");
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
      throw new Error(`timestamp.of: invalid RFC 3339 string '${v}'`);
    }
    return timestampFromDate(d);
  }
  if (typeof v === "boolean") {
    throw new Error("timestamp.of: cannot convert bool to Timestamp");
  }
  if (typeof v === "bigint" || typeof v === "number") {
    throw new Error(
      "timestamp.of: raw int has no unit; use timestamp.of(value, " +
        '"millis"|"micros"|"nanos"|"seconds")',
    );
  }
  throw new Error(`timestamp.of: cannot convert ${typeof v} to Timestamp`);
}

function fromEpochAny(value: unknown, unit: unknown): Timestamp {
  if (typeof value !== "bigint" && typeof value !== "number") {
    throw new Error(`timestamp.of: epoch value must be int or double, got ${typeof value}`);
  }
  if (typeof unit !== "string") {
    throw new Error(`timestamp.of: unit must be string, got ${typeof unit}`);
  }
  return fromEpoch(value as bigint | number, unit as string);
}

export const TIMESTAMP_FUNCS: CelFunc[] = [
  celFunc("timestamp.of", [DYN], TIMESTAMP, (v) => timestampOf(v)),
  // Accept DYN for the epoch value so number, bigint, or other numeric
  // types are accepted (avsc returns plain Number for timestamp-millis).
  celFunc("timestamp.of", [DYN, STRING], TIMESTAMP, (v, unit) => fromEpochAny(v, unit)),
];
