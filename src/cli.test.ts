import * as assert from "assert";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { Test } from "./index.js";
import { abortActiveRuns } from "./run.js";
import { resolveOptions } from "./config.js";
import { BaseReporter } from "./reporter/index.js";
import {
  dropFlags,
  findBinary,
  runCli,
  runWithCoverage,
  watchFiles,
  type CliHost,
} from "./cli.js";

/** Test classes are built fresh per run, a class may only be executed once. */
type Modules = Record<string, () => any>;

// Swaps stdout, stderr and the working directory of the whole process, none
// of which survives a neighbour running at the same time.
export class CliTest extends Test({ exclusive: true }) {
  root!: string;
  loaded: string[] = [];

  before() {
    this.root = fs.mkdtempSync(path.join(os.tmpdir(), "nole-cli-"));

    fs.writeFileSync(path.join(this.root, "alpha.test.ts"), "");
    fs.writeFileSync(path.join(this.root, "beta.test.ts"), "");
  }

  _glob(name = "*.test.ts") {
    return path.join(this.root, name);
  }

  _host(argv: string[], modules: Modules = {}): CliHost {
    this.loaded = [];

    return {
      argv: ["/bin/node", "nole", ...argv],
      version: "0.0.0-test",
      binPath: path.join(this.root, "nole.js"),
      loadFile: async (file: string) => {
        this.loaded.push(path.basename(file));

        const factory = modules[path.basename(file)];

        return factory ? factory() : {};
      },
    };
  }

