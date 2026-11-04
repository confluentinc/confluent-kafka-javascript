/*
 * JSDoc template that writes MyST (markdown) instead of HTML.
 *
 * Used the same way as the default template, see `make docs-myst`:
 *   jsdoc -t util/jsdoc-myst-template -c util/jsdoc-myst.conf -d docs-myst ...
 *
 * One section per class/namespace (typedefs are folded into their parent,
 * or get a section of their own when they have none). By default everything
 * goes into a single api.md; set templates.myst.singleFile to false in the
 * config to get one file per class plus an index.md instead.
 * Every entity gets a MyST target `(longname)=`, so `{@link X}` in descriptions
 * is turned into a `[X](#X)` cross reference.
 */
const fs = require('fs');
const path = require('path');
const env = require('jsdoc/env');
const helper = require('jsdoc/util/templateHelper');

const PAGE_KINDS = ['class', 'namespace'];

// Instance members use '#' in the longname, which is awkward in a target.
const anchor = (longname) => longname.replace(/#/g, '.');
const fileFor = (longname) => `${longname.replace(/[^A-Za-z0-9._-]/g, '_')}.md`;

// JSDoc writes generics as `Promise.<void>`; show them the TypeScript way.
const typeOf = (t) => (t && t.names && t.names.length ? t.names.join(' | ').replace(/\.</g, '<') : '');

function cell(s) {
  return String(s || '')
    .trim()
    .replace(/\|/g, '\\|')
    .replace(/\s+/g, ' ');
}

function table(headers, rows) {
  const used = headers.map((_, i) => rows.some((r) => r[i]));
  const hs = headers.filter((_, i) => used[i]);
  if (!rows.length) return '';
  const lines = [
    `| ${hs.join(' | ')} |`,
    `| ${hs.map(() => '---').join(' | ')} |`,
  ];
  for (const r of rows) lines.push(`| ${r.filter((_, i) => used[i]).map(cell).join(' | ')} |`);
  return lines.join('\n') + '\n';
}

function makeResolver(known) {
  const link = (target, text) => {
    const t = target.trim();
    if (/^https?:\/\//.test(t)) return `[${text || t}](${t})`;
    const key = t.replace(/#/g, '#');
    if (known.has(key)) return `[${text || t}](#${anchor(key)})`;
    return `\`${text || t}\``;
  };
  return (s) => {
    if (!s) return '';
    return s
      // [text]{@link target}
      .replace(/\[([^\]]+)\]\{@link\s+([^}\s|]+)\s*\}/g, (_, text, target) => link(target, text))
      // {@link target|text} and {@link target text}
      .replace(/\{@link\s+([^}\s|]+)\s*[|\s]\s*([^}]+)\}/g, (_, target, text) => link(target, text))
      // {@link target}
      .replace(/\{@link\s+([^}\s|]+)\s*\}/g, (_, target) => link(target));
  };
}

function paramsTable(params, md) {
  if (!params || !params.length) return '';
  return table(
    ['Name', 'Type', 'Default', 'Description'],
    params.map((p) => [
      `\`${p.name}\`${p.optional ? ' (optional)' : ''}${p.nullable ? ' (nullable)' : ''}`,
      typeOf(p.type) ? `\`${typeOf(p.type)}\`` : '',
      p.defaultvalue !== undefined ? `\`${p.defaultvalue}\`` : '',
      md(p.description),
    ]));
}

function signature(d) {
  const names = (d.params || []).filter((p) => !p.name.includes('.')).map((p) => (p.optional ? `[${p.name}]` : p.name));
  return `${d.name}(${names.join(', ')})`;
}

