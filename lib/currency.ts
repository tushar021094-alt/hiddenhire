export const CURRENCIES = [
  { code: "INR", symbol: "₹", label: "Indian Rupee", country: "India" },
  { code: "USD", symbol: "$", label: "US Dollar", country: "United States" },
  { code: "GBP", symbol: "£", label: "British Pound", country: "United Kingdom" },
  { code: "EUR", symbol: "€", label: "Euro", country: "European Union" },
  { code: "CAD", symbol: "C$", label: "Canadian Dollar", country: "Canada" },
  { code: "AUD", symbol: "A$", label: "Australian Dollar", country: "Australia" },
  { code: "AED", symbol: "د.إ", label: "UAE Dirham", country: "UAE" },
  { code: "SGD", symbol: "S$", label: "Singapore Dollar", country: "Singapore" },
] as const;

const FALLBACK_USD_RATES: Record<string, number> = {
  USD: 1, INR: 0.0119, GBP: 1.35, EUR: 1.17, CAD: 0.72, AUD: 0.66, AED: 0.2723, SGD: 0.78,
};

export async function usdRate(currency: string) {
  if (currency === "USD") return 1;
  try {
    const response = await fetch("https://api.frankfurter.app/latest?from=USD", { next: { revalidate: 3600 } });
    if (response.ok) {
      const data = (await response.json()) as { rates?: Record<string, number> };
      const rate = data.rates?.[currency];
      if (rate) return 1 / rate;
    }
  } catch {}
  return FALLBACK_USD_RATES[currency] ?? 1;
}

export function formatMoney(amount: number | undefined, currency = "USD") {
  if (amount == null) return "Not disclosed";
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${currency} ${Math.round(amount).toLocaleString()}`;
  }
}