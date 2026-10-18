const bahtFormatter = new Intl.NumberFormat("th-TH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** 2400 -> "฿2,400.00" */
export function formatBaht(value: number, fractionDigits = true): string {
  return fractionDigits ? `฿${bahtFormatter.format(value)}` : `฿${Math.round(value).toLocaleString("th-TH")}`;
}

/** 128490 -> "128,490" */
export function formatNumber(value: number): string {
  return value.toLocaleString("en-US");
}

/** "Salmon" -> "Sal***" */
export function maskUsername(name: string, visible = 3): string {
  return `${name.slice(0, visible)}***`;
}