function detail(d, md, level) {
  const h = '#'.repeat(level);
  const out = [];
  out.push(`(${anchor(d.longname)})=`);
  const title = d.kind === 'function' ? signature(d) : d.name;
  out.push(`${h} ${d.scope === 'static' ? 'static ' : ''}${title}`);
  if (d.deprecated) out.push(`:::{deprecated} ${typeof d.deprecated === 'string' ? d.deprecated : ''}\n:::`);
  if (d.description) out.push(md(d.description));
  if (d.kind !== 'function' && typeOf(d.type)) out.push(`**Type:** \`${typeOf(d.type)}\``);
  if (d.params && d.params.length) out.push('**Parameters**\n\n' + paramsTable(d.params, md));
  if (d.returns && d.returns.length) {
    out.push('**Returns**\n\n' + d.returns.map((r) => `- ${typeOf(r.type) ? `\`${typeOf(r.type)}\`` : ''}${r.description ? ` ${md(r.description).trim()}` : ''}`).join('\n'));
  }
  if (d.exceptions && d.exceptions.length) {
    out.push('**Throws**\n\n' + d.exceptions.map((r) => `- ${typeOf(r.type) ? `\`${typeOf(r.type)}\`` : ''}${r.description ? ` ${md(r.description).trim()}` : ''}`).join('\n'));
  }
  if (d.properties && d.properties.length && d.kind === 'typedef') {
    out.push('**Properties**\n\n' + paramsTable(d.properties, md));
  }
  if (d.examples && d.examples.length) {
    out.push('**Example**\n\n' + d.examples.map((e) => '```js\n' + e.trim() + '\n```').join('\n\n'));
  }
  if (d.see && d.see.length) out.push('**See also:** ' + d.see.map((s) => md(s)).join(', '));
  return out.join('\n\n') + '\n';
}

function page(d, kids, md) {
  const of = (...kinds) => kids.filter((k) => kinds.includes(k.kind));
  const parts = [];
  parts.push(`(${anchor(d.longname)})=\n# ${d.longname}`);
  if (d.deprecated) parts.push(`:::{deprecated} ${typeof d.deprecated === 'string' ? d.deprecated : ''}\n:::`);
  if (d.description) parts.push(md(d.description));
  if (d.augments && d.augments.length) parts.push(`**Extends:** ${d.augments.map((a) => md(`{@link ${a}}`)).join(', ')}`);
  if (d.kind === 'class' && d.params && d.params.length) {
    parts.push('## Constructor\n\n' + paramsTable(d.params, md));
  }
  if (d.examples && d.examples.length) {
    parts.push('## Example\n\n' + d.examples.map((e) => '```js\n' + e.trim() + '\n```').join('\n\n'));
  }
  const sections = [
    ['Properties', of('member', 'constant')],
    ['Methods', of('function')],
    ['Events', of('event')],
    ['Type definitions', of('typedef')],
  ];
  for (const [title, items] of sections) {
    if (!items.length) continue;
    parts.push(`## ${title}`);
    for (const it of items) parts.push(detail(it, md, 3));
  }
  if (d.meta) parts.push(`*Source: \`${d.meta.filename}:${d.meta.lineno}\`*`);
  return parts.join('\n\n') + '\n';
}

exports.publish = (taffyData, opts) => {
  const data = helper.prune(taffyData);
  data.sort('longname, version, since');
  const all = data().get().filter((d) => d.kind !== 'package' && d.name && !d.undocumented);

  const byLongname = new Map(all.map((d) => [d.longname, d]));
  const pageOwners = new Set(all.filter((d) => PAGE_KINDS.includes(d.kind)).map((d) => d.longname));
  // A typedef is folded into its parent's page, or gets its own page.
  const ownPage = (d) => PAGE_KINDS.includes(d.kind) || (d.kind === 'typedef' && !pageOwners.has(d.memberof));

  const known = new Set(byLongname.keys());
  const md = makeResolver(known);

  const children = new Map();
  for (const d of all) {
    if (!d.memberof || ownPage(d)) continue;
    if (!children.has(d.memberof)) children.set(d.memberof, []);
    children.get(d.memberof).push(d);
  }

  const outDir = path.resolve(opts.destination);
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  const pages = all.filter(ownPage).map((d) => ({
    d,
    body: d.kind === 'typedef'
      ? detail(d, md, 1).replace(/^# .*$/m, `# ${d.longname}`)
      : page(d, children.get(d.longname) || [], md),
  }));

  const group = (kind) => pages.map((p) => p.d).filter((d) => d.kind === kind).sort((a, b) => a.longname.localeCompare(b.longname));
  const groups = [['Namespaces', group('namespace')], ['Classes', group('class')], ['Type definitions', group('typedef')]];

  const settings = (env.conf.templates || {}).myst || {};
  if (settings.singleFile !== false) {
    // One file: every page becomes a section, so headings move down a level.
    const demote = (text) => {
      let fenced = false;
      return text.split('\n').map((line) => {
        if (/^```/.test(line)) fenced = !fenced;
        return !fenced && /^#{1,5} /.test(line) ? `#${line}` : line;
      }).join('\n');
    };
    const toc = groups.filter(([, items]) => items.length).map(([title, items]) =>
      `**${title}**\n\n` + items.map((d) => `- [${d.longname}](#${anchor(d.longname)})`).join('\n')).join('\n\n');
    const file = path.join(outDir, settings.fileName || 'api.md');
    fs.writeFileSync(file, ['# API reference', toc, ...pages.sort((a, b) => a.d.longname.localeCompare(b.d.longname)).map((p) => demote(p.body))].join('\n\n') + '\n');
    console.log(`Wrote ${file}`);
    return;
  }

  for (const { d, body } of pages) fs.writeFileSync(path.join(outDir, fileFor(d.longname)), body);
  const toc = ([title, items]) => (items.length
    ? `## ${title}\n\n` + items.map((d) => `- [${d.longname}](${fileFor(d.longname)})`).join('\n') + '\n'
    : '');
  const hidden = '```{toctree}\n:hidden:\n\n' + pages.map((p) => fileFor(p.d.longname).replace(/\.md$/, '')).join('\n') + '\n```\n';
  fs.writeFileSync(path.join(outDir, 'index.md'), ['# API reference\n', ...groups.map(toc), hidden].join('\n'));
  console.log(`Wrote ${pages.length + 1} MyST files to ${outDir}`);
};
