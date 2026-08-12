import { loadLocalEnv } from "../src/lib/env";
loadLocalEnv();

import { getJiraConfig } from "../src/lib/jira/client";
import { getMyself } from "../src/lib/jira/me";

async function main() {
  const config = getJiraConfig();
  console.log(`Checking ${config.baseUrl} as ${config.email} ...`);
  const me = await getMyself();
  console.log("Auth OK");
  console.log(`  accountId:   ${me.accountId}`);
  console.log(`  displayName: ${me.displayName}`);
}

main().catch((err) => {
  console.error("Auth check FAILED");
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
