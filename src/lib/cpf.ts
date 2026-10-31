// Validação e formatação de CPF (dígitos verificadores oficiais).

export const onlyDigits = (v: string) => v.replace(/\D/g, "");

function checkDigit(digits: number[], weightStart: number) {
  const sum = digits.reduce((s, d, i) => s + d * (weightStart - i), 0);
  const rest = (sum * 10) % 11;
  return rest === 10 ? 0 : rest;
}

export function isValidCpf(value: string) {
  const d = onlyDigits(value).split("").map(Number);
  if (d.length !== 11 || d.every((x) => x === d[0])) return false;
  return checkDigit(d.slice(0, 9), 10) === d[9] && checkDigit(d.slice(0, 10), 11) === d[10];
}

export function formatCpf(value: string) {
  return onlyDigits(value).slice(0, 11).replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

/** Gera um CPF válido a partir de um gerador de números — usado só nos dados de exemplo. */
export function generateCpf(rand: () => number) {
  const base = Array.from({ length: 9 }, () => Math.floor(rand() * 10));
  const d1 = checkDigit(base, 10);
  const d2 = checkDigit([...base, d1], 11);
  return formatCpf([...base, d1, d2].join(""));
}
