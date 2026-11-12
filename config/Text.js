// Player names are the one piece of free text in a game, and online they are
// typed on somebody else's phone. `plain()` removes the characters that could
// turn a name into markup, so a name is safe wherever it is printed, whether
// the screen sets it as text or builds it into an HTML string.
export const plain = s => String(s == null ? '' : s).replace(/[<>&"'`\\\u0000-\u001f]/g, '');
