import { useEffect } from "react";
import { useBlocker } from "@tanstack/react-router";

/** Block route changes and browser unloads while a form has unsaved changes. */
export function useUnsavedChanges(dirty: boolean) {
  const blocker = useBlocker({
    shouldBlockFn: () => dirty,
    withResolver: true,
    enableBeforeUnload: () => dirty,
  });

  useEffect(() => {
    if (blocker.status !== "blocked") return;
    const leave = window.confirm("You have unsaved changes. Leave this page?");
    if (leave) blocker.proceed();
    else blocker.reset();
  }, [blocker]);
}

/** Confirm before closing a modal with unsaved changes. */
export function discardChanges(dirty: boolean, close: () => void) {
  if (!dirty || window.confirm("Discard unsaved changes?")) close();
}
