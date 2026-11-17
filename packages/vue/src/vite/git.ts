import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

/**
 * When each file of a directory last changed in git, by absolute path: the author date of its last commit, from one
 * `git log` for the whole directory. A file git doesn't know has none, and so has every file outside a repository.
 */
export async function lastCommitDates(dir: string): Promise<Map<string, string>> {
  const dates = new Map<string, string>();
  let output: string;
  try {
    // newest first: each commit is an empty field, its date, then the paths it changed; a merge changes none
    const args = [
      "log",
      "--no-merges",
      "--format=%x00%aI",
      "--name-only",
      "-z",
      "--relative",
      "--",
      ".",
    ];
    output = (await run("git", args, { cwd: dir, maxBuffer: 256 * 1024 * 1024 })).stdout;
  } catch {
    return dates;
  }

  let date: string | undefined;
  let next = false;
  for (const field of output.split("\0")) {
    if (field === "") next = true;
    else if (next) {
      date = new Date(field).toISOString();
      next = false;
    } else if (date) {
      const file = path.join(dir, field.replace(/^\n/, ""));
      if (!dates.has(file)) dates.set(file, date);
    }
  }
  return dates;
}
