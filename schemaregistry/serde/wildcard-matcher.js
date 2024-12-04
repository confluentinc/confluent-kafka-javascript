"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.match = match;
/**
 * Matches fully-qualified names that use dot (.) as the name boundary.
 *
 * <p>A '?' matches a single character.
 * A '*' matches one or more characters within a name boundary.
 * A '**' matches one or more characters across name boundaries.
 *
 * <p>Examples:
 * <pre>
 * wildcardMatch("eve", "eve*")                  --&gt; true
 * wildcardMatch("alice.bob.eve", "a*.bob.eve")  --&gt; true
 * wildcardMatch("alice.bob.eve", "a*.bob.e*")   --&gt; true
 * wildcardMatch("alice.bob.eve", "a*")          --&gt; false
 * wildcardMatch("alice.bob.eve", "a**")         --&gt; true
 * wildcardMatch("alice.bob.eve", "alice.bob*")  --&gt; false
 * wildcardMatch("alice.bob.eve", "alice.bob**") --&gt; true
 * </pre>
 *
 * @param str             - the string to match on
 * @param wildcardMatcher - the wildcard string to match against
 * @returns true if the string matches the wildcard string
 */
function match(str, wildcardMatcher) {
    var re = wildcardToRegexp(wildcardMatcher, '.');
    var pattern;
    try {
        pattern = new RegExp(re);
    }
    catch (error) {
        return false;
    }
    var match = str.match(pattern);
    return match != null && match[0] === str;
}
function wildcardToRegexp(globExp, separator) {
    var _a;
    var dst = '';
    var src = globExp.replaceAll('**' + separator + '*', '**');
    var i = 0;
    var size = src.length;
    while (i < size) {
        var c = src[i];
        i++;
        switch (c) {
            case '*':
                // One char lookahead for **
                if (i < src.length && src[i] == '*') {
                    dst += '.*';
                    i++;
                }
                else {
                    dst += '[^' + separator + ']*';
                }
                break;
            case '?':
                dst += '[^' + separator + ']';
                break;
            case '.':
            case '+':
            case '{':
            case '}':
            case '(':
            case ')':
            case '|':
            case '^':
            case '$':
                // These need to be escaped in regular expressions
                dst += '\\' + c;
                break;
            case '\\':
                _a = doubleSlashes(dst, src, i), dst = _a[0], i = _a[1];
                break;
            default:
                dst += c;
                break;
        }
    }
    return dst;
}
function doubleSlashes(dst, src, i) {
    // Emit the next character without special interpretation
    dst += '\\';
    if (i + 1 < src.length) {
        dst += '\\' + src[i];
        i++;
    }
    else {
        // A backslash at the very end is treated like an escaped backslash
        dst += '\\';
    }
    return [dst, i];
}
