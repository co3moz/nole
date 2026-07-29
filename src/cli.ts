import { Command } from "commander";
import { glob } from "glob";
import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { colors, FAILED_TEXT } from "./const.js";
import {
  parseReportTarget,
  parseReporter,
  resolveOptions,
  type NoleOptions,
  type ResolvedOptions,
} from "./config.js";
import { findConfigFile } from "./loader.js";
import {
  createReporter,
  MultiReporter,
  resolveReporter,
  type Reporter,
} from "./reporter/index.js";
import { abortActiveRuns, createRunContext, ManualRun } from "./run.js";
import { activeLocations, recordSpec, type RunContext } from "./context.js";
import { TEST_CLASS_KEY } from "./symbol.js";
import { TimeDifference } from "./utils/time_difference.js";
import { Delay } from "./utils/time_factor.js";
import type { BaseTest } from "./core.js";

export interface CliHost {
  argv: string[];
  version: string;
  /** absolute path of bin/nole.js, needed to re-spawn for --watch and --coverage */
  binPath: string;
  /** loads a file with the loader that matches its module format */
  loadFile(file: string): Promise<any>;
}

/** The conventional exit code for a process stopped by ctrl+c. */
const INTERRUPTED = 130;

/** Collects a repeatable option into an array. */
function collect(value: string, previous: string[]) {
  return previous.concat([value]);
}

function failed(message: string) {
  console.error(colors.bold(colors.red(" (failed) " + message)));
}

/** Buffers a report and writes it out once the run is over. */
class FileTarget {
  private chunks: string[] = [];

  constructor(readonly file: string) {}

  write = (chunk: string) => {
    this.chunks.push(chunk);
  };

  persist() {
    const target = path.resolve(process.cwd(), this.file);

    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, this.chunks.join(""));
  }
}

export async function runCli(host: CliHost): Promise<number> {
  const program = new Command();

  program
    .name("nole")
    .usage("<glob> ... [options]")
    .argument("[globs...]", "test file globs, quote them so nole expands them")
    .option("-b, --bail", "stop as soon as something fails")
    .option(
      "-t, --grep <pattern>",
      "only run specs matching ClassName.specName, /regex/ is supported",
    )
    .option("--timeout <ms>", "override the timeout of every spec and hook")
    .option("--retries <n>", "extra attempts before a failing spec is reported")
    .option("-c, --concurrency <n>", "how many test classes may run at once")
    .option("-r, --reporter <name>", "spec, dot, json, tap or junit")
    .option(
      "--report <reporter:file>",
      "also write a report to a file, repeatable",
      collect,
      [],
    )
    .option("-s, --setup <file>", "load a file before discovery, repeatable", collect, [])
    .option("--config <file>", "path to a nole config file")
    .option("--no-config", "ignore any nole.config.* file")
    .option("--wait <ms>", "delay before the run, for late dynamic tests")
    .option("--spec-skip-prefix <prefix>", "methods with this prefix are helpers")
    .option("-w, --watch", "rerun when a file changes")
    .option("--coverage", "run the suite through c8")
    .option("--no-color", "disable coloured output")
    .allowExcessArguments(true)
    .version(host.version)
    .parse(host.argv);

  const opts = program.opts();

  if (opts.coverage) {
    return runWithCoverage(host, dropFlags(host.argv.slice(2), ["--coverage"]));
  }

  let options: ResolvedOptions;

  try {
    const cli: NoleOptions = {};

    if (program.args.length) cli.globs = program.args;
    if (opts.bail) cli.bail = true;
    if (opts.grep) cli.grep = opts.grep;
    if (opts.timeout !== undefined) cli.timeout = opts.timeout;
    if (opts.retries !== undefined) cli.retries = opts.retries;
    if (opts.concurrency !== undefined) cli.concurrency = opts.concurrency;
    if (opts.reporter) cli.reporter = parseReporter(opts.reporter);
    if (opts.report.length) cli.reports = opts.report.map(parseReportTarget);
    if (opts.setup.length) cli.setup = opts.setup;
    if (opts.wait !== undefined) cli.wait = opts.wait;
    if (opts.specSkipPrefix) cli.specSkipPrefix = opts.specSkipPrefix;

    let fileOptions: NoleOptions = {};

    if (opts.config !== false) {
      const configFile =
        typeof opts.config === "string" ? opts.config : findConfigFile();

      if (configFile) {
        const loaded = await host.loadFile(
          path.resolve(process.cwd(), configFile),
        );

        fileOptions = loaded?.default ?? loaded ?? {};
      }
    }

    options = resolveOptions(cli, fileOptions);
  } catch (e) {
    failed((e as Error).message);
    return 1;
  }

  if (!options.globs.length) {
    program.outputHelp();
    return 1;
  }

  if (opts.watch) {
    return watchFiles(host, options);
  }

  return execute(host, options);
}

