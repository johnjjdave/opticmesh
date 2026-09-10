export function evaluateExpression(source: string, allowSigned = false): number | null {
  const text = source.replace(/[×x]/gi, "*").replace(/÷/g, "/").replace(/,/g, "").trim();
  if (!text || !/^[\d.+\-*/()\s]+$/.test(text)) return null;
  let index = 0;
  const skip = () => {
    while (/\s/.test(text[index] ?? "")) index += 1;
  };
  const expression = (): number => {
    let value = term();
    while (true) {
      skip();
      const op = text[index];
      if (op !== "+" && op !== "-") break;
      index += 1;
      const next = term();
      value = op === "+" ? value + next : value - next;
    }
    return value;
  };
  const term = (): number => {
    let value = factor();
    while (true) {
      skip();
      const op = text[index];
      if (op !== "*" && op !== "/") break;
      index += 1;
      const next = factor();
      value = op === "*" ? value * next : value / next;
    }
    return value;
  };
  const factor = (): number => {
    skip();
    if (text[index] === "+" || text[index] === "-") {
      const sign = text[index++] === "-" ? -1 : 1;
      return sign * factor();
    }
    if (text[index] === "(") {
      index += 1;
      const value = expression();
      skip();
      if (text[index] !== ")") throw new Error("Missing parenthesis");
      index += 1;
      return value;
    }
    const match = text.slice(index).match(/^(?:\d+\.?\d*|\.\d+)/);
    if (!match) throw new Error("Expected number");
    index += match[0].length;
    return Number(match[0]);
  };
  try {
    const result = expression();
    skip();
    return index === text.length && Number.isFinite(result) && (allowSigned || result > 0) ? result : null;
  } catch {
    return null;
  }
}
