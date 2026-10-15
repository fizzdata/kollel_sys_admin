// Standard Hebrew/Israeli keyboard layout: maps each QWERTY letter key to the
// Hebrew letter it produces on a physical Hebrew keyboard, so students whose
// keyboard is set to English can still type Yiddish names without switching.
export const KEYBOARD_MAP: Record<string, string> = {
  q: "/",
  w: "'",
  e: "ק",
  r: "ר",
  t: "א",
  y: "ט",
  u: "ו",
  i: "ן",
  o: "ם",
  p: "פ",
  a: "ש",
  s: "ד",
  d: "ג",
  f: "כ",
  g: "ע",
  h: "י",
  j: "ח",
  k: "ל",
  l: "ך",
  z: "ז",
  x: "ס",
  c: "ב",
  v: "ה",
  b: "נ",
  n: "מ",
  m: "צ",
};

const HEBREW_BLOCK = /[֐-׿]/;
const ALLOWED_EXTRA = new Set([" ", "-", "'", '"']);

// Maps/filters a (typically short) changed substring so the Yiddish name
// fields only ever contain Hebrew letters, directly-typed Hebrew/IME input,
// or the small punctuation set used in Yiddish name abbreviations.
export function transformHebrewSegment(input: string): string {
  let out = "";
  for (const char of input) {
    const mapped = KEYBOARD_MAP[char.toLowerCase()];
    if (mapped) {
      out += mapped;
    } else if (HEBREW_BLOCK.test(char)) {
      out += char;
    } else if (ALLOWED_EXTRA.has(char)) {
      out += char;
    }
    // else: drop the character entirely (enforces Hebrew/Yiddish-only input)
  }
  return out;
}

// Returns an @input handler for a native <input> element bound to a reactive
// string field. Diffs the DOM's post-keystroke value against the previous
// field value to isolate exactly what changed (handles insert, backspace,
// mid-string delete, and paste/select-replace uniformly), transforms only
// that changed segment, then restores the caret after Vue re-patches the DOM.
export function useHebrewKeyboardInput() {
  function handleInput(event: Event, previousValue: string, onChange: (next: string) => void) {
    const el = event.target as HTMLInputElement;
    const raw = el.value;

    let prefix = 0;
    while (
      prefix < previousValue.length &&
      prefix < raw.length &&
      previousValue[prefix] === raw[prefix]
    ) {
      prefix++;
    }

    let suffix = 0;
    while (
      suffix < previousValue.length - prefix &&
      suffix < raw.length - prefix &&
      previousValue[previousValue.length - 1 - suffix] === raw[raw.length - 1 - suffix]
    ) {
      suffix++;
    }

    const changedMiddle = raw.slice(prefix, raw.length - suffix);
    const transformedMiddle = transformHebrewSegment(changedMiddle);
    const newValue = raw.slice(0, prefix) + transformedMiddle + raw.slice(raw.length - suffix);
    const newCaret = Math.min(prefix + transformedMiddle.length, newValue.length);

    onChange(newValue);

    nextTick(() => {
      // Only restore the caret if this element is still focused/attached;
      // Vue's reactive patch resets it to the end, so this must run after.
      try {
        el.setSelectionRange(newCaret, newCaret);
      } catch {
        // Ignore: element may have been unmounted or caret restore unsupported.
      }
    });

    return newValue;
  }

  return { handleInput };
}
