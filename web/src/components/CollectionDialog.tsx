import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button, Sheet, Input, Label, Select, Tabs, Textarea } from "@/components/ui";
import { pb, errorMessage, type Json } from "@/lib/pb";
import { discardChanges, useUnsavedChanges } from "@/lib/useUnsavedChanges";

type Field = {
  id?: string;
  name: string;
  type: string;
  required?: boolean;
  system?: boolean;
  hidden?: boolean;
  presentable?: boolean;
  values?: string[];
  maxSelect?: number;
  collectionId?: string;
  protected?: boolean;
  min?: number;
  max?: number;
  pattern?: string;
  autogeneratePattern?: string;
  onlyInt?: boolean;
  mimeTypes?: string[];
  thumbs?: string[];
  options?: Json;
};

type Rule = { mode: "locked" | "public" | "custom"; expr: string };

type Collection = {
  id: string;
  name: string;
  type: string;
  system?: boolean;
  fields: Field[];
  listRule?: string | null;
  viewRule?: string | null;
  createRule?: string | null;
  updateRule?: string | null;
  deleteRule?: string | null;
  authRule?: string | null;
  manageRule?: string | null;
  passwordAuth?: { enabled?: boolean; identityFields?: string[] };
  otp?: { enabled?: boolean; duration?: number; length?: number; emailTemplate?: Json };
  mfa?: { enabled?: boolean; duration?: number; rule?: string };
  authToken?: { duration?: number; secret?: string };
  passwordResetToken?: { duration?: number; secret?: string };
  emailChangeToken?: { duration?: number; secret?: string };
  verificationToken?: { duration?: number; secret?: string };
  oauth2?: { enabled?: boolean; providers?: any[] };
  indexes?: string[];
  viewQuery?: string;
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

function toRule(value: string | null | undefined): Rule {
  if (value === null || value === undefined) return { mode: "locked", expr: "" };
  if (value === "") return { mode: "public", expr: "" };
  return { mode: "custom", expr: value };
}

function fromRule(rule: Rule): string | null {
  if (rule.mode === "locked") return null;
  if (rule.mode === "public") return "";
  return rule.expr.trim() || null;
}

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
  const [tab, setTab] = useState("fields");
  const [name, setName] = useState("");
  const [type, setType] = useState("base");
  const [fields, setFields] = useState<Field[]>([]);
  const [rules, setRules] = useState<Record<string, Rule>>({});
  const [authRule, setAuthRule] = useState<Rule>({ mode: "locked", expr: "" });
  const [manageRule, setManageRule] = useState<Rule>({ mode: "locked", expr: "" });
  const [passwordAuth, setPasswordAuth] = useState<{ enabled: boolean; identityFields: string[] }>({
    enabled: true,
    identityFields: [],
  });
  const [otp, setOtp] = useState<{ enabled: boolean; duration: number; length: number; emailTemplate?: Json }>({
    enabled: false,
    duration: 180,
    length: 8,
  });
  const [mfa, setMfa] = useState<{ enabled: boolean; duration: number; rule: string }>({
    enabled: false,
    duration: 1800,
    rule: "",
  });
  const [tokens, setTokens] = useState<Record<string, any>>({
    authToken: { duration: 1209600 },
    passwordResetToken: { duration: 1800 },
    emailChangeToken: { duration: 1800 },
    verificationToken: { duration: 604800 },
  });
  const [oauth2, setOauth2] = useState<{ enabled: boolean; providers: any[] }>({
    enabled: false,
    providers: [],
  });
  const [providersJSON, setProvidersJSON] = useState("[]");
  const [indexes, setIndexes] = useState<string[]>([]);
  const [viewQuery, setViewQuery] = useState("");
  const [viewPreview, setViewPreview] = useState<{ columns?: { name: string }[]; rows?: any[][] } | null>(null);
  const [viewError, setViewError] = useState("");
  const [previewing, setPreviewing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [baseline, setBaseline] = useState("");

  useEffect(() => {
    if (!open) return;

    const initialName = collection?.name || "";
    const initialType = collection?.type || "base";
    const initialFields = (collection?.fields || [])
      .filter((field) => !SYSTEM_FIELDS.has(field.name) && !field.system)
      .map((field) => ({
        ...field,
        values: field.values || [],
        maxSelect: field.maxSelect || 1,
      }));
    const initialRules: Record<string, Rule> = {};
    for (const [key] of RULES) initialRules[key] = toRule((collection as any)?.[key]);
    const initialAuthRule = toRule(collection?.authRule);
    const initialManageRule = toRule(collection?.manageRule);
    const initialPasswordAuth = {
      enabled: collection?.passwordAuth?.enabled !== false,
      identityFields: collection?.passwordAuth?.identityFields || [],
    };
    const initialOtp = {
      enabled: Boolean(collection?.otp?.enabled),
      duration: collection?.otp?.duration || 180,
      length: collection?.otp?.length || 8,
      emailTemplate: collection?.otp?.emailTemplate,
    };
    const initialMfa = {
      enabled: Boolean(collection?.mfa?.enabled),
      duration: collection?.mfa?.duration || 1800,
      rule: collection?.mfa?.rule || "",
    };
    const initialTokens = {
      authToken: { ...(collection?.authToken || {}), duration: collection?.authToken?.duration || 1209600 },
      passwordResetToken: {
        ...(collection?.passwordResetToken || {}),
        duration: collection?.passwordResetToken?.duration || 1800,
      },
      emailChangeToken: {
        ...(collection?.emailChangeToken || {}),
        duration: collection?.emailChangeToken?.duration || 1800,
      },
      verificationToken: {
        ...(collection?.verificationToken || {}),
        duration: collection?.verificationToken?.duration || 604800,
      },
    };
    const initialOauth2 = {
      enabled: Boolean(collection?.oauth2?.enabled),
      providers: collection?.oauth2?.providers || [],
    };
    const initialProvidersJSON = JSON.stringify(collection?.oauth2?.providers || [], null, 2);
    const initialIndexes = collection?.indexes || [];
    const initialViewQuery = collection?.viewQuery || "";

    setTab("fields");
    setName(initialName);
    setType(initialType);
    setFields(initialFields);
    setRules(initialRules);
    setAuthRule(initialAuthRule);
    setManageRule(initialManageRule);
    setPasswordAuth(initialPasswordAuth);
    setOtp(initialOtp);
    setMfa(initialMfa);
    setTokens(initialTokens);
    setOauth2(initialOauth2);
    setProvidersJSON(initialProvidersJSON);
    setIndexes(initialIndexes);
    setViewQuery(initialViewQuery);
    setViewPreview(null);
    setViewError("");
    setBaseline(
      JSON.stringify({
        name: initialName,
        type: initialType,
        fields: initialFields,
        rules: initialRules,
        authRule: initialAuthRule,
        manageRule: initialManageRule,
        passwordAuth: initialPasswordAuth,
        otp: initialOtp,
        mfa: initialMfa,
        tokens: initialTokens,
        oauth2: initialOauth2,
        providersJSON: initialProvidersJSON,
        indexes: initialIndexes,
        viewQuery: initialViewQuery,
      }),
    );
  }, [open, collection]);

  const isEdit = Boolean(collection?.id);
  const dirty =
    open &&
    baseline !== "" &&
    baseline !==
      JSON.stringify({
        name,
        type,
        fields,
        rules,
        authRule,
        manageRule,
        passwordAuth,
        otp,
        mfa,
        tokens,
        oauth2,
        providersJSON,
        indexes,
        viewQuery,
      });
  useUnsavedChanges(dirty);

  function close() {
    discardChanges(dirty, onClose);
  }
  const publicRules = useMemo(
    () => Object.entries(rules).filter(([, rule]) => rule.mode === "public").map(([key]) => key),
    [rules],
  );

  const oauthProviders = useMemo<any[]>(() => {
    try {
      const parsed = providersJSON.trim() ? JSON.parse(providersJSON) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [providersJSON]);

  function updateProvider(index: number, patch: Record<string, any>) {
    const next = oauthProviders.map((provider, position) =>
      position === index ? { ...provider, ...patch } : provider,
    );
    setProvidersJSON(JSON.stringify(next, null, 2));
  }

  function addProvider() {
    const next = [...oauthProviders, { name: "", clientId: "", clientSecret: "" }];
    setProvidersJSON(JSON.stringify(next, null, 2));
  }

  function removeProvider(index: number) {
    setProvidersJSON(JSON.stringify(oauthProviders.filter((_, position) => position !== index), null, 2));
  }

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

  function schemaDiff() {
    if (!isEdit) return "";
    const original = (collection?.fields || []).filter(
      (field) => !SYSTEM_FIELDS.has(field.name) && !field.system,
    );
    const current = new Map(fields.map((field) => [field.id || field.name, field]));
    const previous = new Map(original.map((field) => [field.id || field.name, field]));
    const lines: string[] = [];
    for (const [key, field] of current) {
      const old = previous.get(key);
      if (!old) {
        lines.push(`+ add field ${field.name} (${field.type})`);
        continue;
      }
      const changed = ["name", "type", "required", "min", "max", "pattern", "hidden", "presentable"]
        .filter((property) => JSON.stringify((old as any)[property]) !== JSON.stringify((field as any)[property]));
      if (changed.length) lines.push(`~ change ${field.name}: ${changed.join(", ")}`);
    }
    for (const [key, field] of previous) {
      if (!current.has(key)) lines.push(`- remove field ${field.name} (${field.type})`);
    }
    return lines.join("\n");
  }

  function validIndex(value: string) {
    return /^create\s+(unique\s+)?index\s+/i.test(value.trim()) && /\son\s+/i.test(value);
  }

  function suggestIndexes() {
    const matches: string[] = [];
    for (const field of fields) {
      if (!["text", "email", "url", "date", "number", "bool"].includes(field.type)) continue;
      if (!/name|email|slug|code|status|created|updated/i.test(field.name)) continue;
      const exists = indexes.some((index) => index.includes(`(${field.name})`) || index.includes(`(${field.name},`));
      if (!exists) {
        matches.push(`CREATE INDEX idx_${(name || "collection").replace(/[^a-z0-9_]/gi, "_")}_${field.name} ON ${name || "collection"} (${field.name})`);
      }
    }
    if (!matches.length) {
      toast.message("No obvious index suggestions.");
      return;
    }
    setIndexes((current) => [...current, ...matches]);
  }

  async function previewView() {
    if (!viewQuery.trim()) return;
    setPreviewing(true);
    setViewError("");
    try {
      const result = await pb.send("/api/collections/meta/dry-run-view", {
        method: "POST",
        body: { query: viewQuery },
      });
      setViewPreview(result);
    } catch (err) {
      setViewPreview(null);
      setViewError(errorMessage(err));
    } finally {
      setPreviewing(false);
    }
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
      if (field.hidden) next.hidden = true;
      if (field.presentable) next.presentable = true;
      if (["text", "email", "url", "editor"].includes(field.type)) {
        if (field.min) next.min = Number(field.min);
        if (field.max) next.max = Number(field.max);
        if (field.pattern?.trim()) next.pattern = field.pattern.trim();
        if (field.autogeneratePattern?.trim()) next.autogeneratePattern = field.autogeneratePattern.trim();
      }
      if (field.type === "number") {
        if (field.min !== undefined && field.min !== null) next.min = Number(field.min);
        if (field.max !== undefined && field.max !== null) next.max = Number(field.max);
        if (field.onlyInt) next.onlyInt = true;
      }
      if (field.type === "file") {
        next.mimeTypes = (field.mimeTypes || []).filter(Boolean);
        next.thumbs = (field.thumbs || []).filter(Boolean);
      }
      return next;
    });

    let systemFields = isEdit
      ? (collection?.fields || []).filter((field) => SYSTEM_FIELDS.has(field.name) || field.system)
      : [];

    // New collections need PocketBase's scaffold system fields (id, created, updated, auth fields, ...).
    if (!isEdit) {
      try {
        const scaffolds = await pb.collections.getScaffolds();
        systemFields = [
          ...((scaffolds as any)[type]?.fields || []),
          { name: "created", type: "autodate", onCreate: true, system: true },
          { name: "updated", type: "autodate", onCreate: true, onUpdate: true, system: true },
        ] as any;
      } catch {
        systemFields = [
          { name: "created", type: "autodate", onCreate: true, system: true },
          { name: "updated", type: "autodate", onCreate: true, onUpdate: true, system: true },
        ] as any;
      }
    }

    const invalidIndex = indexes.map((item) => item.trim()).filter(Boolean).find((item) => !validIndex(item));
    if (invalidIndex) {
      toast.error(`Invalid index: ${invalidIndex}`);
      return;
    }

    const changes = schemaDiff();
    if (changes && !window.confirm(`Apply these schema changes?\n\n${changes}`)) {
      return;
    }

    const payload: Json = {
      name: name.trim(),
      type,
      fields: [...systemFields, ...userFields],
      indexes: indexes.map((item) => item.trim()).filter(Boolean),
    };

    for (const [key] of RULES) {
      payload[key] = fromRule(rules[key] || { mode: "locked", expr: "" });
    }

    if (type === "auth") {
      payload.authRule = fromRule(authRule);
      payload.manageRule = fromRule(manageRule);
      payload.passwordAuth = passwordAuth;
      payload.otp = otp;
      payload.mfa = mfa;
      payload.authToken = tokens.authToken;
      payload.passwordResetToken = tokens.passwordResetToken;
      payload.emailChangeToken = tokens.emailChangeToken;
      payload.verificationToken = tokens.verificationToken;
      let providers: any[] = [];
      try {
        providers = providersJSON.trim() ? JSON.parse(providersJSON) : [];
        if (!Array.isArray(providers)) throw new Error("providers must be an array");
      } catch {
        toast.error("OAuth2 providers must be a JSON array.");
        return;
      }
      payload.oauth2 = { ...oauth2, providers };
    }

    if (type === "view") {
      payload.viewQuery = viewQuery;
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
    <Sheet
      open={open}
      onClose={close}
      title={isEdit ? `Edit ${collection?.name}` : "New collection"}
      description={isEdit ? "Fields, rules, auth, indexes and view query" : "Create a collection and its fields"}
      className="max-w-4xl"
      footer={
        <>
          <Button variant="outline" onClick={close} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="collection-form" disabled={busy}>
            {busy ? "Saving…" : isEdit ? "Save collection" : "Create collection"}
          </Button>
        </>
      }
    >
      <form id="collection-form" onSubmit={submit} className="space-y-5">
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

        <Tabs
          tabs={[
            { value: "fields", label: "Fields" },
            { value: "rules", label: "API rules" },
            ...(type === "auth" ? [{ value: "auth", label: "Auth options" }] : []),
            { value: "indexes", label: "Indexes" },
            ...(type === "view" ? [{ value: "view", label: "View query" }] : []),
          ]}
          value={tab}
          onChange={setTab}
        />

        {tab === "fields" ? (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-mono text-[10px] font-bold uppercase tracking-[0.14em]">Fields</h3>
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
                  <Button variant="ghost" size="icon" onClick={() => removeField(index)} aria-label="Remove field">
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
                          onChange={(event) => updateField(index, { maxSelect: Number(event.target.value) })}
                        />
                      </div>
                      <label className="flex items-end gap-2 pb-2 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={Boolean(field.protected)}
                          onChange={(event) => updateField(index, { protected: event.target.checked })}
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
                          onChange={(event) => updateField(index, { collectionId: event.target.value })}
                        >
                          <option value="">Select…</option>
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
                          onChange={(event) => updateField(index, { maxSelect: Number(event.target.value) })}
                        />
                      </div>
                    </div>
                  ) : null}

                  {["text", "email", "url", "editor"].includes(field.type) ? (
                    <div className="grid gap-2 sm:col-span-4 sm:grid-cols-4">
                      <div>
                        <Label>Min length</Label>
                        <Input
                          type="number"
                          min={0}
                          value={field.min ?? ""}
                          onChange={(event) => updateField(index, { min: Number(event.target.value) })}
                        />
                      </div>
                      <div>
                        <Label>Max length</Label>
                        <Input
                          type="number"
                          min={0}
                          value={field.max ?? ""}
                          onChange={(event) => updateField(index, { max: Number(event.target.value) })}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <Label>Pattern</Label>
                        <Input
                          value={field.pattern || ""}
                          onChange={(event) => updateField(index, { pattern: event.target.value })}
                          placeholder="^[a-z0-9-]+$"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <Label>Autogenerate pattern</Label>
                        <Input
                          value={field.autogeneratePattern || ""}
                          onChange={(event) => updateField(index, { autogeneratePattern: event.target.value })}
                          placeholder="[a-z0-9]{15}"
                        />
                      </div>
                    </div>
                  ) : null}

                  {field.type === "number" ? (
                    <div className="grid gap-2 sm:col-span-4 sm:grid-cols-3">
                      <div>
                        <Label>Min</Label>
                        <Input
                          type="number"
                          value={field.min ?? ""}
                          onChange={(event) => updateField(index, { min: Number(event.target.value) })}
                        />
                      </div>
                      <div>
                        <Label>Max</Label>
                        <Input
                          type="number"
                          value={field.max ?? ""}
                          onChange={(event) => updateField(index, { max: Number(event.target.value) })}
                        />
                      </div>
                      <label className="flex items-end gap-2 pb-2 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={Boolean(field.onlyInt)}
                          onChange={(event) => updateField(index, { onlyInt: event.target.checked })}
                          className="h-4 w-4 accent-[hsl(var(--accent))]"
                        />
                        Integer only
                      </label>
                    </div>
                  ) : null}

                  {field.type === "file" ? (
                    <div className="grid gap-2 sm:col-span-4 sm:grid-cols-2">
                      <div>
                        <Label>Allowed MIME types</Label>
                        <Input
                          value={(field.mimeTypes || []).join(", ")}
                          onChange={(event) =>
                            updateField(index, {
                              mimeTypes: event.target.value.split(",").map((item) => item.trim()).filter(Boolean),
                            })
                          }
                          placeholder="image/*, application/pdf"
                        />
                      </div>
                      <div>
                        <Label>Thumbs</Label>
                        <Input
                          value={(field.thumbs || []).join(", ")}
                          onChange={(event) =>
                            updateField(index, {
                              thumbs: event.target.value.split(",").map((item) => item.trim()).filter(Boolean),
                            })
                          }
                          placeholder="100x100, 300x300"
                        />
                      </div>
                    </div>
                  ) : null}

                  <div className="flex flex-wrap gap-4 sm:col-span-4">
                    <label className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={Boolean(field.presentable)}
                        onChange={(event) => updateField(index, { presentable: event.target.checked })}
                        className="h-4 w-4 accent-[hsl(var(--accent))]"
                      />
                      Presentable
                    </label>
                    <label className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={Boolean(field.hidden)}
                        onChange={(event) => updateField(index, { hidden: event.target.checked })}
                        className="h-4 w-4 accent-[hsl(var(--accent))]"
                      />
                      Hidden
                    </label>
                  </div>
                </div>
              ))}
              {fields.length === 0 ? (
                <p className="border border-dashed border-border px-4 py-6 text-center text-xs text-muted-foreground">
                  No custom fields yet.
                </p>
              ) : null}
            </div>
          </div>
        ) : null}

        {tab === "rules" ? (
          <div className="space-y-4">
            {publicRules.length ? (
              <div className="flex items-start gap-2 border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  Public rules: {publicRules.map((rule) => rule.replace("Rule", "")).join(", ")}. Anyone can
                  perform these operations.
                </span>
              </div>
            ) : null}
            <p className="text-xs text-muted-foreground">
              Locked means superuser-only. Public means anyone. Custom is a PocketBase filter expression.
            </p>
            {RULES.map(([key, label]) => (
              <RuleEditor
                key={key}
                label={label}
                value={rules[key] || { mode: "locked", expr: "" }}
                onChange={(value) => setRules((current) => ({ ...current, [key]: value }))}
              />
            ))}
          </div>
        ) : null}

        {tab === "auth" && type === "auth" ? (
          <div className="space-y-4">
            <RuleEditor label="Auth rule" value={authRule} onChange={setAuthRule} />
            <RuleEditor label="Manage rule" value={manageRule} onChange={setManageRule} />

            <div className="grid gap-3 sm:grid-cols-3">
              <Toggle
                label="Password auth"
                checked={passwordAuth.enabled}
                onChange={(enabled) => setPasswordAuth({ ...passwordAuth, enabled })}
              />
              <Toggle label="OTP" checked={otp.enabled} onChange={(enabled) => setOtp({ ...otp, enabled })} />
              <Toggle label="MFA" checked={mfa.enabled} onChange={(enabled) => setMfa({ ...mfa, enabled })} />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Password identity fields</Label>
                <Input
                  value={passwordAuth.identityFields.join(", ")}
                  onChange={(event) =>
                    setPasswordAuth({
                      ...passwordAuth,
                      identityFields: event.target.value.split(",").map((item) => item.trim()).filter(Boolean),
                    })
                  }
                  placeholder="email"
                />
              </div>
              <div>
                <Label>MFA rule</Label>
                <Input
                  value={mfa.rule}
                  onChange={(event) => setMfa({ ...mfa, rule: event.target.value })}
                  placeholder="@request.auth.id != ''"
                />
              </div>
              <div>
                <Label>OTP duration (seconds)</Label>
                <Input
                  type="number"
                  min={10}
                  value={otp.duration}
                  onChange={(event) => setOtp({ ...otp, duration: Number(event.target.value) })}
                />
              </div>
              <div>
                <Label>OTP length</Label>
                <Input
                  type="number"
                  min={4}
                  value={otp.length}
                  onChange={(event) => setOtp({ ...otp, length: Number(event.target.value) })}
                />
              </div>
              <div>
                <Label>MFA duration (seconds)</Label>
                <Input
                  type="number"
                  min={10}
                  value={mfa.duration}
                  onChange={(event) => setMfa({ ...mfa, duration: Number(event.target.value) })}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ["authToken", "Auth token"],
                ["passwordResetToken", "Password reset token"],
                ["emailChangeToken", "Email change token"],
                ["verificationToken", "Verification token"],
              ].map(([key, label]) => (
                <div key={key}>
                  <Label>{label} duration (seconds)</Label>
                  <Input
                    type="number"
                    min={10}
                    value={tokens[key]?.duration || 0}
                    onChange={(event) =>
                      setTokens((current) => ({
                        ...current,
                        [key]: { ...current[key], duration: Number(event.target.value) },
                      }))
                    }
                  />
                </div>
              ))}
            </div>

            <div className="border border-border p-3">
              <div className="flex items-center justify-between gap-3">
                <Toggle
                  label="OAuth2"
                  checked={oauth2.enabled}
                  onChange={(enabled) => setOauth2({ ...oauth2, enabled })}
                />
                <Button variant="outline" size="sm" onClick={addProvider}>
                  <Plus />
                  Add provider
                </Button>
              </div>
              <div className="mt-3 space-y-2">
                {oauthProviders.map((provider, index) => (
                  <div key={index} className="grid gap-2 border border-border p-3 sm:grid-cols-2">
                    {[
                      ["name", "Provider", "github"],
                      ["clientId", "Client ID", ""],
                      ["clientSecret", "Client secret", ""],
                      ["displayName", "Display name", ""],
                      ["authURL", "Auth URL", ""],
                      ["tokenURL", "Token URL", ""],
                      ["userInfoURL", "User info URL", ""],
                    ].map(([key, label, placeholder]) => (
                      <div key={key}>
                        <Label>{label}</Label>
                        <Input
                          type={key === "clientSecret" ? "password" : "text"}
                          value={provider[key] || ""}
                          placeholder={placeholder}
                          onChange={(event) => updateProvider(index, { [key]: event.target.value })}
                        />
                      </div>
                    ))}
                    <div className="sm:col-span-2">
                      <Button variant="ghost" size="sm" onClick={() => removeProvider(index)}>
                        <Trash2 />
                        Remove provider
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3">
                <Label>OAuth2 providers (advanced JSON)</Label>
                <Textarea
                  rows={8}
                  className="font-mono"
                  value={providersJSON}
                  onChange={(event) => setProvidersJSON(event.target.value)}
                  placeholder='[{"name":"github","clientId":"...","clientSecret":"..."}]'
                />
              </div>
            </div>
          </div>
        ) : null}

        {tab === "indexes" ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                SQLite index definitions. Use <code>CREATE INDEX ...</code> or <code>CREATE UNIQUE INDEX ...</code>.
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={suggestIndexes}>
                  Suggest
                </Button>
                <Button variant="outline" size="sm" onClick={() => setIndexes((current) => [...current, ""])}>
                  <Plus />
                  Add index
                </Button>
              </div>
            </div>
            {indexes.map((index, position) => (
              <div key={position} className="flex items-start gap-2">
                <div className="flex-1">
                  <Textarea
                    rows={3}
                    className={`font-mono ${index.trim() && !validIndex(index) ? "border-destructive" : ""}`}
                    value={index}
                    onChange={(event) =>
                      setIndexes((current) =>
                        current.map((item, indexPosition) => (indexPosition === position ? event.target.value : item)),
                      )
                    }
                    placeholder={`CREATE UNIQUE INDEX idx_${name || "collection"}_field ON ${name || "collection"} (field)`}
                  />
                  {index.trim() && !validIndex(index) ? (
                    <p className="mt-1 text-[10px] text-destructive">
                      Use CREATE INDEX ... ON table (column).
                    </p>
                  ) : null}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIndexes((current) => current.filter((_, indexPosition) => indexPosition !== position))}
                  aria-label="Remove index"
                >
                  <Trash2 />
                </Button>
              </div>
            ))}
            {!indexes.length ? (
              <p className="border border-dashed border-border px-4 py-6 text-center text-xs text-muted-foreground">
                No indexes yet.
              </p>
            ) : null}
          </div>
        ) : null}

        {tab === "view" && type === "view" ? (
          <div>
            <Label>View query</Label>
            <Textarea
              rows={14}
              className="font-mono"
              value={viewQuery}
              onChange={(event) => setViewQuery(event.target.value)}
              placeholder="SELECT id, title FROM posts WHERE published = 1"
            />
            <div className="mt-2 flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                A read-only SELECT query. PocketBase derives the fields from the result columns.
              </p>
              <Button variant="outline" size="sm" onClick={previewView} disabled={previewing || !viewQuery.trim()}>
                {previewing ? "Previewing…" : "Preview"}
              </Button>
            </div>
            {viewError ? (
              <div className="mt-3 border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {viewError}
              </div>
            ) : null}
            {viewPreview ? (
              <div className="mt-3 overflow-auto border border-border">
                <table className="w-full text-xs">
                  <thead className="bg-muted/30 font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
                    <tr>
                      {(viewPreview.columns || []).map((column) => (
                        <th key={column.name} className="px-3 py-2 text-left">
                          {column.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(viewPreview.rows || []).map((row, rowIndex) => (
                      <tr key={rowIndex} className="border-t border-border">
                        {row.map((value, valueIndex) => (
                          <td key={valueIndex} className="max-w-[220px] truncate px-3 py-2 font-mono text-[10px]">
                            {String(value ?? "")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!viewPreview.rows?.length ? (
                  <p className="px-3 py-4 text-xs text-muted-foreground">Query returned no rows.</p>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </form>
    </Sheet>
  );
}

function RuleEditor({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Rule;
  onChange: (value: Rule) => void;
}) {
  return (
    <div className="grid gap-2 border border-border p-3 sm:grid-cols-[180px_1fr] sm:items-start">
      <Label className="pt-2">{label}</Label>
      <div className="space-y-2">
        <Select
          value={value.mode}
          onChange={(event) =>
            onChange({ ...value, mode: event.target.value as Rule["mode"] })
          }
        >
          <option value="locked">Locked (superuser only)</option>
          <option value="public">Public (anyone)</option>
          <option value="custom">Custom expression</option>
        </Select>
        {value.mode === "custom" ? (
          <Input
            value={value.expr}
            onChange={(event) => onChange({ ...value, expr: event.target.value })}
            placeholder='@request.auth.id != ""'
          />
        ) : null}
      </div>
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 border border-border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 accent-[hsl(var(--accent))]"
      />
      {label}
    </label>
  );
}
