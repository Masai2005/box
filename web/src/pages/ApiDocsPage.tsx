import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Braces, Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { PageBody, PageHeader } from "@/components/PageHeader";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Tabs } from "@/components/ui";

type Endpoint = {
  method: string;
  path: string;
  description: string;
  body?: string;
  query?: string;
};

const AUTH = [
  {
    method: "POST",
    path: "/api/collections/_superusers/auth-with-password",
    description: "Sign in the owner account and receive a token.",
    body: '{\n  "identity": "you@example.com",\n  "password": "secret"\n}',
  },
  {
    method: "POST",
    path: "/api/collections/{authCollection}/auth-with-password",
    description: "Sign in a record in an auth collection.",
    body: '{\n  "identity": "user@example.com",\n  "password": "secret"\n}',
  },
  {
    method: "POST",
    path: "/api/collections/_superusers/auth-refresh",
    description: "Refresh the current owner token.",
  },
];

const RECORDS: Endpoint[] = [
  {
    method: "GET",
    path: "/api/collections/{collection}/records",
    description: "List records with filter, sort and pagination.",
    query: "page=1&perPage=30&sort=-created&filter=title ~ \"hello\"",
  },
  {
    method: "GET",
    path: "/api/collections/{collection}/records/{id}",
    description: "Fetch one record.",
  },
  {
    method: "POST",
    path: "/api/collections/{collection}/records",
    description: "Create a record.",
    body: '{\n  "title": "Hello"\n}',
  },
  {
    method: "PATCH",
    path: "/api/collections/{collection}/records/{id}",
    description: "Update a record.",
    body: '{\n  "title": "Updated"\n}',
  },
  {
    method: "DELETE",
    path: "/api/collections/{collection}/records/{id}",
    description: "Delete a record.",
  },
];

const FILES = [
  {
    method: "GET",
    path: "/api/files/{collection}/{recordId}/{filename}",
    description: "Download a file. Protected file fields need a file token or a view rule.",
  },
  {
    method: "POST",
    path: "/api/collections/{collection}/records",
    description: "Upload files with multipart/form-data.",
    body: "title=Hello\ncover=@photo.jpg",
  },
];

const OTHERS = [
  {
    method: "GET",
    path: "/api/realtime",
    description: "Open the realtime SSE stream. Subscribe to a topic after connecting.",
  },
  {
    method: "POST",
    path: "/api/batch",
    description: "Send up to the configured batch limit of same-origin API requests.",
    body: '{\n  "requests": [\n    { "method": "GET", "url": "/api/collections/posts/records" }\n  ]\n}',
  },
  {
    method: "POST",
    path: "/api/_c/scheduled-requests/v1/{id}/run",
    description: "Run a scheduled HTTP request immediately.",
  },
  {
    method: "GET",
    path: "/api/_c/api-tokens/v1",
    description: "List API tokens for the owner account.",
  },
];

export function ApiDocsPage() {
  return (
    <>
      <PageHeader
        title="API docs"
        description="Authentication, records, files, realtime, batch and automation"
        eyebrow="developer/docs"
        actions={
          <Link to="/api-explorer">
            <Button size="sm">
              <Braces />
              Open API explorer
            </Button>
          </Link>
        }
      />

      <PageBody className="space-y-5">
        <Card>
          <CardHeader>
            <CardTitle>Base URL</CardTitle>
            <CardDescription>The same origin as this console.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-xs text-muted-foreground">
            <p>
              API base: <code className="font-mono text-foreground">{window.location.origin}/api</code>
            </p>
            <p>
              Send the owner token as <code className="font-mono text-foreground">Authorization: &lt;token&gt;</code>.
              Owner sessions bypass collection rules.
            </p>
            <p>
              All request and response bodies are JSON unless the endpoint accepts multipart form data.
            </p>
          </CardContent>
        </Card>

        <DocSection title="Authentication" description="Owner and auth-collection sessions." endpoints={AUTH} />
        <DocSection title="Records" description="CRUD for any collection. Replace {collection} with its name." endpoints={RECORDS} />
        <DocSection title="Files" description="Uploads and protected downloads." endpoints={FILES} />
        <DocSection title="Realtime, batch and automation" description="Subscriptions, batched calls, API tokens and scheduled requests." endpoints={OTHERS} />

        <Card>
          <CardHeader>
            <CardTitle>Errors and filters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs text-muted-foreground">
            <p>
              Successful responses use standard HTTP status codes. Failed requests return a{" "}
              <code className="font-mono text-foreground">message</code> and may include field errors in{" "}
              <code className="font-mono text-foreground">data</code>.
            </p>
            <p>
              Filter expressions use PocketBase syntax, for example{" "}
              <code className="font-mono text-foreground">title ~ "hello" &amp;&amp; published = true</code>. Sort with{" "}
              <code className="font-mono text-foreground">-created</code> for descending order.
            </p>
            <p>
              Contracts and extension APIs are listed at{" "}
              <a
                className="text-accent underline underline-offset-4"
                href="https://pocketone.dev/docs"
                target="_blank"
                rel="noopener noreferrer"
              >
                pocketone.dev/docs <ExternalLink className="inline h-3 w-3" />
              </a>
              .
            </p>
          </CardContent>
        </Card>
      </PageBody>
    </>
  );
}

