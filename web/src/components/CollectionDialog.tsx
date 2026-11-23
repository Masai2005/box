import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button, Dialog, Input, Label, Select } from "@/components/ui";
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
  listRule?: string | null;
  viewRule?: string | null;
  createRule?: string | null;
  updateRule?: string | null;
  deleteRule?: string | null;
};

const SYSTEM_FIELDS = new Set(["id", "created", "updated"]);
const FIELD_TYPES = [
  "text",
  "number",
  "bool",
  "email",
  "url",
  "editor",
  "date",
  "autodate",
  "select",
  "json",
  "file",
  "relation",
  "password",
];

const RULES = [
  ["listRule", "List rule"],
  ["viewRule", "View rule"],
  ["createRule", "Create rule"],
  ["updateRule", "Update rule"],
  ["deleteRule", "Delete rule"],
] as const;

export function CollectionDialog({
  open,
  onClose,
  collection,
  collections,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  collection: Collection | null;
  collections: Collection[];
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState("base");
  const [fields, setFields] = useState<Field[]>([]);
  const [rules, setRules] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(collection?.name || "");
    setType(collection?.type || "base");
    setFields(
      (collection?.fields || [])
        .filter((field) => !SYSTEM_FIELDS.has(field.name) && !field.system)
        .map((field) => ({
          ...field,
          values: field.values || [],
          maxSelect: field.maxSelect || 1,
        })),
    );
    const nextRules: Record<string, string> = {};
    for (const [key] of RULES) {
      const value = (collection as any)?.[key];
      nextRules[key] = value === null || value === undefined ? "" : String(value);
    }
    setRules(nextRules);
  }, [open, collection]);

  const isEdit = Boolean(collection?.id);

  function updateField(index: number, patch: Partial<Field>) {
    setFields((current) =>
      current.map((field, fieldIndex) => (fieldIndex === index ? { ...field, ...patch } : field)),
    );
  }

  function removeField(index: number) {
    setFields((current) => current.filter((_, fieldIndex) => fieldIndex !== index));
  }

  function addField() {
    setFields((current) => [
      ...current,
      { name: "", type: "text", required: false, values: [], maxSelect: 1 },
    ]);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (!name.trim()) {
      toast.error("Collection name is required.");
      return;
    }
    for (const field of fields) {
      if (!field.name.trim()) {
        toast.error("Every field needs a name.");
        return;
      }
    }

    const userFields = fields.map((field) => {
      const next: Json = {
        name: field.name.trim(),
        type: field.type,
        required: Boolean(field.required),
      };
      if (field.id) next.id = field.id;
      if (field.type === "select") {
        next.values = (field.values || []).filter(Boolean);
        next.maxSelect = Math.max(1, Number(field.maxSelect) || 1);
      }
      if (field.type === "file") {
        next.maxSelect = Math.max(1, Number(field.maxSelect) || 1);
        next.protected = Boolean(field.protected);
      }
      if (field.type === "relation") {
        next.collectionId = field.collectionId || "";
        next.maxSelect = Math.max(1, Number(field.maxSelect) || 1);
      }
      return next;
    });

    const systemFields = isEdit
      ? (collection?.fields || []).filter((field) => SYSTEM_FIELDS.has(field.name) || field.system)
      : [];

    const payload: Json = {
      name: name.trim(),
      type,
      fields: [...systemFields, ...userFields],
    };
    for (const [key] of RULES) {
      payload[key] = rules[key]?.trim() ? rules[key].trim() : null;
    }

    setBusy(true);
    try {
      if (isEdit) {
        await pb.collections.update(collection!.id, payload);
        toast.success("Collection updated.");
      } else {
        await pb.collections.create(payload);
        toast.success("Collection created.");
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
      title={isEdit ? `Edit ${collection?.name}` : "New collection"}
      description={isEdit ? "Schema and API rules" : "Create a collection and its fields"}
      className="max-w-4xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="collection-form" disabled={busy}>
            {busy ? "Saving…" : isEdit ? "Save collection" : "Create collection"}
          </Button>
        </>
      }
    >
      <form id="collection-form" onSubmit={submit} className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="collection-name">Name</Label>
            <Input
              id="collection-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="posts"
              required
            />
          </div>
          <div>
            <Label htmlFor="collection-type">Type</Label>
            <Select
              id="collection-type"
              value={type}
              onChange={(event) => setType(event.target.value)}
              disabled={isEdit}
            >
              <option value="base">Base</option>
              <option value="auth">Auth</option>
              <option value="view">View</option>
            </Select>
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-mono text-[10px] font-bold uppercase tracking-[0.14em]">
              Fields
            </h3>
            <Button variant="outline" size="sm" onClick={addField}>
              <Plus />
              Add field
            </Button>
          </div>

          <div className="space-y-2">
            {fields.map((field, index) => (
              <div
                key={field.id || index}
                className="grid gap-2 border border-border bg-background p-3 sm:grid-cols-[1.2fr_0.8fr_auto_auto]"
              >
                <Input
                  value={field.name}
                  onChange={(event) => updateField(index, { name: event.target.value })}
                  placeholder="field name"
                />
                <Select
                  value={field.type}
                  onChange={(event) => updateField(index, { type: event.target.value })}
                >
                  {FIELD_TYPES.map((fieldType) => (
                    <option key={fieldType} value={fieldType}>
                      {fieldType}
                    </option>
                  ))}
                </Select>
                <label className="flex items-center gap-2 px-2 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={Boolean(field.required)}
                    onChange={(event) => updateField(index, { required: event.target.checked })}
                    className="h-4 w-4 accent-[hsl(var(--accent))]"
                  />
                  Required
                </label>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeField(index)}
                  aria-label="Remove field"
                >
                  <Trash2 />
                </Button>

                {field.type === "select" ? (
                  <div className="sm:col-span-4">
                    <Label>Options (comma separated)</Label>
                    <Input
                      value={(field.values || []).join(", ")}
                      onChange={(event) =>
                        updateField(index, {
                          values: event.target.value
                            .split(",")
                            .map((value) => value.trim())
                            .filter(Boolean),
                        })
                      }
                      placeholder="draft, published, archived"
                    />
                  </div>
                ) : null}

                {field.type === "file" ? (
                  <div className="grid gap-2 sm:col-span-4 sm:grid-cols-2">
                    <div>
                      <Label>Max files</Label>
                      <Input
                        type="number"
                        min={1}
                        value={field.maxSelect || 1}
                        onChange={(event) =>
                          updateField(index, { maxSelect: Number(event.target.value) })
                        }
                      />
                    </div>
                    <label className="flex items-end gap-2 pb-2 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={Boolean(field.protected)}
                        onChange={(event) =>
                          updateField(index, { protected: event.target.checked })
                        }
                        className="h-4 w-4 accent-[hsl(var(--accent))]"
                      />
                      Protected downloads
                    </label>
                  </div>
                ) : null}

                {field.type === "relation" ? (
                  <div className="grid gap-2 sm:col-span-4 sm:grid-cols-2">
                    <div>
                      <Label>Related collection</Label>
                      <Select
                        value={field.collectionId || ""}
                        onChange={(event) =>
                          updateField(index, { collectionId: event.target.value })
                        }
                      >
                        <option value="">—</option>
                        {collections
                          .filter((item) => item.type !== "view")
                          .map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name}
                            </option>
                          ))}
                      </Select>
                    </div>
                    <div>
                      <Label>Max records</Label>
                      <Input
                        type="number"
                        min={1}
                        value={field.maxSelect || 1}
                        onChange={(event) =>
                          updateField(index, { maxSelect: Number(event.target.value) })
                        }
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
            {fields.length === 0 ? (
              <p className="border border-dashed border-border px-4 py-6 text-center text-xs text-muted-foreground">
                No custom fields yet.
              </p>
            ) : null}
          </div>
        </div>

        <div>
          <h3 className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em]">
            API rules
          </h3>
          <p className="mb-3 text-xs text-muted-foreground">
            Empty means superuser-only (locked). Superuser access always works.
          </p>
          <div className="grid gap-3">
            {RULES.map(([key, label]) => (
              <div key={key}>
                <Label htmlFor={key}>{label}</Label>
                <Input
                  id={key}
                  value={rules[key] || ""}
                  onChange={(event) =>
                    setRules((current) => ({ ...current, [key]: event.target.value }))
                  }
                  placeholder="@request.auth.id != ''"
                />
              </div>
            ))}
          </div>
        </div>
      </form>
    </Dialog>
  );
}