async function execute(
  host: CliHost,
  options: ResolvedOptions,
): Promise<number> {
  const time = TimeDifference.begin();

  let files: string[];

  try {
    files = await expand(options.globs);
  } catch (e) {
    failed("Error occurred on resolving files");
    console.error((e as Error).stack ?? e);
    return 1;
  }

  if (!files.length) {
    failed("0 files found");
    return 1;
  }

  const discover = time.end();

  const targets = options.reports.map((report) => new FileTarget(report.file));
  const reporters: Reporter[] = [
    resolveReporter(options.reporter, (chunk) => process.stdout.write(chunk)),
  ];

  options.reports.forEach((report, index) => {
    reporters.push(createReporter(report.name, targets[index].write));
  });

  const reporter = new MultiReporter(reporters);
  const ctx = createRunContext({ reporter, options });
  const tests = new Set<new () => BaseTest>();

  try {
    for (const file of options.setup) {
      await host.loadFile(path.resolve(process.cwd(), file));
    }

    for (const file of files) {
      const module = await host.loadFile(file);

      for (const key in module) {
        const value = module[key];

        if (!value || !value[TEST_CLASS_KEY]) {
          continue;
        }

        tests.add(value);
      }
    }
  } catch (e) {
    failed("Error occurred while loading test files");
    console.error((e as Error).stack ?? e);
    return 1;
  }

  const resolved = time.end() - discover;

  reporter.runStart({ version: host.version, files, options });

  const detach = installProcessGuards(ctx);

  let exitCode = 0;

  try {
    if (options.wait) {
      await Delay(options.wait);
    }

    const summary = await ManualRun(tests, ctx);

    reporter.runEnd(summary, {
      discover,
      resolve: resolved,
      tests: summary.duration,
    });

    // an interrupted run never reports success, even when nothing failed yet
    exitCode =
      summary.failed || ctx.failed ? 1 : summary.aborted ? INTERRUPTED : 0;
  } catch (e) {
    if ((e as Error).message === "No specs found") {
      failed("no specs found");
    } else {
      console.error((e as Error).stack ?? e);
    }

    exitCode = 1;
  } finally {
    detach();

    await reporter.finalize();

    for (const target of targets) {
      try {
        target.persist();
      } catch (e) {
        failed(`could not write ${target.file}`);
        console.error((e as Error).stack ?? e);
        exitCode = 1;
      }
    }
  }

  return exitCode;
}

/**
 * Attributes stray async errors to whatever is running and lets the run finish
 * instead of tearing the process down mid spec.
 */
function installProcessGuards(ctx: RunContext) {
  let interrupts = 0;

  const stray = (kind: string) => (error: unknown) => {
    const where = activeLocations();

    recordSpec(ctx, {
      className: where[0]?.split(".")[0] ?? "process",
      specName: `${kind}${where.length ? ` during ${where.join(", ")}` : ""}`,
      status: "failed",
      duration: 0,
      timeout: 0,
      attempts: 1,
      flaky: false,
      error,
    });
  };

  const onRejection = stray("unhandled rejection");
  const recordException = stray("uncaught exception");

  const onException = (error: unknown) => {
    // The reader of our stdout went away (`nole ... | head`); there is nothing
    // left to report to, so leave quietly instead of blocking on a dead pipe.
    if ((error as NodeJS.ErrnoException)?.code === "EPIPE") {
      process.exit(ctx.failed ? 1 : 0);
    }

    recordException(error);
  };

  const onPipeError = (error: NodeJS.ErrnoException) => {
    if (error?.code === "EPIPE") {
      // nobody is reading any more, but the exit code still has to be honest
      process.exit(ctx.failed ? 1 : 0);
    }
  };

  process.stdout.on("error", onPipeError);
  process.stderr.on("error", onPipeError);

  const onInterrupt = () => {
    if (++interrupts > 1) {
      process.exit(INTERRUPTED);
    }

    console.error(
      colors.yellow(
        "\ninterrupted, running cleanup hooks... (press ctrl+c again to force)",
      ),
    );

    abortActiveRuns();
  };

  process.on("unhandledRejection", onRejection);
  process.on("uncaughtException", onException);
  process.on("SIGINT", onInterrupt);
  process.on("SIGTERM", onInterrupt);

  return () => {
    process.off("unhandledRejection", onRejection);
    process.off("uncaughtException", onException);
    process.off("SIGINT", onInterrupt);
    process.off("SIGTERM", onInterrupt);
    process.stdout.off("error", onPipeError);
    process.stderr.off("error", onPipeError);
  };
}

