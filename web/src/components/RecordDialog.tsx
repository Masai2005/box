import { useEffect, useMemo, useRef, useState } from "react";
import { Braces, File as FileIcon, Plus, Terminal, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import { Button, Input, Label, Select, Sheet, Textarea } from "@/components/ui";
import { pb, errorMessage, type Json } from "@/lib/pb";
import { discardChanges } from "@/lib/useUnsavedChanges";
import { localTimeZone, toLocalDateTime } from "@/lib/date";

type Field = {
  id?: string;
  name: string;
  type: string;
  required?: boolean;
  system?: boolean;
  hidden?: boolean;
  values?: string[];
  maxSelect?: number;
  collectionId?: string;
  protected?: boolean;
  options?: Json;
};

type Collection = {
  id: string;
  name: string;
  type: string;
  fields: Field[];
};

const SYSTEM_FIELDS = new Set(["id", "created", "updated", "collectionId", "collectionName", "expand"]);

function initialValue(field: Field, record: Json | null) {
  const value = record?.[field.name];
  if (field.type === "bool") return Boolean(value);
  if (field.type === "number") return value ?? "";
  if (field.type === "json") return JSON.stringify(value ?? {}, null, 2);
  if (field.type === "select" && (field.maxSelect || 0) > 1) return Array.isArray(value) ? value : [];
  if (field.type === "relation") return Array.isArray(value) ? value : value ? [value] : [];
  if (field.type === "date") return toLocalDateTime(value);
  if (field.type === "file") return [];
  return value ?? "";
}

export function RecordDialog({
  open,
  onClose,
  collection,
  record,
  onSaved,
  onRefresh,
  collections = [],
}: {
  open: boolean;
  onClose: () => void;
  collection: Collection | null;
  record: Json | null;
  onSaved: () => void;
  onRefresh?: () => void;
  collections?: Collection[];
}) {
  const editableFields = useMemo(() => {
    const fields = (collection?.fields || []).filter(
      (field) =>
        !SYSTEM_FIELDS.has(field.name) &&
        !field.hidden &&
        field.type !== "autodate" &&
        field.type !== "password",
    );

    if (collection?.type === "auth") {
      fields.push({ name: "password", type: "password", required: !record });
      fields.push({ name: "passwordConfirm", type: "password", required: !record });
    }

    return fields;
  }, [collection, record]);

  const [form, setForm] = useState<Record<string, any>>({});
  const [removedFiles, setRemovedFiles] = useState<Record<string, string[]>>({});
  const [fileOrder, setFileOrder] = useState<Record<string, string[]>>({});
  const [fileToken, setFileToken] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [baseline, setBaseline] = useState("");
  const [impersonation, setImpersonation] = useState<{ token: string; record?: any } | null>(null);
  const [autosave, setAutosave] = useState(() => localStorage.getItem("ekilie-box-record-autosave") === "true");

  useEffect(() => {
    if (!open || !collection) return;
    const next: Record<string, any> = {};
    for (const field of editableFields) {
      next[field.name] = initialValue(field, record);
    }
    const order: Record<string, string[]> = {};
    for (const field of editableFields) {
      if (field.type !== "file") continue;
      const existing = record?.[field.name];
      order[field.name] = Array.isArray(existing) ? [...existing] : existing ? [existing] : [];
    }
    setForm(next);
    setRemovedFiles({});
    setFileOrder(order);
    setErrors({});
    setImpersonation(null);
    setBaseline(snapshotForm(next, {}, order));
    if (record && editableFields.some((field) => field.type === "file")) {
      pb.files
        .getToken()
        .then(setFileToken)
        .catch(() => setFileToken(""));
    } else {
      setFileToken("");
    }
  }, [open, collection, record, editableFields]);

  const dirty =
    open &&
    baseline !== "" &&
    baseline !== snapshotForm(form, removedFiles, fileOrder);

  const saveRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    localStorage.setItem("ekilie-box-record-autosave", String(autosave));
  }, [autosave]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "s" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        void saveRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const isEdit = Boolean(record?.id);

  useEffect(() => {
    if (!open || !autosave || !isEdit || !dirty || busy) return;
    const timer = setTimeout(() => {
      void save({ keepOpen: true, silent: true });
    }, 1500);
    return () => clearTimeout(timer);
  }, [open, autosave, isEdit, dirty, busy, form, removedFiles, fileOrder]);

  function close() {
    discardChanges(dirty, onClose);
  }

  if (!collection) return null;

  function validate() {
    const next: Record<string, string> = {};
    for (const field of editableFields) {
      if (!field.required || field.type === "bool") continue;
      const value = form[field.name];
      if (field.type === "file") {
        const existing = record?.[field.name];
        const existingNames = Array.isArray(existing) ? existing : existing ? [existing] : [];
        const kept = existingNames.filter((name) => !(removedFiles[field.name] || []).includes(name));
        if (!(value || []).length && !kept.length) {
          next[field.name] = "Required";
        } else if ((value || []).length + kept.length > (field.maxSelect || 1)) {
          next[field.name] = `Maximum ${field.maxSelect || 1} file(s)`;
        }
        continue;
      }
      if (field.type === "relation") {
        if (!value || (Array.isArray(value) && !value.length)) next[field.name] = "Required";
        continue;
      }
      if (value === "" || value === null || value === undefined) {
        next[field.name] = "Required";
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function jsonPayload() {
    const payload: Record<string, any> = {};
    for (const field of editableFields) {
      if (field.type === "file") continue;
      const value = form[field.name];
      if (field.type === "json") {
        try {
          payload[field.name] = value ? JSON.parse(value) : null;
        } catch {
          throw new Error(`${field.name}: invalid JSON`);
        }
      } else if (field.type === "select" && (field.maxSelect || 0) > 1) {
        payload[field.name] = value || [];
      } else if (field.type === "relation") {
        payload[field.name] = Array.isArray(value) ? value : [];
      } else if (field.type === "date") {
        payload[field.name] = value ? new Date(value).toISOString() : "";
      } else if (field.type === "number") {
        payload[field.name] = value === "" ? 0 : Number(value);
      } else if (field.type === "password") {
        if (value) payload[field.name] = value;
      } else {
        payload[field.name] = value;
      }
    }
    return payload;
  }

  async function save(options?: { keepOpen?: boolean; silent?: boolean }) {
    if (busy || !collection) return;
    if (!validate()) {
      if (!options?.silent) toast.error("Fill the required fields.");
      return;
    }
    setBusy(true);
    const savedSnapshot = snapshotForm(form, removedFiles, fileOrder);
    try {
      const hasFileFields = editableFields.some((field) => field.type === "file");
      let payload: any = jsonPayload();

      if (hasFileFields) {
        const formData = new FormData();
        for (const field of editableFields) {
          const value = form[field.name];
          if (field.type === "file") {
            for (const name of removedFiles[field.name] || []) {
              formData.append(`${field.name}-`, name);
            }
            const kept = (fileOrder[field.name] || []).filter(
              (name) => !(removedFiles[field.name] || []).includes(name),
            );
            const newFiles = Array.from((value || []) as File[]);
            if ((field.maxSelect || 1) === 1 && newFiles.length && kept.length) {
              // Selecting a new file in a single-file field replaces the current one.
              for (const name of kept) formData.append(`${field.name}-`, name);
            } else {
              for (const name of kept) formData.append(field.name, name);
            }
            for (const file of newFiles) {
              formData.append(isEdit ? `+${field.name}` : field.name, file);
            }
            continue;
          }
          appendValue(formData, field, value);
        }
        payload = formData;
      }

      if (isEdit) {
        await pb.collection(collection.name).update(record!.id, payload);
        if (!options?.silent) toast.success("Record updated.");
      } else {
        await pb.collection(collection.name).create(payload);
        if (!options?.silent) toast.success("Record created.");
      }
      if (options?.keepOpen) {
        setBaseline(savedSnapshot);
        onRefresh?.();
        return;
      }
      onSaved();
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  saveRef.current = () => save();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    void save();
  }

  async function impersonate() {
    if (!collection || !record?.id) return;
    try {
      const result = await pb.send(
        `/api/collections/${encodeURIComponent(collection.name)}/impersonate/${record.id}`,
        { method: "POST" },
      );
      setImpersonation(result as { token: string; record?: any });
      toast.success("Impersonation token created.");
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  async function copy(kind: "curl" | "js") {
    if (!collection) return;
    let payload: Record<string, any>;
    try {
      payload = jsonPayload();
    } catch (err) {
      toast.error(errorMessage(err));
      return;
    }
    if (editableFields.some((field) => field.type === "file")) {
      toast.message("File fields are omitted from copied requests.");
    }
    const url = `${window.location.origin}/api/collections/${collection.name}/records${isEdit ? `/${record!.id}` : ""}`;
    const method = isEdit ? "PATCH" : "POST";
    const body = JSON.stringify(payload, null, 2);
    const text =
      kind === "curl"
        ? `curl -X ${method} '${url}' \\\n  -H 'Authorization: <token>' \\\n  -H 'Content-Type: application/json' \\\n  -d '${body.replaceAll("'", "'\\''")}'`
        : `await pb.collection(${JSON.stringify(collection.name)}).${isEdit ? `update(${JSON.stringify(record!.id)}, ` : "create("}${body});`;
    try {
      await navigator.clipboard.writeText(text);
      toast.success(kind === "curl" ? "cURL copied." : "JavaScript copied.");
    } catch {
      toast.error("Could not copy to the clipboard.");
    }
  }

  function removeExistingFile(field: Field, name: string) {
    setRemovedFiles((current) => ({
      ...current,
      [field.name]: [...(current[field.name] || []), name],
    }));
  }

  return (
    <Sheet
      open={open}
      onClose={close}
      title={`${isEdit ? "Edit" : "New"} ${collection.name} record`}
      description={isEdit ? record?.id : "Create a new record"}
      footer={
        <>
          <Button variant="ghost" size="icon" onClick={() => copy("curl")} aria-label="Copy record as cURL" title="Copy as cURL">
            <Terminal />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => copy("js")} aria-label="Copy record as JavaScript" title="Copy as JavaScript">
            <Braces />
          </Button>
          {isEdit && collection.type === "auth" ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={impersonate}
              aria-label="Impersonate auth record"
              title="Impersonate auth record"
            >
              <UserRound />
            </Button>
          ) : null}
          <Button variant="outline" onClick={close} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="record-form" disabled={busy}>
            {busy ? "Saving…" : isEdit ? "Save changes" : "Create record"}
          </Button>
        </>
      }
    >
      <form id="record-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        {isEdit ? (
          <label className="sm:col-span-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
            <input
              type="checkbox"
              checked={autosave}
              onChange={(event) => setAutosave(event.target.checked)}
              className="h-4 w-4 accent-[hsl(var(--accent))]"
            />
            Autosave changes after 1.5 seconds
          </label>
        ) : null}
        {impersonation ? (
          <div className="sm:col-span-2 border border-amber-500/30 bg-amber-500/10 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-amber-700 dark:text-amber-400">
                Impersonation token
              </p>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(impersonation.token);
                    toast.success("Token copied.");
                  }}
                >
                  Copy
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setImpersonation(null)} aria-label="Hide impersonation token">
                  <X />
                </Button>
              </div>
            </div>
            <p className="mt-2 break-all font-mono text-[10px]">{impersonation.token}</p>
          </div>
        ) : null}
        {editableFields.map((field) => (
          <FieldInput
            key={field.id || field.name}
            field={field}
            value={form[field.name]}
            error={errors[field.name]}
            record={record}
            fileToken={fileToken}
            removedFiles={removedFiles[field.name] || []}
            fileOrder={fileOrder[field.name] || []}
            collections={collections}
            onRemoveFile={(name) => removeExistingFile(field, name)}
            onReorder={(names) => setFileOrder((current) => ({ ...current, [field.name]: names }))}
            onChange={(value) => {
              setForm((current) => ({ ...current, [field.name]: value }));
              setErrors((current) => ({ ...current, [field.name]: "" }));
            }}
          />
        ))}
        {editableFields.length === 0 ? (
          <p className="col-span-2 text-xs text-muted-foreground">
            This collection has no editable fields.
          </p>
        ) : null}
      </form>
    </Sheet>
  );
}

