/**
 * Copyright 2026 Confluent Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { celMethod, CelScalar, type CelFunc } from "@bufbuild/cel";
import { isIPv4, isIPv6 } from "net";

// The string-format validators (member style: "foo@bar.com".isEmail()), matching the other
// Schema Registry clients. Implementations follow protovalidate's semantics (the email regex
// is the HTML-standard one it uses; IPs go through Node's parser, as the C++ client uses
// inet_pton) without vendoring protovalidate's full RFC parsers.

const { STRING, BOOL } = CelScalar;

// HTML-standard valid email (https://html.spec.whatwg.org/multipage/input.html#valid-e-mail-address).
const EMAIL_RE =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
// RFC 1123 hostname labels.
const HOSTNAME_RE =
  /^(?=.{1,253}$)([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
// Absolute URI: scheme ":" hier-part, no whitespace.
const URI_RE = /^[a-zA-Z][a-zA-Z0-9+.-]*:\S*$/;
const UUID_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export const IS_FUNCS: CelFunc[] = [
  celMethod("isEmail", STRING, [], BOOL, function (this: string) {
    return this.length > 0 && this.length <= 254 && EMAIL_RE.test(this);
  }),
  celMethod("isHostname", STRING, [], BOOL, function (this: string) {
    return HOSTNAME_RE.test(this);
  }),
  celMethod("isIpv4", STRING, [], BOOL, function (this: string) {
    return isIPv4(this);
  }),
  celMethod("isIpv6", STRING, [], BOOL, function (this: string) {
    return isIPv6(this);
  }),
  celMethod("isUri", STRING, [], BOOL, function (this: string) {
    return URI_RE.test(this);
  }),
  celMethod("isUriRef", STRING, [], BOOL, function (this: string) {
    return this.length > 0 && !/\s/.test(this);
  }),
  celMethod("isUuid", STRING, [], BOOL, function (this: string) {
    return UUID_RE.test(this);
  }),
];