async function expand(globs: string[]): Promise<string[]> {
  const lists = await Promise.all(globs.map((pattern) => glob(pattern)));
  const files: string[] = [];

  for (const list of lists) {
    for (const item of list) {
      files.push(path.resolve(process.cwd(), item));
    }
  }

  return files;
}

export function dropFlags(argv: string[], flags: string[]): string[] {
  return argv.filter((arg) => !flags.includes(arg));
}

/** Re-runs nole in a child process wrapped in the locally installed c8. */
export function runWithCoverage(
  host: CliHost,
  args: string[],
): Promise<number> {
  const c8 = findBinary("c8");

  if (!c8) {
    failed(
      "--coverage needs c8, install it with `npm i -D c8` or run your own coverage tool",
    );

    return Promise.resolve(1);
  }

  return new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      [c8, process.execPath, host.binPath, ...args],
      { stdio: "inherit" },
    );

    child.on("exit", (code) => resolve(code ?? 1));
    child.on("error", (e) => {
      failed(e.message);
      resolve(1);
    });
  });
}

export function findBinary(name: string): string | null {
  let dir = process.cwd();

  while (true) {
    const candidate = path.join(dir, "node_modules", ".bin", name);

    if (fs.existsSync(candidate)) {
      return candidate;
    }

    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

const IGNORED_DIRS = ["node_modules", ".git", "coverage", ".nyc_output"];

/**
 * Absolute path with symlinks resolved. A file that does not exist yet only
 * gets the treatment for the directory it will live in.
 */
function realPath(file: string): string {
  const full = path.resolve(process.cwd(), file);

  try {
    return path.join(fs.realpathSync(path.dirname(full)), path.basename(full));
  } catch {
    return full;
  }
}

/**
 * Watch mode runs every pass in a child process; that is the only way to make
 * sure changed modules are actually reloaded. It keeps going until the signal
 * is aborted, which for the command line means until the user quits.
 */
export function watchFiles(
  host: CliHost,
  options: ResolvedOptions,
  signal?: AbortSignal,
  debounce = 100,
): Promise<number> {
  const args = dropFlags(host.argv.slice(2), ["--watch", "-w"]);

  // Paths are compared after resolving symlinks, otherwise a watched directory
  // that is reached through one (/var on macOS) never matches.
  const root = realPath(process.cwd());

  // A run that writes its report into the watched tree would otherwise trigger
  // the next run, and that one the next.
  const written = new Set(
    options.reports.map((report) => realPath(report.file)),
  );

  let child: ReturnType<typeof spawn> | null = null;
  let queued = false;
  let timer: NodeJS.Timeout | null = null;
  let watcher: fs.FSWatcher;

  const start = () => {
    queued = false;
    child = spawn(process.execPath, [host.binPath, ...args], {
      stdio: "inherit",
    });

    child.on("exit", () => {
      child = null;

      // a change arrived mid run, so we are not idle at all
      if (queued) {
        start();
        return;
      }

      console.log(colors.grey("\nwatching for changes, ctrl+c to quit"));
    });
  };

  const trigger = () => {
    if (timer) {
      clearTimeout(timer);
    }

    timer = setTimeout(() => {
      timer = null;

      // a run is still going, stop it and start over once it is gone
      if (child) {
        queued = true;
        child.kill("SIGTERM");
        return;
      }

      start();
    }, debounce);
  };

  try {
    watcher = fs.watch(process.cwd(), { recursive: true }, (_e, filename) => {
      if (!filename) return;

      const parts = filename.split(path.sep);

      if (parts.some((part) => IGNORED_DIRS.includes(part))) return;

      const changed = path.resolve(root, filename);

      // On macOS every change is echoed as a change of the watch root itself,
      // reported under the root's own name and resolving to nothing. Letting it
      // through would defeat every ignore below it.
      if (filename === path.basename(root) && !fs.existsSync(changed)) return;

      if (written.has(changed)) return;

      trigger();
    });
  } catch (e) {
    failed("watch mode is not supported on this platform");
    console.error((e as Error).stack ?? e);
    return Promise.resolve(1);
  }

  start();

  return new Promise<number>((resolve) => {
    const stop = () => {
      if (timer) clearTimeout(timer);

      queued = false;
      watcher.close();
      child?.kill("SIGTERM");
      resolve(0);
    };

    if (signal) {
      signal.addEventListener("abort", stop, { once: true });
    }
  });
}
