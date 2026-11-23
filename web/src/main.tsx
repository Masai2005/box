import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { Toaster } from "sonner";
import { AuthProvider } from "@/components/AuthProvider";
import { ThemeProvider, useTheme } from "@/components/ThemeProvider";
import { router } from "@/router";
import "@/styles.css";

function AppToaster() {
  const { resolvedTheme } = useTheme();
  return (
    <Toaster
      theme={resolvedTheme}
      position="bottom-right"
      toastOptions={{
        style: {
          borderRadius: 0,
          border: "1px solid hsl(var(--border))",
          background: "hsl(var(--card))",
          color: "hsl(var(--card-foreground))",
          fontFamily: "JetBrains Mono, monospace",
          fontSize: "12px",
        },
      }}
    />
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <RouterProvider router={router} />
        <AppToaster />
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
