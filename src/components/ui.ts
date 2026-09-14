const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-full font-medium transition disabled:cursor-not-allowed disabled:opacity-50";

export const ui = {
  buttonPrimary: `${buttonBase} bg-ink px-5 py-2.5 text-sm text-paper hover:bg-ink/85`,
  buttonAccent: `${buttonBase} bg-accent px-5 py-2.5 text-sm text-white hover:bg-accent/90`,
  buttonSecondary: `${buttonBase} border border-line bg-card px-5 py-2.5 text-sm text-ink hover:border-ink-faint hover:bg-white`,
  buttonDanger: `${buttonBase} bg-danger px-5 py-2.5 text-sm text-white hover:bg-danger/90`,
  buttonSmall: `${buttonBase} border border-line bg-card px-3 py-1.5 text-sm text-ink hover:border-ink-faint hover:bg-white`,
  buttonSmallDanger: `${buttonBase} border border-transparent px-3 py-1.5 text-sm text-danger hover:border-danger/30 hover:bg-danger-soft`,
  input:
    "block w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-base text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25 aria-[invalid=true]:border-danger",
  label: "block text-sm font-medium text-ink",
  hint: "mt-1.5 text-sm text-ink-soft",
  error: "mt-1.5 text-sm font-medium text-danger",
  eyebrow: "font-mono text-xs uppercase tracking-[0.18em]",
};