function DocSection({
  title,
  description,
  endpoints,
}: {
  title: string;
  description: string;
  endpoints: Endpoint[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {endpoints.map((endpoint) => (
          <EndpointCard key={`${endpoint.method}-${endpoint.path}`} endpoint={endpoint} />
        ))}
      </CardContent>
    </Card>
  );
}

function EndpointCard({ endpoint }: { endpoint: Endpoint }) {
  const [tab, setTab] = useState("curl");
  const snippets = useMemo(() => buildSnippets(endpoint), [endpoint]);
  const active = snippets[tab as keyof typeof snippets] || snippets.curl;

  return (
    <div className="border border-border bg-background">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <Badge variant="secondary">{endpoint.method}</Badge>
        <code className="min-w-0 flex-1 truncate font-mono text-[11px]">{endpoint.path}</code>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            navigator.clipboard.writeText(active);
            toast.success("Copied.");
          }}
        >
          <Copy />
          Copy
        </Button>
      </div>
      <div className="space-y-3 p-3">
        <p className="text-xs text-muted-foreground">{endpoint.description}</p>
        <Tabs
          tabs={[
            { value: "curl", label: "cURL" },
            { value: "js", label: "JavaScript" },
            { value: "dart", label: "Dart" },
          ]}
          value={tab}
          onChange={setTab}
          className="border-b-0"
        />
        <pre className="overflow-x-auto border border-border bg-muted/20 p-3 font-mono text-[10px] scrollbar-thin">
          {active}
        </pre>
      </div>
    </div>
  );
}

function buildSnippets(endpoint: Endpoint) {
  const url = `${window.location.origin}${endpoint.path}${endpoint.query ? `?${endpoint.query}` : ""}`;
  const hasBody = Boolean(endpoint.body);

  const curlBody = endpoint.body
    ? endpoint.body.startsWith("title=")
      ? ` \\\n  -F '${endpoint.body.replaceAll("\n", "' \\\n  -F '")}'`
      : ` \\\n  -H "Content-Type: application/json" \\\n  -d '${endpoint.body}'`
    : "";

  const curl = `curl -X ${endpoint.method} "${url}" \\\n  -H "Authorization: $TOKEN"${curlBody}`;

  const jsBody = endpoint.body && !endpoint.body.startsWith("title=")
    ? `\n  body: JSON.stringify(${endpoint.body}),`
    : "";
  const js = `const response = await fetch(${JSON.stringify(url)}, {
  method: ${JSON.stringify(endpoint.method)},
  headers: {
    Authorization: pb.authStore.token,${hasBody && !endpoint.body?.startsWith("title=") ? '\n    "Content-Type": "application/json",' : ""}
  },${jsBody}
});
const data = await response.json();`;

  const dart = `final request = http.Request(
  ${JSON.stringify(endpoint.method)},
  Uri.parse(${JSON.stringify(url)}),
)..headers["Authorization"] = token;${hasBody && !endpoint.body?.startsWith("title=") ? `\nrequest.headers["Content-Type"] = "application/json";\nrequest.body = jsonEncode(${endpoint.body});` : ""}

final response = await request.send();
final data = await response.stream.bytesToString();`;

  return { curl, js, dart };
}
