import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button, Dialog, Input, Label, Select, Tabs, Textarea } from "@/components/ui";
import { pb, errorMessage, type Json } from "@/lib/pb";
import { discardChanges, useUnsavedChanges } from "@/lib/useUnsavedChanges";

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
  passwordAuth?: { enabled?: boolean };
  otp?: { enabled?: boolean };
  mfa?: { enabled?: boolean };
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
  const [passwordAuth, setPasswordAuth] = useState({ enabled: true });
  const [otp, setOtp] = useState({ enabled: false });
  const [mfa, setMfa] = useState({ enabled: false });
  const [oauth2, setOauth2] = useState<{ enabled: boolean; providers: any[] }>({
    enabled: false,
    providers: [],
  });
  const [providersJSON, setProvidersJSON] = useState("[]");
  const [indexes, setIndexes] = useState<string[]>([]);
  const [viewQuery, setViewQuery] = useState("");
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
    const initialPasswordAuth = { enabled: collection?.passwordAuth?.enabled !== false };
    const initialOtp = { enabled: Boolean(collection?.otp?.enabled) };
    const initialMfa = { enabled: Boolean(collection?.mfa?.enabled) };
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
    setOauth2(initialOauth2);
    setProvidersJSON(initialProvidersJSON);
    setIndexes(initialIndexes);
    setViewQuery(initialViewQuery);
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
    <Dialog
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

            <div className="border border-border p-3">
              <Toggle
                label="OAuth2"
                checked={oauth2.enabled}
                onChange={(enabled) => setOauth2({ ...oauth2, enabled })}
              />
              <div className="mt-3">
                <Label>OAuth2 providers (JSON array)</Label>
                <Textarea
                  rows={10}
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
              <Button variant="outline" size="sm" onClick={() => setIndexes((current) => [...current, ""])}>
                <Plus />
                Add index
              </Button>
            </div>
            {indexes.map((index, position) => (
              <div key={position} className="flex items-start gap-2">
                <Textarea
                  rows={3}
                  className="font-mono"
                  value={index}
                  onChange={(event) =>
                    setIndexes((current) =>
                      current.map((item, indexPosition) => (indexPosition === position ? event.target.value : item)),
                    )
                  }
                  placeholder={`CREATE UNIQUE INDEX idx_${name || "collection"}_field ON ${name || "collection"} (field)`}
                />
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
            <p className="mt-1 text-xs text-muted-foreground">
              A read-only SELECT query. PocketBase derives the fields from the result columns.
            </p>
          </div>
        ) : null}
      </form>
    </Dialog>
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
