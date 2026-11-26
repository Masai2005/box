import { useMemo, useState } from "react";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Button, Sheet, Tabs } from "@/components/ui";
import { pb } from "@/lib/pb";

type Field = { name: string; type: string; system?: boolean };

const OPS = [
  { value: "list", label: "List" },
  { value: "view", label: "View" },
  { value: "create", label: "Create" },
  { value: "update", label: "Update" },
  { value: "delete", label: "Delete" },
];

export function ApiPreviewDialog({
  open,
  onClose,
  collection,
}: {
  open: boolean;
  onClose: () => void;
  collection: { id: string; name: string; fields: Field[] } | null;
}) {
  const [op, setOp] = useState("list");
  const origin = window.location.origin;
  const endpoint = collection ? `${origin}/api/collections/${collection.name}/records` : "";

  const sample = useMemo(() => {
    if (!collection) return "{}";
    const body: Record<string, any> = {};
    for (const field of collection.fields) {
      if (field.system || ["id", "created", "updated", "collectionId", "collectionName"].includes(field.name)) {
        continue;
      }
      switch (field.type) {
        case "bool":
          body[field.name] = false;
          break;
        case "number":
          body[field.name] = 0;
          break;
        case "json":
          body[field.name] = {};
          break;
        case "select":
          body[field.name] = "";
          break;
        case "date":
          body[field.name] = new Date().toISOString();
          break;
        case "relation":
          body[field.name] = "";
          break;
        default:
          body[field.name] = "";
      }
    }
    return JSON.stringify(body, null, 2);
  }, [collection]);

  const snippet = useMemo(() => {
    if (!collection) return "";
    const auth = `Authorization: Bearer $TOKEN`;
    switch (op) {
      case "view":
        return `curl "${endpoint}/RECORD_ID" \\\n  -H "${auth}"`;
      case "create":
        return `curl -X POST "${endpoint}" \\\n  -H "${auth}" \\\n  -H "Content-Type: application/json" \\\n  -d '${sample}'`;
      case "update":
        return `curl -X PATCH "${endpoint}/RECORD_ID" \\\n  -H "${auth}" \\\n  -H "Content-Type: application/json" \\\n  -d '${sample}'`;
      case "delete":
        return `curl -X DELETE "${endpoint}/RECORD_ID" \\\n  -H "${auth}"`;
      default:
        return `curl "${endpoint}?page=1&perPage=50&sort=-created" \\\n  -H "${auth}"`;
    }
  }, [op, endpoint, sample, collection]);

  if (!collection) return null;

  const sdk = `import PocketBase from "pocketbase";\n\nconst pb = new PocketBase("${origin}");\npb.authStore.save("$TOKEN");\n\n${
    op === "view"
      ? `const record = await pb.collection("${collection.name}").getOne("RECORD_ID");`
      : op === "create"
        ? `const record = await pb.collection("${collection.name}").create(${sample});`
        : op === "update"
          ? `const record = await pb.collection("${collection.name}").update("RECORD_ID", ${sample});`
          : op === "delete"
            ? `await pb.collection("${collection.name}").delete("RECORD_ID");`
            : `const records = await pb.collection("${collection.name}").getList(1, 50, { sort: "-created" });`
  }`;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={`API preview · ${collection.name}`}
      description="Same-origin REST API. Superuser token or a scoped API token."
      className="max-w-3xl"
    >
      <Tabs tabs={OPS} value={op} onChange={setOp} className="mb-4" />

      <div className="space-y-4">
        <CodeBlock label="HTTP" code={snippet} />
        <CodeBlock label="JavaScript SDK" code={sdk} />
        <div className="border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
          Base URL: <code className="font-mono text-foreground">{endpoint}</code>
          <br />
          Auth: <code className="font-mono text-foreground">pb.collection("_superusers").authWithPassword(...)</code>
          {" "}or an API token from Settings → API tokens.
        </div>
      </div>
    </Sheet>
  );
}

function CodeBlock({ label, code }: { label: string; code: string }) {
  return (
    <div className="border border-border">
      <div className="flex items-center justify-between border-b border-border bg-muted/30 px-3 py-2">
        <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            navigator.clipboard.writeText(code);
            toast.success("Copied.");
          }}
        >
          <Copy />
          Copy
        </Button>
      </div>
      <pre className="overflow-x-auto bg-background p-4 font-mono text-[11px] leading-5 scrollbar-thin">
        <code>{code}</code>
      </pre>
    </div>
  );
}
