export interface JiraConfig {
  baseUrl: string;
  email: string;
  apiToken: string;
}

export function getJiraConfig(): JiraConfig {
  const baseUrl = process.env.JIRA_BASE_URL;
  const email = process.env.JIRA_EMAIL;
  const apiToken = process.env.JIRA_API_TOKEN;
  if (!baseUrl || !email || !apiToken) {
    throw new Error("Missing JIRA_BASE_URL, JIRA_EMAIL, or JIRA_API_TOKEN in environment (.env.local)");
  }
  return { baseUrl: baseUrl.replace(/\/$/, ""), email, apiToken };
}

function authHeader(config: JiraConfig): string {
  return "Basic " + Buffer.from(`${config.email}:${config.apiToken}`).toString("base64");
}

export class JiraApiError extends Error {
  constructor(
    public status: number,
    public body: string,
    message: string,
  ) {
    super(message);
    this.name = "JiraApiError";
  }
}

const MAX_RATE_LIMIT_RETRIES = 5;

/** Low-level fetch against the Jira REST API. Retries 429s honoring Retry-After. */
export async function jiraFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const config = getJiraConfig();
  const url = `${config.baseUrl}${path}`;
  const headers = {
    Authorization: authHeader(config),
    Accept: "application/json",
    ...(init.body ? { "Content-Type": "application/json" } : {}),
    ...(init.headers ?? {}),
  };

  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { ...init, headers });
    if (res.status === 429 && attempt < MAX_RATE_LIMIT_RETRIES) {
      const retryAfter = Number(res.headers.get("Retry-After")) || 1;
      await new Promise((r) => setTimeout(r, retryAfter * 1000));
      continue;
    }
    return res;
  }
}

/** Fetch + JSON parse, throwing JiraApiError on non-2xx. */
export async function jiraJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await jiraFetch(path, init);
  if (!res.ok) {
    const body = await res.text();
    throw new JiraApiError(res.status, body, `Jira ${init.method ?? "GET"} ${path} failed: ${res.status} ${body}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
