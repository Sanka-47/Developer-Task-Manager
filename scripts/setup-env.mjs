import { copyFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const files = [
  ["apps/api/.env.example", "apps/api/.env"],
  ["apps/web/.env.example", "apps/web/.env.local"],
];

for (const [source, destination] of files) {
  const from = resolve(root, source);
  const to = resolve(root, destination);

  if (existsSync(to)) {
    console.log(`kept existing ${destination}`);
    continue;
  }

  copyFileSync(from, to);
  console.log(`created ${destination} from ${source}`);
}