  /**
   * Captures both streams. These runs are supposed to fail, so their reports
   * and error messages must not leak into the surrounding run.
   */
  async _quiet<T>(fn: () => Promise<T>): Promise<{ value: T; out: string }> {
    const stdout = process.stdout.write;
    const stderr = process.stderr.write;
    let out = "";

    const capture = (chunk: any) => {
      out += chunk;
      return true;
    };

    (process.stdout as any).write = capture;
    (process.stderr as any).write = capture;

    try {
      const value = await fn();

      // colours depend on whether the outer run has a terminal, assertions
      // should not
      return { value, out: out.replace(/\u001b\[[0-9;]*m/g, "") };
    } finally {
      (process.stdout as any).write = stdout;
      (process.stderr as any).write = stderr;
    }
  }

  async _run(argv: string[], modules: Modules = {}) {
    const { value, out } = await this._quiet(() =>
      runCli(this._host(argv, modules)),
    );

    return { code: value, out };
  }

  async passes() {
    const { code, out } = await this._run([this._glob(), "--no-color"], {
      "alpha.test.ts": () => ({
        CliPassing: class CliPassing extends Test() {
          one() {}
          two() {}
        },
      }),
    });

    assert.equal(code, 0);
    assert.ok(out.includes("Nole tests v0.0.0-test"));
    assert.ok(out.includes("2 passed"), out);
    assert.ok(out.includes("discover:"));
  }

  async failsWithExitCodeOne() {
    const { code, out } = await this._run([this._glob(), "--no-color"], {
      "alpha.test.ts": () => ({
        CliFailing: class CliFailing extends Test() {
          boom() {
            throw new Error("cli kaboom");
          }
          stillRuns() {}
        },
      }),
    });

    assert.equal(code, 1);
    assert.ok(out.includes("cli kaboom"));
    assert.ok(out.includes("1 passed"), "the rest of the class still ran");
    assert.ok(out.includes("1 failed"));
  }

  async bailStopsEarly() {
    const { code, out } = await this._run(
      [this._glob(), "--no-color", "--bail"],
      {
        "alpha.test.ts": () => ({
          CliBail: class CliBail extends Test() {
            boom() {
              throw new Error("stop here");
            }
            neverRuns() {
              assert.fail("bail should have stopped the run");
            }
          },
        }),
      },
    );

    assert.equal(code, 1);
    assert.ok(out.includes("run stopped early"));
    assert.ok(out.includes("1 blocked"), out);
  }

  async grepFilters() {
    const { code, out } = await this._run(
      [this._glob(), "--no-color", "--grep", "wanted"],
      {
        "alpha.test.ts": () => ({
          CliGrep: class CliGrep extends Test() {
            wanted() {}
            somethingElse() {
              assert.fail("should have been filtered out");
            }
          },
        }),
      },
    );

    assert.equal(code, 0);
    assert.ok(out.includes("1 passed"));
    assert.ok(out.includes("1 filtered"), out);
  }

  async retriesFlakySpecs() {
    let attempts = 0;

    const { code, out } = await this._run(
      [this._glob(), "--no-color", "--retries", "2"],
      {
        "alpha.test.ts": () => ({
          CliFlaky: class CliFlaky extends Test() {
            unstable() {
              if (++attempts < 3) throw new Error("not yet");
            }
          },
        }),
      },
    );

    assert.equal(code, 0);
    assert.equal(attempts, 3);
    assert.ok(out.includes("1 flaky"), out);
  }

  async writesReportFiles() {
    const junit = path.join(this.root, "out", "results.xml");
    const json = path.join(this.root, "out", "results.json");

    const { code } = await this._run(
      [
        this._glob(),
        "--no-color",
        "--reporter",
        "dot",
        "--report",
        `junit:${junit}`,
        "--report",
        `json:${json}`,
      ],
      {
        "alpha.test.ts": () => ({
          CliReported: class CliReported extends Test() {
            works() {}
          },
        }),
      },
    );

    assert.equal(code, 0);
    assert.ok(fs.readFileSync(junit, "utf8").includes('name="works"'));
    assert.equal(
      JSON.parse(fs.readFileSync(json, "utf8")).summary.passed,
      1,
    );
  }

  async readsAConfigFile() {
    const config = path.join(this.root, "custom.config.ts");

    fs.writeFileSync(config, "");

    const { code, out } = await this._run(
      ["--no-color", "--config", config],
      {
        "custom.config.ts": () => ({
          default: { globs: [this._glob("beta.test.ts")], bail: true },
        }),
        "beta.test.ts": () => ({
          CliConfigured: class CliConfigured extends Test() {
            fromConfig() {}
          },
        }),
      },
    );

    assert.equal(code, 0);
    assert.ok(out.includes("CliConfigured.fromConfig"), out);
    assert.ok(this.loaded.includes("custom.config.ts"));
  }

  async usesAReporterFromTheConfigFile() {
    const seen: string[] = [];
    const config = path.join(this.root, "reporter.config.ts");

    fs.writeFileSync(config, "");

    class Recording extends BaseReporter {
      specResult(result: any) {
        seen.push(`${result.className}.${result.specName}:${result.status}`);
      }
    }

    const { code, out } = await this._run(["--config", config], {
      "reporter.config.ts": () => ({
        default: {
          globs: [this._glob("beta.test.ts")],
          reporter: (write: any) => new Recording(write),
        },
      }),
      "beta.test.ts": () => ({
        CliCustomReported: class CliCustomReported extends Test() {
          works() {}
        },
      }),
    });

    assert.equal(code, 0);
    assert.deepEqual(seen, ["CliCustomReported.works:ok"]);
    assert.equal(out, "", "the built in reporter is replaced, not added to");
  }

  async setupFilesRunFirst() {
    const setup = path.join(this.root, "setup.ts");

    fs.writeFileSync(setup, "");

    const { code } = await this._run(
      [this._glob("beta.test.ts"), "--no-color", "--setup", setup],
      {
        "beta.test.ts": () => ({
          CliSetup: class CliSetup extends Test() {
            works() {}
          },
        }),
      },
    );

    assert.equal(code, 0);
    assert.equal(this.loaded[0], "setup.ts", "setup is loaded before discovery");
  }

  async timeoutOverride() {
    const { code, out } = await this._run(
      [this._glob(), "--no-color", "--timeout", "10"],
      {
        "alpha.test.ts": () => ({
          CliSlow: class CliSlow extends Test({ timeout: 60_000 }) {
            async slow() {
              await new Promise((resolve) => setTimeout(resolve, 60));
            }
          },
        }),
      },
    );

    assert.equal(code, 1);
    assert.ok(out.includes("Timeout occurred"), out);
  }

  async runsClassesInParallel() {
    const order: string[] = [];

    const { code } = await this._run(
      [this._glob(), "--no-color", "--concurrency", "2", "--wait", "1"],
      {
        "alpha.test.ts": () => ({
          CliSlowClass: class CliSlowClass extends Test() {
            async slow() {
              order.push("slow:start");
              await new Promise((resolve) => setTimeout(resolve, 40));
              order.push("slow:end");
            }
          },
          CliFastClass: class CliFastClass extends Test() {
            fast() {
              order.push("fast");
            }
          },
        }),
      },
    );

    assert.equal(code, 0);
    assert.deepEqual(order, ["slow:start", "fast", "slow:end"]);
  }

  async complainsAboutMissingFiles() {
    const { code } = await this._run([this._glob("nothing-*.test.ts")]);

    assert.equal(code, 1);
  }

  async complainsAboutMissingGlobs() {
    const { code, out } = await this._run(["--no-config"]);

    assert.equal(code, 1);
    assert.ok(out.includes("Usage"), out);
  }

  async complainsAboutBadOptions() {
    assert.equal((await this._run([this._glob(), "-r", "nope"])).code, 1);
    assert.equal(
      (await this._run([this._glob(), "--report", "results.xml"])).code,
      1,
    );
    assert.equal(
      (await this._run([this._glob(), "--retries", "loads"])).code,
      1,
    );
  }

  async reportsLoadFailures() {
    const { code } = await this._run([this._glob()], {
      "alpha.test.ts": () => {
        throw new Error("broken import");
      },
    });

    assert.equal(code, 1);
  }

  async reportsWhenThereAreNoSpecs() {
    const { code } = await this._run([this._glob()], {});

    assert.equal(code, 1);
  }

  async interruptedRunsDoNotReportSuccess() {
    const { code, out } = await this._run([this._glob(), "--no-color"], {
      "alpha.test.ts": () => ({
        CliInterrupted: class CliInterrupted extends Test() {
          stops() {
            // exactly what the ctrl+c handler does
            abortActiveRuns();
          }

          never() {
            assert.fail("must not run");
          }
        },
      }),
    });

    assert.equal(code, 130, "the conventional code for an interrupted process");
    assert.ok(out.includes("run stopped early"));
  }

  dropsFlagsForChildProcesses() {
    assert.deepEqual(dropFlags(["a", "--watch", "-w", "b"], ["--watch", "-w"]), [
      "a",
      "b",
    ]);
  }

  findsLocalBinaries() {
    assert.ok(findBinary("c8"), "c8 is a dev dependency of this repo");
    assert.equal(findBinary("definitely-not-installed"), null);
  }

  async coverageNeedsC8() {
    const cwd = process.cwd();

    process.chdir(this.root);

    try {
      // no node_modules above a temporary directory, so c8 cannot be found
      const { value, out } = await this._quiet(() =>
        runWithCoverage(this._host([]), []),
      );

      assert.equal(value, 1);
      assert.ok(out.includes("--coverage needs c8"), out);
    } finally {
      process.chdir(cwd);
    }
  }

  async watchRerunsOnChange() {
    const cwd = process.cwd();
    const watched = path.join(this.root, "watched");

    fs.mkdirSync(watched);

    // the marker lives outside the watched tree, otherwise writing it would
    // trigger the very rerun we are counting
    const runs = path.join(this.root, "runs.txt");
    const fakeBin = path.join(this.root, "fake-bin.js");

    fs.writeFileSync(
      fakeBin,
      `require("fs").appendFileSync(${JSON.stringify(runs)}, "run\\n");`,
    );
    fs.writeFileSync(runs, "");

    const report = path.join(watched, "results.xml");

    process.chdir(watched);

    const controller = new AbortController();
    const settle = () => new Promise((resolve) => setTimeout(resolve, 200));
    const count = () =>
      fs.readFileSync(runs, "utf8").trim().split("\n").filter(Boolean).length;

    let afterReport = 0;
    let afterChange = 0;

    try {
      const { value } = await this._quiet(async () => {
        const finished = watchFiles(
          { ...this._host(["--watch"]), binPath: fakeBin },
          resolveOptions({ reports: [{ name: "junit", file: report }] }),
          controller.signal,
          10,
        );

        await settle();

        // a report the run itself writes must not start the next run
        fs.writeFileSync(report, "<testsuites />");
        await settle();
        afterReport = count();

        fs.writeFileSync(path.join(watched, "trigger.ts"), "// changed");
        await settle();
        afterChange = count();

        controller.abort();

        return finished;
      });

      assert.equal(value, 0);
    } finally {
      process.chdir(cwd);
    }

    assert.equal(afterReport, 1, "the report write triggered a rerun");
    assert.ok(
      afterChange > afterReport,
      `a source change should rerun, went from ${afterReport} to ${afterChange}`,
    );
  }

  cleanUp() {
    fs.rmSync(this.root, { recursive: true, force: true });
  }
}
