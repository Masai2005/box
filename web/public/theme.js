// Applies the saved or system theme before first paint. Loaded as a blocking external script so the console's
// Content-Security-Policy can stay script-src 'self' with no inline scripts.
try {
  const stored = localStorage.getItem("ekilie-box-theme");
  if (stored === "dark") document.documentElement.classList.add("dark");
  if (stored === "light") document.documentElement.classList.remove("dark");
  if (!stored && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    document.documentElement.classList.add("dark");
  }
} catch (_) {}
