// A fast drop-in replacement for csv-reader 1.0.0: run(input) returns csv-reader's exact reading of
// {text, header} — {columns, rows, errors} — for every input, broken rows included.
//
// The dialect (identical to the reference): a U+FEFF at the very start is dropped; a record ends at LF or
// CRLF and a line left with no characters is no record; outside quotes a CR not followed by LF is dropped
// (stray_cr); a field that opens with a quote runs to the next quote that is not doubled, "" inside it is
// one quote and each CRLF or lone CR inside it is read as LF; what follows its closing quote, up to the
// next comma or line break, is appended as it stands (quote_junk, when the field ends); a quote that never
// closes is a literal character and the text after it is read again as unquoted (unterminated_quote); a
// quote inside an unquoted field is a literal character; fields stay strings, never trimmed or converted.
// columns is the first record when header is true, else null; rows are padded (short_row) or cut
// (long_row) to the first record's width. Errors are {code, line, row} in the order met, line the 1-based
// line the record starts on, row its index in rows (null for the header).
//
// Where the reference walks one character at a time and builds each field a character at a time, this
// reader jumps between the characters that matter with indexOf and takes fields as slices of the text:
// an unquoted field costs two searches and a slice (the record's line end is searched once, not once per
// field), a quoted field one search per unbroken stretch. Field results pass through shared slots
// instead of a fresh array per field, which keeps the garbage collector out of the hot loop.

const COMMA = 0;
const BREAK = 1;
const END = 2;

export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const n = text.length;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;

  let pos = 0;
  let line = 1;
  if (text.charCodeAt(0) === 0xfeff) pos = 1;

  let recordLine = 1;
  let recordRow = null;

  // Index of the next LF at or after the point it was computed for; n when there is none. Recomputed
  // lazily whenever pos moves past it (a quoted field can carry the read past the line's end).
  let lineEnd = -1;

  let fVal = '';
  let fEnd = END;
  let fAdd = 0;

  function unquoted(prefix) {
    let value = prefix;
    let added = 0;
    for (;;) {
      if (pos > lineEnd) {
        lineEnd = text.indexOf('\n', pos);
        if (lineEnd === -1) lineEnd = n + 1; // no LF left: never recompute
      }
      const il = lineEnd > n ? -1 : lineEnd;
      const ic = text.indexOf(',', pos);
      let m;
      let ended;
      if (ic === -1 && il === -1) {
        m = n;
        ended = END;
      } else if (il === -1 || (ic !== -1 && ic < il)) {
        m = ic;
        ended = COMMA;
      } else {
        m = il;
        ended = BREAK;
      }
      let segEnd = m;
      if (ended === BREAK && segEnd > pos && text.charCodeAt(segEnd - 1) === 13) segEnd -= 1;
      if (segEnd > pos) {
        const seg = text.slice(pos, segEnd);
        const cr = seg.indexOf('\r');
        if (cr !== -1) {
          value += seg.slice(0, cr);
          added += cr;
          errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
          pos += cr + 1;
          continue;
        }
        if (value === '') value = seg;
        else value += seg;
        added += seg.length;
      }
      if (ended === COMMA) {
        pos = m + 1;
      } else if (ended === BREAK) {
        pos = m + 1;
        line += 1;
      } else {
        pos = n;
      }
      fVal = value;
      fEnd = ended;
      fAdd = added;
      return;
    }
  }

  function quoted() {
    const open = pos;
    const openLine = line;
    let value = '';
    let segStart = open + 1;
    for (;;) {
      const iq = text.indexOf('"', segStart);
      if (iq === -1) {
        pos = open + 1;
        line = openLine;
        errors.push({ code: 'unterminated_quote', line: recordLine, row: recordRow });
        unquoted('"');
        return;
      }
      if (iq > segStart) {
        const seg = text.slice(segStart, iq);
        let from = 0;
        let cur = 0;
        for (;;) {
          const ir = seg.indexOf('\r', cur);
          const il = seg.indexOf('\n', cur);
          if (ir === -1 && il === -1) break;
          if (il !== -1 && (ir === -1 || il < ir)) {
            line += 1;
            cur = il + 1;
          } else {
            value += seg.slice(from, ir) + '\n';
            line += 1;
            cur = ir + 1;
            if (seg.charCodeAt(cur) === 10) cur += 1;
            from = cur;
          }
        }
        value += seg.slice(from);
      }
      if (text.charCodeAt(iq + 1) === 34) {
        value += '"';
        segStart = iq + 2;
        continue;
      }
      pos = iq + 1;
      if (pos >= n) {
        fVal = value;
        fEnd = END;
        fAdd = 0;
        return;
      }
      const c = text[pos];
      if (c === ',') {
        pos += 1;
        fVal = value;
        fEnd = COMMA;
        fAdd = 0;
        return;
      }
      if (c === '\n') {
        pos += 1;
        line += 1;
        fVal = value;
        fEnd = BREAK;
        fAdd = 0;
        return;
      }
      if (c === '\r' && text.charCodeAt(pos + 1) === 10) {
        pos += 2;
        line += 1;
        fVal = value;
        fEnd = BREAK;
        fAdd = 0;
        return;
      }
      unquoted(value);
      if (fAdd > 0) errors.push({ code: 'quote_junk', line: recordLine, row: recordRow });
      return;
    }
  }

  for (;;) {
    while (pos < n) {
      const c = text[pos];
      if (c === '\n') {
        pos += 1;
        line += 1;
      } else if (c === '\r' && text.charCodeAt(pos + 1) === 10) {
        pos += 2;
        line += 1;
      } else {
        break;
      }
    }
    if (pos >= n) break;

    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;
    lineEnd = text.indexOf('\n', pos);
    if (lineEnd === -1) lineEnd = n + 1;
    const fields = [];
    let isQuoted = false;
    do {
      isQuoted = pos < n && text[pos] === '"';
      if (isQuoted) quoted();
      else unquoted('');
      fields.push(fVal);
    } while (fEnd === COMMA);

    if (fields.length === 1 && fields[0] === '' && !isQuoted) continue;

    if (width < 0) width = fields.length;
    if (header && columns === null) {
      columns = fields;
      continue;
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      const extra = fields.splice(width);
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra });
    }
    rows.push(fields);
  }
  return { columns: header ? (columns ?? []) : null, rows, errors };
}
