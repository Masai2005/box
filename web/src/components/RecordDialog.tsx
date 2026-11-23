import { useEffect, useMemo, useState } from "react";
import { File as FileIcon, X } from "lucide-react";
import { toast } from "sonner";
import { Button, Input, Label, Select, Sheet, Textarea } from "@/components/ui";
import { pb, errorMessage, type Json } from "@/lib/pb";

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
  if (field.type === "date") {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value).replace(" ", "T").slice(0, 16);
    return date.toISOString().slice(0, 16);
  }
  if (field.type === "file") return [];
  return value ?? "";
}

export function RecordDialog({
  open,
  onClose,
  collection,
  record,
  onSaved,
  collections = [],
}: {
  open: boolean;
  onClose: () => void;
  collection: Collection | null;
  record: Json | null;
  onSaved: () => void;
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
  const [fileToken, setFileToken] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !collection) return;
    const next: Record<string, any> = {};
    for (const field of editableFields) {
      next[field.name] = initialValue(field, record);
    }
    setForm(next);
    setRemovedFiles({});
    setErrors({});
    if (record && editableFields.some((field) => field.type === "file")) {
      pb.files
        .getToken()
        .then(setFileToken)
        .catch(() => setFileToken(""));
    } else {
      setFileToken("");
    }
  }, [open, collection, record, editableFields]);

  if (!collection) return null;

  const isEdit = Boolean(record?.id);

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

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !collection) return;
    if (!validate()) {
      toast.error("Fill the required fields.");
      return;
    }
    setBusy(true);
    try {
      const hasFileFields = editableFields.some((field) => field.type === "file");
      let payload: any = {};

      if (hasFileFields) {
        const formData = new FormData();
        for (const field of editableFields) {
          const value = form[field.name];
          if (field.type === "file") {
            for (const name of removedFiles[field.name] || []) {
              formData.append(`${field.name}-`, name);
            }
            for (const file of value || []) {
              formData.append(isEdit ? `+${field.name}` : field.name, file);
            }
            continue;
          }
          appendValue(formData, field, value);
        }
        payload = formData;
      } else {
        for (const field of editableFields) {
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
      }

      if (isEdit) {
        await pb.collection(collection.name).update(record!.id, payload);
        toast.success("Record updated.");
      } else {
        await pb.collection(collection.name).create(payload);
        toast.success("Record created.");
      }
      onSaved();
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
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
      onClose={onClose}
      title={`${isEdit ? "Edit" : "New"} ${collection.name} record`}
      description={isEdit ? record?.id : "Create a new record"}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="record-form" disabled={busy}>
            {busy ? "Saving…" : isEdit ? "Save changes" : "Create record"}
          </Button>
        </>
      }
    >
      <form id="record-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        {editableFields.map((field) => (
          <FieldInput
            key={field.id || field.name}
            field={field}
            value={form[field.name]}
            error={errors[field.name]}
            record={record}
            fileToken={fileToken}
            removedFiles={removedFiles[field.name] || []}
            collections={collections}
            onRemoveFile={(name) => removeExistingFile(field, name)}
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
  collections,
  onChange,
  onRemoveFile,
}: {
  field: Field;
  value: any;
  error?: string;
  record: Json | null;
  fileToken: string;
  removedFiles: string[];
  collections: Collection[];
  onChange: (value: any) => void;
  onRemoveFile: (name: string) => void;
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
          {!multiple ? <option value="">—</option> : null}
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
        <Textarea
          id={field.name}
          name={field.name}
          rows={5}
          className="font-mono"
          value={value || ""}
          onChange={(event) => onChange(event.target.value)}
        />
        {helper}
      </div>
    );
  }

  if (field.type === "file") {
    const existing = record?.[field.name];
    const existingNames = Array.isArray(existing) ? existing : existing ? [existing] : [];
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
                  <button
                    type="button"
                    onClick={() => onRemoveFile(name)}
                    className="text-muted-foreground hover:text-destructive"
                    aria-label={`Remove ${name}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
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
        <Textarea
          id={field.name}
          name={field.name}
          rows={8}
          value={value || ""}
          onChange={(event) => onChange(event.target.value)}
          placeholder="HTML content"
        />
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

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    pb.collection(target.name)
      .getList(1, 50, { sort: "-created" })
      .then((result) => setOptions(result.items))
      .catch(() => setOptions([]))
      .finally(() => setLoading(false));
  }, [open, target.name]);

  const labelField =
    target.fields.find((item) => ["name", "title", "email"].includes(item.name))?.name || "id";

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
          onBlur={() => setTimeout(() => setOpen(false), 160)}
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
        </div>
      ) : null}
    </div>
  );
}
