export const fmtUSD = (n: number) =>
  n < 0.01
    ? `$${n.toFixed(6)}`
    : n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmtNum = (n: number) => n.toLocaleString("en-US");

export const fmtPercent = (n: number, fractionDigits = 2) => `${(n * 100).toFixed(fractionDigits)}%`;

export const fmtMs = (n: number) => `${Math.round(n)} ms`;
