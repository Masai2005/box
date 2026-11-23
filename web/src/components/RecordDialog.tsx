import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button, Dialog, Input, Label, Select, Textarea } from "@/components/ui";
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
}: {
  open: boolean;
  onClose: () => void;
  collection: Collection | null;
  record: Json | null;
  onSaved: () => void;
}) {
  const editableFields = useMemo(() => {
    const fields = (collection?.fields || []).filter(
      (field) =>
        !SYSTEM_FIELDS.has(field.name) &&
        !field.hidden &&
        field.type !== "autodate" &&
        field.type !== "password",
    );

    // Auth collections keep password outside the regular field list; add it explicitly.
    if (collection?.type === "auth") {
      fields.push({ name: "password", type: "password", required: !record });
      fields.push({ name: "passwordConfirm", type: "password", required: !record });
    }

    return fields;
  }, [collection, record]);

  const [form, setForm] = useState<Record<string, any>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !collection) return;
    const next: Record<string, any> = {};
    for (const field of editableFields) {
      next[field.name] = initialValue(field, record);
    }
    setForm(next);
  }, [open, collection, record, editableFields]);

  if (!collection) return null;

  const isEdit = Boolean(record?.id);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !collection) return;
    setBusy(true);
    try {
      const hasFiles = editableFields.some((field) => field.type === "file");
      let payload: any = {};

      if (hasFiles) {
        const formData = new FormData();
        for (const field of editableFields) {
          const value = form[field.name];
          if (field.type === "file") {
            for (const file of value || []) formData.append(field.name, file);
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
          } else if (field.type === "date") {
            payload[field.name] = value ? new Date(value).toISOString() : "";
          } else if (field.type === "number") {
            payload[field.name] = value === "" ? 0 : Number(value);
          } else if (field.type === "relation") {
            payload[field.name] = String(value || "")
              .split(",")
              .map((item) => item.trim())
              .filter(Boolean);
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

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`${isEdit ? "Edit" : "New"} ${collection.name} record`}
      description={isEdit ? record?.id : "Create a new record"}
      className="max-w-3xl"
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
            onChange={(value) => setForm((current) => ({ ...current, [field.name]: value }))}
          />
        ))}
        {editableFields.length === 0 ? (
          <p className="col-span-2 text-xs text-muted-foreground">
            This collection has no editable fields.
          </p>
        ) : null}
      </form>
    </Dialog>
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
    for (const item of String(value || "")
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)) {
      formData.append(field.name, item);
    }
    return;
  }
  if (field.type === "password" && !value) return;
  formData.append(field.name, value ?? "");
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: Field;
  value: any;
  onChange: (value: any) => void;
}) {
  const label = (
    <Label htmlFor={field.name}>
      {field.name}
      {field.required ? <span className="ml-1 text-accent">*</span> : null}
      <span className="ml-2 normal-case tracking-normal text-muted-foreground/70">{field.type}</span>
    </Label>
  );

  const wide = ["editor", "json", "file"].includes(field.type);

  if (field.type === "bool") {
    return (
      <div className="flex items-end pb-3">
        <label className="flex cursor-pointer items-center gap-2 font-mono text-xs">
          <input
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
      <div className={wide ? "sm:col-span-2" : ""}>
        {label}
        <Select
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
      </div>
    );
  }

  if (field.type === "json") {
    return (
      <div className="sm:col-span-2">
        {label}
        <Textarea
          rows={5}
          className="font-mono"
          value={value || ""}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
    );
  }

  if (field.type === "file") {
    return (
      <div className="sm:col-span-2">
        {label}
        <Input
          type="file"
          multiple={(field.maxSelect || 1) > 1}
          onChange={(event) => onChange(Array.from(event.target.files || []))}
        />
        {(value || []).length ? (
          <p className="mt-1 text-[10px] text-muted-foreground">
            {Array.from(value as File[]).map((file) => file.name).join(", ")}
          </p>
        ) : null}
      </div>
    );
  }

  if (field.type === "editor") {
    return (
      <div className="sm:col-span-2">
        {label}
        <Textarea
          rows={8}
          value={value || ""}
          onChange={(event) => onChange(event.target.value)}
          placeholder="HTML content"
        />
      </div>
    );
  }

  if (field.type === "date") {
    return (
      <div>
        {label}
        <Input type="datetime-local" value={value || ""} onChange={(event) => onChange(event.target.value)} />
      </div>
    );
  }

  if (field.type === "number") {
    return (
      <div>
        {label}
        <Input type="number" value={value ?? ""} onChange={(event) => onChange(event.target.value)} />
      </div>
    );
  }

  if (field.type === "relation") {
    return (
      <div>
        {label}
        <Input
          value={Array.isArray(value) ? value.join(",") : value || ""}
          onChange={(event) => onChange(event.target.value)}
          placeholder="record id(s), comma separated"
        />
      </div>
    );
  }

  return (
    <div>
      {label}
      <Input
        type={field.type === "password" ? "password" : field.type === "email" ? "email" : field.type === "url" ? "url" : "text"}
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