function JsonInput({
  field,
  value,
  onChange,
}: {
  field: Field;
  value: string;
  onChange: (value: string) => void;
}) {
  const [error, setError] = useState("");

  function check(next: string) {
    if (!next.trim()) {
      setError("");
      return;
    }
    try {
      JSON.parse(next);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid JSON");
    }
  }

  return (
    <>
      <Textarea
        id={field.name}
        name={field.name}
        rows={5}
        className="font-mono"
        value={value || ""}
        onChange={(event) => {
          onChange(event.target.value);
          check(event.target.value);
        }}
      />
      <div className="mt-1 flex items-center justify-between gap-2">
        <p className={`text-[10px] ${error ? "text-destructive" : "text-muted-foreground"}`}>
          {error || "Valid JSON"}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            try {
              const formatted = JSON.stringify(JSON.parse(value || "null"), null, 2);
              onChange(formatted);
              setError("");
            } catch {
              setError("Cannot format invalid JSON");
            }
          }}
        >
          Format
        </Button>
      </div>
    </>
  );
}

function HtmlEditor({
  field,
  value,
  onChange,
}: {
  field: Field;
  value: string;
  onChange: (value: string) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  function wrap(before: string, after: string) {
    const element = ref.current;
    if (!element) return;
    const start = element.selectionStart;
    const end = element.selectionEnd;
    const next = `${value.slice(0, start)}${before}${value.slice(start, end)}${after}${value.slice(end)}`;
    onChange(next);
    requestAnimationFrame(() => {
      element.focus();
      element.setSelectionRange(start + before.length, end + before.length);
    });
  }

  return (
    <div>
      <div className="mb-1 flex flex-wrap gap-1">
        {[
          ["Bold", "<strong>", "</strong>"],
          ["Italic", "<em>", "</em>"],
          ["Code", "<code>", "</code>"],
          ["Link", '<a href="">', "</a>"],
        ].map(([label, before, after]) => (
          <Button key={label} variant="outline" size="sm" onClick={() => wrap(before, after)}>
            {label}
          </Button>
        ))}
      </div>
      <Textarea
        ref={ref}
        id={field.name}
        name={field.name}
        rows={10}
        className="font-mono"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="<p>HTML content</p>"
      />
    </div>
  );
}

function snapshotForm(
  form: Record<string, any>,
  removedFiles: Record<string, string[]>,
  fileOrder: Record<string, string[]> = {},
) {
  const values: Record<string, any> = {};
  for (const [key, value] of Object.entries(form)) {
    if (Array.isArray(value) && value.every((item) => item instanceof File)) {
      values[key] = value.map((file: File) => `${file.name}:${file.size}:${file.lastModified}`);
    } else {
      values[key] = value;
    }
  }
  return JSON.stringify({ values, removedFiles, fileOrder });
}

function appendValue(formData: FormData, field: Field, value: any) {
  if (field.type === "bool") {
    formData.append(field.name, value ? "true" : "false");
    return;
  }
  if (field.type === "json") {
    formData.append(field.name, value || "null");
    return;
  }
  if (field.type === "date") {
    formData.append(field.name, value ? new Date(value).toISOString() : "");
    return;
  }
  if (field.type === "select" && (field.maxSelect || 0) > 1) {
    for (const item of value || []) formData.append(field.name, item);
    return;
  }
  if (field.type === "relation") {
    for (const item of Array.isArray(value) ? value : []) formData.append(field.name, item);
    return;
  }
  if (field.type === "password" && !value) return;
  formData.append(field.name, value ?? "");
}

function FieldInput({
  field,
  value,
  error,
  record,
  fileToken,
  removedFiles,
  fileOrder,
  collections,
  onChange,
  onRemoveFile,
  onReorder,
}: {
  field: Field;
  value: any;
  error?: string;
  record: Json | null;
  fileToken: string;
  removedFiles: string[];
  fileOrder: string[];
  collections: Collection[];
  onChange: (value: any) => void;
  onRemoveFile: (name: string) => void;
  onReorder: (names: string[]) => void;
}) {
  const label = (
    <Label htmlFor={field.name}>
      {field.name}
      {field.required ? <span className="ml-1 text-accent">*</span> : null}
      <span className="ml-2 normal-case tracking-normal text-muted-foreground/70">{field.type}</span>
    </Label>
  );

  const helper = error ? <p className="mt-1 text-[10px] text-destructive">{error}</p> : null;

  if (field.type === "bool") {
    return (
      <div className="flex items-end pb-3">
        <label className="flex cursor-pointer items-center gap-2 font-mono text-xs">
          <input
            id={field.name}
            name={field.name}
            type="checkbox"
            checked={Boolean(value)}
            onChange={(event) => onChange(event.target.checked)}
            className="h-4 w-4 accent-[hsl(var(--accent))]"
          />
          {field.name}
        </label>
      </div>
    );
  }

  if (field.type === "select") {
    const multiple = (field.maxSelect || 0) > 1;
    return (
      <div className={multiple ? "sm:col-span-2" : ""}>
        {label}
        <Select
          id={field.name}
          name={field.name}
          multiple={multiple}
          value={multiple ? value || [] : value || ""}
          onChange={(event) => {
            if (multiple) {
              onChange(Array.from(event.target.selectedOptions).map((option) => option.value));
            } else {
              onChange(event.target.value);
            }
          }}
        >
          {!multiple ? <option value="">None</option> : null}
          {(field.values || []).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </Select>
        {multiple ? <p className="mt-1 text-[10px] text-muted-foreground">Ctrl/Cmd-click for multiple.</p> : null}
        {helper}
      </div>
    );
  }

  if (field.type === "json") {
    return (
      <div className="sm:col-span-2">
        {label}
        <JsonInput field={field} value={value} onChange={onChange} />
        {helper}
      </div>
    );
  }

  if (field.type === "file") {
    const existing = record?.[field.name];
    const existingNames = fileOrder.length
      ? fileOrder
      : Array.isArray(existing)
        ? existing
        : existing
          ? [existing]
          : [];
    const kept = existingNames.filter((name) => !removedFiles.includes(name));
    return (
      <div className="sm:col-span-2">
        {label}
        {kept.length ? (
          <div className="mb-2 flex flex-wrap gap-2">
            {kept.map((name) => {
              const url = pb.files.getURL(record as any, name, fileToken ? { token: fileToken } : {});
              return (
                <div key={name} className="flex items-center gap-2 border border-border bg-background p-1.5">
                  <FilePreview url={url} name={name} />
                  <span className="max-w-[180px] truncate font-mono text-[10px]">{name}</span>
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      disabled={kept.indexOf(name) === 0}
                      onClick={() => {
                        const index = kept.indexOf(name);
                        if (index <= 0) return;
                        const next = [...kept];
                        [next[index - 1], next[index]] = [next[index], next[index - 1]];
                        onReorder([...next, ...removedFiles]);
                      }}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                      aria-label={`Move ${name} up`}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      disabled={kept.indexOf(name) === kept.length - 1}
                      onClick={() => {
                        const index = kept.indexOf(name);
                        if (index < 0 || index >= kept.length - 1) return;
                        const next = [...kept];
                        [next[index], next[index + 1]] = [next[index + 1], next[index]];
                        onReorder([...next, ...removedFiles]);
                      }}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                      aria-label={`Move ${name} down`}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemoveFile(name)}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label={`Remove ${name}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
        <Input
          id={field.name}
          name={field.name}
          type="file"
          multiple={(field.maxSelect || 1) > 1}
          onChange={(event) => onChange(Array.from(event.target.files || []))}
        />
        {(field.maxSelect || 1) === 1 && kept.length ? (
          <p className="mt-1 text-[10px] text-muted-foreground">
            Selecting a new file replaces the current file.
          </p>
        ) : null}
        {(value || []).length ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {Array.from(value as File[]).map((file) => (
              <span key={file.name} className="flex items-center gap-1 border border-border px-2 py-1 font-mono text-[10px]">
                <FileIcon className="h-3 w-3" />
                {file.name}
              </span>
            ))}
          </div>
        ) : null}
        {helper}
      </div>
    );
  }

  if (field.type === "editor") {
    return (
      <div className="sm:col-span-2">
        {label}
        <HtmlEditor field={field} value={value || ""} onChange={onChange} />
        {helper}
      </div>
    );
  }

  if (field.type === "date") {
    return (
      <div>
        {label}
        <Input
          id={field.name}
          name={field.name}
          type="datetime-local"
          value={value || ""}
          onChange={(event) => onChange(event.target.value)}
        />
        <p className="mt-1 text-[10px] text-muted-foreground">
          {localTimeZone()}
        </p>
        {helper}
      </div>
    );
  }

  if (field.type === "number") {
    return (
      <div>
        {label}
        <Input
          id={field.name}
          name={field.name}
          type="number"
          required={field.required}
          value={value ?? ""}
          onChange={(event) => onChange(event.target.value)}
        />
        {helper}
      </div>
    );
  }

  if (field.type === "relation") {
    const target = collections.find((item) => item.id === field.collectionId);
    if (target) {
      return (
        <div className="sm:col-span-2">
          {label}
          <RelationPicker
            field={field}
            target={target}
            value={Array.isArray(value) ? value : value ? [value] : []}
            onChange={onChange}
          />
          {helper}
        </div>
      );
    }
    return (
      <div>
        {label}
        <Input
          id={field.name}
          name={field.name}
          value={Array.isArray(value) ? value.join(",") : value || ""}
          onChange={(event) => onChange(event.target.value.split(",").map((item) => item.trim()).filter(Boolean))}
          placeholder="record id(s)"
        />
        {helper}
      </div>
    );
  }

  return (
    <div>
      {label}
      <Input
        id={field.name}
        name={field.name}
        type={field.type === "password" ? "password" : field.type === "email" ? "email" : field.type === "url" ? "url" : "text"}
        required={field.required}
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value)}
      />
      {helper}
    </div>
  );
}

function FilePreview({ url, name }: { url: string; name: string }) {
  const [failed, setFailed] = useState(false);
  if (failed || !/\.(png|jpe?g|gif|webp|svg)$/i.test(name)) {
    return <FileIcon className="h-8 w-8 text-muted-foreground" />;
  }
  return (
    <img
      src={url}
      alt={name}
      className="h-8 w-8 object-cover"
      onError={() => setFailed(true)}
    />
  );
}

function RelationPicker({
  field,
  target,
  value,
  onChange,
}: {
  field: Field;
  target: Collection;
  value: string[];
  onChange: (value: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<Record<string, any>>({});
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState("");

  const selectionKey = value.join(",");

  useEffect(() => {
    if (!selectionKey) return;
    let cancelled = false;
    Promise.all(
      value.map((id) =>
        pb.collection(target.name).getOne(id).catch(() => null),
      ),
    ).then((items) => {
      if (cancelled) return;
      const found = items.filter(Boolean) as any[];
      if (!found.length) return;
      setOptions((current) => {
        const next = new Map(current.map((item) => [item.id, item]));
        for (const item of found) next.set(item.id, item);
        return Array.from(next.values());
      });
    });
    return () => {
      cancelled = true;
    };
  }, [selectionKey, target.name]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    pb.collection(target.name)
      .getList(1, 50, { sort: "-created" })
      .then((result) => {
        setOptions((current) => {
          const next = new Map(result.items.map((item: any) => [item.id, item]));
          for (const item of current) next.set(item.id, item);
          return Array.from(next.values());
        });
      })
      .catch(() => setOptions([]))
      .finally(() => setLoading(false));
  }, [open, target.name]);

  const labelField =
    target.fields.find((item) => ["title", "name", "email", "slug", "label"].includes(item.name))?.name || "id";

  const label = (id: string) => {
    const option = options.find((item) => item.id === id);
    return option?.[labelField] || id;
  };

  const filtered = query
    ? options.filter((option) =>
        JSON.stringify(option).toLowerCase().includes(query.toLowerCase()),
      )
    : options;

  function toggle(id: string) {
    const multiple = (field.maxSelect || 1) > 1;
    if (!multiple) {
      onChange([id]);
      setOpen(false);
      setQuery("");
      return;
    }
    if (value.includes(id)) {
      onChange(value.filter((item) => item !== id));
    } else if (value.length < (field.maxSelect || 1)) {
      onChange([...value, id]);
    }
  }

  return (
    <div className="relative">
      <div className="flex min-h-10 flex-wrap items-center gap-1.5 border border-input bg-background px-2 py-1.5">
        {value.map((id) => (
          <span key={id} className="flex items-center gap-1 border border-border bg-muted/40 px-1.5 py-0.5 font-mono text-[10px]">
            <span className="max-w-[180px] truncate">{label(id)}</span>
            <button
              type="button"
              onClick={() => onChange(value.filter((item) => item !== id))}
              aria-label="Remove relation"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          id={field.name}
          name={field.name}
          value={query}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            if (!creating) setTimeout(() => setOpen(false), 160);
          }}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          placeholder={value.length ? "" : "Search related records…"}
          className="min-w-[120px] flex-1 bg-transparent font-mono text-xs outline-none"
        />
      </div>
      {open ? (
        <div className="absolute z-30 mt-1 max-h-56 w-full overflow-y-auto border border-border bg-card shadow-lg scrollbar-thin">
          {loading ? (
            <p className="p-3 text-xs text-muted-foreground">Loading…</p>
          ) : filtered.length ? (
            filtered.map((option) => (
              <button
                key={option.id}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => toggle(option.id)}
                className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left font-mono text-[10px] hover:bg-muted/50 ${
                  value.includes(option.id) ? "text-accent" : ""
                }`}
              >
                <span className="truncate">{option[labelField] || option.id}</span>
                <span className="text-muted-foreground">{option.id.slice(0, 8)}</span>
              </button>
            ))
          ) : (
            <p className="p-3 text-xs text-muted-foreground">No matches.</p>
          )}
          <div className="border-t border-border p-2">
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                setCreating((current) => !current);
                setCreateError("");
                setOpen(true);
              }}
            >
              <Plus />
              {creating ? "Cancel new record" : `New ${target.name}`}
            </Button>
            {creating ? (
              <div className="mt-2 space-y-2 border border-border p-2">
                {quickFields(target).map((quickField) => (
                  <div key={quickField.name}>
                    <Label htmlFor={`quick-${quickField.name}`}>
                      {quickField.name}
                      {quickField.required ? <span className="ml-1 text-accent">*</span> : null}
                    </Label>
                    {quickField.type === "bool" ? (
                      <input
                        id={`quick-${quickField.name}`}
                        type="checkbox"
                        checked={Boolean(draft[quickField.name])}
                        onChange={(event) =>
                          setDraft((current) => ({ ...current, [quickField.name]: event.target.checked }))
                        }
                        className="h-4 w-4 accent-[hsl(var(--accent))]"
                      />
                    ) : quickField.type === "select" ? (
                      <Select
                        id={`quick-${quickField.name}`}
                        value={draft[quickField.name] || ""}
                        onChange={(event) =>
                          setDraft((current) => ({ ...current, [quickField.name]: event.target.value }))
                        }
                      >
                        <option value="">Choose…</option>
                        {(quickField.values || []).map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </Select>
                    ) : (
                      <Input
                        id={`quick-${quickField.name}`}
                        type={quickField.type === "number" ? "number" : quickField.type === "email" ? "email" : "text"}
                        value={draft[quickField.name] ?? ""}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            [quickField.name]:
                              quickField.type === "number" ? Number(event.target.value) : event.target.value,
                          }))
                        }
                      />
                    )}
                  </div>
                ))}
                {!quickFields(target).length ? (
                  <p className="text-[10px] text-muted-foreground">
                    This collection has no simple fields. Open it to create a record.
                  </p>
                ) : null}
                {createError ? <p className="text-[10px] text-destructive">{createError}</p> : null}
                <Button
                  size="sm"
                  className="w-full"
                  disabled={createBusy || !quickFields(target).length}
                  onClick={async () => {
                    setCreateBusy(true);
                    setCreateError("");
                    try {
                      const payload: Record<string, any> = {};
                      for (const quickField of quickFields(target)) {
                        const value = draft[quickField.name];
                        if (quickField.required && (value === "" || value === undefined || value === null)) {
                          throw new Error(`${quickField.name} is required.`);
                        }
                        if (value !== undefined && value !== "") payload[quickField.name] = value;
                      }
                      const created = await pb.collection(target.name).create(payload);
                      setOptions((current) => [created, ...current]);
                      const multiple = (field.maxSelect || 1) > 1;
                      onChange(multiple ? [...value, created.id].slice(0, field.maxSelect || 1) : [created.id]);
                      setCreating(false);
                      setDraft({});
                      setQuery("");
                      setOpen(false);
                      toast.success(`${target.name} record created.`);
                    } catch (err) {
                      setCreateError(errorMessage(err));
                    } finally {
                      setCreateBusy(false);
                    }
                  }}
                >
                  {createBusy ? "Creating…" : "Create and select"}
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function quickFields(target: Collection): Field[] {
  return target.fields
    .filter(
      (field) =>
        !field.system &&
        !field.hidden &&
        !["autodate", "password", "file", "relation", "json", "editor"].includes(field.type),
    )
    .slice(0, 6);
}
