import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import { describe, expect, it } from "vitest";

const sourceRoot = resolve(process.cwd(), "src");

function toPosixPath(path: string) {
  return path.split("\\").join("/");
}

function listSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      return listSourceFiles(path);
    }

    return /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

function hasUseClientDirective(source: string) {
  return /^\uFEFF?\s*(?:(?:\/\/[^\n]*\n)|(?:\/\*[\s\S]*?\*\/\s*))*["']use client["'];/.test(
    source,
  );
}

function hasRuntimeServerAuthImport(source: string) {
  const staticImports = source.match(/import[\s\S]*?from\s+["'][^"']+["'];?/g);
  const staticExports = source.match(/export[\s\S]*?from\s+["'][^"']+["'];?/g);
  const importOrExportBlocks = [
    ...(staticImports ?? []),
    ...(staticExports ?? []),
  ];

  return (
    importOrExportBlocks.some(
      (block) =>
        !/^(import|export)\s+type\b/.test(block.trim()) &&
        /from\s+["']@\/server\/auth(?:\/[^"']*)?["']/.test(block),
    ) || /import\s*\(\s*["']@\/server\/auth(?:\/[^"']*)?["']\s*\)/.test(source)
  );
}

describe("architecture boundaries", () => {
  it("keeps server auth modules out of Client Components at runtime", () => {
    const offenders = listSourceFiles(sourceRoot)
      .filter((path) => {
        const source = readFileSync(path, "utf8");
        return (
          hasUseClientDirective(source) && hasRuntimeServerAuthImport(source)
        );
      })
      .map((path) => toPosixPath(relative(process.cwd(), path)));

    expect(offenders).toEqual([]);
  });

  it("keeps contact Zod contracts free of email-list exports", () => {
    const contactSource = readFileSync(
      join(sourceRoot, "zod/contact.ts"),
      "utf8",
    );

    expect(contactSource).not.toMatch(
      /\bexport\s+(?:const|let|var|function|class|interface|type|enum)\s+emailList[A-Za-z0-9_]*/,
    );
    expect(contactSource).not.toMatch(
      /\bexport\s*\{[^}]*emailList[A-Za-z0-9_]*[^}]*\}/,
    );
  });

  it("keeps DB helper imports inside the DB layer", () => {
    const offenders = listSourceFiles(sourceRoot)
      .filter(
        (path) =>
          !toPosixPath(relative(sourceRoot, path)).startsWith("server/db/"),
      )
      .filter((path) =>
        /from\s+["']@\/server\/db\/helpers(?:\/[^"']*)?["']/.test(
          readFileSync(path, "utf8"),
        ),
      )
      .map((path) => toPosixPath(relative(process.cwd(), path)));

    expect(offenders).toEqual([]);
  });
});
