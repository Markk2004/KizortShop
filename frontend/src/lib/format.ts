const bahtFormatter = new Intl.NumberFormat("th-TH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** 2400 -> "฿2,400.00" */
export function formatBaht(value: number, fractionDigits = true): string {
  return fractionDigits ? `฿${bahtFormatter.format(value)}` : `฿${Math.round(value).toLocaleString("th-TH")}`;
}

/** 2400 -> "+฿2,400.00", -191 -> "-฿191.00", 0 -> "฿0.00" */
export function formatSignedBaht(value: number, fractionDigits = true): string {
  if (value === 0) return formatBaht(0, fractionDigits);
  const prefix = value > 0 ? "+" : "-";
  const absValue = Math.abs(value);
  const formatted = fractionDigits ? bahtFormatter.format(absValue) : Math.round(absValue).toLocaleString("th-TH");
  return `${prefix}฿${formatted}`;
}

/** 128490 -> "128,490" */
export function formatNumber(value: number): string {
  return value.toLocaleString("en-US");
}

/** "Salmon" -> "Sal***" */
export function maskUsername(name: string, visible = 3): string {
  return `${name.slice(0, visible)}***`;
}
