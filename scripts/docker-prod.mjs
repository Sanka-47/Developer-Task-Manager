#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import process from "node:process";

function gitSha() {
  const result = spawnSync("git", ["rev-parse", "--short", "HEAD"], {
    encoding: "utf8",
  });
  return result.status === 0 ? result.stdout.trim() : "local";
}

const imageTag = process.env.IMAGE_TAG ?? gitSha();
const composeArgs = [
  "compose",
  "-f",
  "docker-compose.prod.yml",
  ...process.argv.slice(2),
];

const result = spawnSync("docker", composeArgs, {
  stdio: "inherit",
  env: {
    ...process.env,
    IMAGE_TAG: imageTag,
    // Keep the production-shaped stack separate from the developer compose
    // project so volumes and networks do not collide.
    COMPOSE_PROJECT_NAME: process.env.COMPOSE_PROJECT_NAME ?? "taskapp-prod",
  },
});

process.exit(result.status ?? 1);
