#!/usr/bin/env node

/**
 * CLI entry point for ellucian-banner-codegen.
 *
 * Usage:
 *   ellucian-banner-codegen --spec <path> --output <dir> [--api-name <name>]
 */

import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve, basename } from "node:path";
import { parseSpec } from "./parser.js";
import { generateClient } from "./generator.js";

interface CliArgs {
  spec: string;
  output: string;
  apiName?: string;
}

function parseArgs(argv: string[]): CliArgs {
  const args = argv.slice(2); // strip node + script path
  let spec: string | undefined;
  let output: string | undefined;
  let apiName: string | undefined;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--spec":
        spec = args[++i];
        break;
      case "--output":
        output = args[++i];
        break;
      case "--api-name":
        apiName = args[++i];
        break;
      case "--help":
      case "-h":
        printUsage();
        process.exit(0);
        break;
      default:
        console.error(`Unknown argument: ${args[i]}`);
        printUsage();
        process.exit(1);
    }
  }

  if (!spec || !output) {
    console.error("Error: --spec and --output are required.");
    printUsage();
    process.exit(1);
  }

  return { spec, output, apiName };
}

function printUsage(): void {
  console.log(`
Usage: ellucian-banner-codegen --spec <path> --output <dir> [--api-name <name>]

Options:
  --spec <path>       Path to the OpenAPI/Swagger JSON spec file (required)
  --output <dir>      Output directory for generated files (required)
  --api-name <name>   Class name prefix (default: inferred from spec title)
  --help, -h          Show this help message
`);
}

async function main(): Promise<void> {
  const { spec: specPath, output: outputDir, apiName } = parseArgs(process.argv);

  // Read and parse the spec
  const resolvedSpec = resolve(specPath);
  const raw = await readFile(resolvedSpec, "utf-8");

  let specJson: Record<string, unknown>;
  try {
    specJson = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    console.error(`Error: Failed to parse JSON from ${resolvedSpec}`);
    process.exit(1);
  }

  const inferredName = apiName ?? inferApiName(specJson, specPath);
  const parsed = parseSpec(specJson);
  const files = generateClient(parsed, inferredName);

  // Write output
  const resolvedOutput = resolve(outputDir);
  await mkdir(resolvedOutput, { recursive: true });

  await writeFile(resolve(resolvedOutput, "types.ts"), files.types, "utf-8");
  await writeFile(resolve(resolvedOutput, "client.ts"), files.client, "utf-8");

  console.log(`Generated ${parsed.endpoints.length} endpoint(s) and ${parsed.schemas.size} schema(s)`);
  console.log(`  → ${resolve(resolvedOutput, "types.ts")}`);
  console.log(`  → ${resolve(resolvedOutput, "client.ts")}`);
}

function inferApiName(spec: Record<string, unknown>, specPath: string): string {
  const info = spec["info"] as Record<string, unknown> | undefined;
  if (info?.["title"] && typeof info["title"] === "string") {
    return info["title"];
  }
  // Fall back to filename
  return basename(specPath, ".json").replace(/[-_.]/g, " ");
}

main().catch((err: unknown) => {
  console.error("Error:", err);
  process.exit(1);
});
