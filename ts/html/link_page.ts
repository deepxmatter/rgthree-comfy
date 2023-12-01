
import type { SerializedGraph, BadLinksData } from "index";
import { fixBadLinks } from "../link_fixer.js";
// @ts-ignore
import { getPngMetadata } from "../../../scripts/pnginfo.js";


function wait(ms = 16, value?: any) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(value);
    }, ms);
  });
}

const logger = {
  logTo: console as Console | HTMLElement,
  log: (...args: any[]) => {
    logger.logTo === console
      ? console.log(...args)
      : ((logger.logTo as HTMLElement).innerText += args.join(",") + "\n");
  },
};

const findBadLinksLogger = {
  log: async (...args: any[]) => {
    logger.log(...args);
    // await wait(48);
  },
};

export class LinkPage {
  private containerEl: HTMLDivElement;
  private figcaptionEl: HTMLElement;
  private btnFix: HTMLButtonElement;
  private outputeMessageEl: HTMLDivElement;
  private outputImageEl: HTMLImageElement;

  private file?: File | Blob;
  private graph?: SerializedGraph;
  private graphResults?: BadLinksData;
  private graphFinalResults?: BadLinksData;

  constructor() {
    // const consoleEl = document.getElementById("console")!;
    this.containerEl = document.querySelector(".box")!;
    this.figcaptionEl = document.querySelector("figcaption")!;
    this.outputeMessageEl = document.querySelector(".output")!;
    this.outputImageEl = document.querySelector(".output-image")!;
    this.btnFix = document.querySelector(".btn-fix")!;

    // Need to prevent on dragover to allow drop...
    document.addEventListener(
      "dragover",
      (e) => {
        e.preventDefault();
      },
      false,
    );
    document.addEventListener("drop", (e) => {
      this.onDrop(e);
    });
    this.btnFix.addEventListener("click", (e) => {
      this.onFixClick(e);
    });
  }

  private async onFixClick(e: MouseEvent) {
    if (!this.graphResults || !this.graph) {
      this.updateUi("⛔ Fix button click without results.");
      return;
    }
    // Fix
    let graphFinalResults = fixBadLinks(this.graph, true);
    // Confirm
    graphFinalResults = fixBadLinks(graphFinalResults.graph, true);
    // This should have happened, but try to run it through again if there's till an issue.
    if (graphFinalResults.patched || graphFinalResults.deleted) {
      graphFinalResults = fixBadLinks(graphFinalResults.graph, true);
    }
    this.graphFinalResults = graphFinalResults;

    await this.saveFixedWorkflow();

    if (graphFinalResults.hasBadLinks) {
      this.updateUi("⛔ Hmm... Still detecting bad links. Can you file an issue at https://github.com/rgthree/rgthree-comfy/issues with your image/workflow.");
    } else {
      this.updateUi("✅ Workflow fixed.<br><br><small>Please load new saved workflow json and double check linking and execution.</small>");

    }

  }

  private async onDrop(event: DragEvent) {
    if (!event.dataTransfer) {
      return;
    }
    this.reset();

    event.preventDefault();
    event.stopPropagation();

    // Dragging from Chrome->Firefox there is a file but its a bmp, so ignore that
    if (event.dataTransfer.files.length && event.dataTransfer.files?.[0]?.type !== "image/bmp") {
      await this.handleFile(event.dataTransfer.files[0]!);
      return;
    }

    // Try loading the first URI in the transfer list
    const validTypes = ["text/uri-list", "text/x-moz-url"];
    const match = [...event.dataTransfer.types].find((t) => validTypes.find((v) => t === v));
    if (match) {
      const uri = event.dataTransfer.getData(match)?.split("\n")?.[0];
      if (uri) {
        await this.handleFile(await (await fetch(uri)).blob());
      }
    }
  }

  reset() {
    this.file = undefined;
    this.graph = undefined;
    this.graphResults = undefined;
    this.graphFinalResults = undefined;
    this.updateUi();
  }

  private updateUi(msg?: string) {
    this.outputeMessageEl.innerHTML = "";
    if (this.file && !this.containerEl.classList.contains("-has-file")) {
      this.containerEl.classList.add("-has-file");
      this.figcaptionEl.innerHTML = (this.file as File).name || this.file.type;
      if (this.file.type === "application/json") {
        this.outputImageEl.src = "icon_file_json.png";
      } else {
        const reader = new FileReader();
        reader.onload = () => (this.outputImageEl.src = reader.result as string);
        reader.readAsDataURL(this.file);
      }
    } else if (!this.file && this.containerEl.classList.contains("-has-file")) {
      this.containerEl.classList.remove("-has-file");
      this.outputImageEl.src = "";
      this.outputImageEl.removeAttribute("src");
    }

    if (this.graphResults) {
      this.containerEl.classList.add("-has-results");
      if (!this.graphResults.patched && !this.graphResults.deleted) {
        this.outputeMessageEl.innerHTML = "✅ No bad links detected in the workflow.";
      } else {
        this.containerEl.classList.add("-has-fixable-results");
        this.outputeMessageEl.innerHTML = `⚠️ Found ${this.graphResults.patched} links to fix, and ${this.graphResults.deleted} to be removed.`;
      }
    } else {
      this.containerEl.classList.remove("-has-results");
      this.containerEl.classList.remove("-has-fixable-results");
    }

    if (msg) {
      this.outputeMessageEl.innerHTML = msg;
    }
  }

  private async handleFile(file: File | Blob) {
    this.file = file;
    this.updateUi();

    let workflow: string | null = null;
    if (file.type.startsWith("image/")) {
      const pngInfo = await getPngMetadata(file);
      workflow = pngInfo?.workflow;
    } else if (
      file.type === "application/json" ||
      (file instanceof File && file.name.endsWith(".json"))
    ) {
      workflow = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          resolve(reader.result as string);
        };
        reader.readAsText(file);
      });
    }
    if (!workflow) {
      this.updateUi("⛔ No workflow found in dropped item.");
    } else {
      try {
        this.graph = JSON.parse(workflow);
      } catch (e) {
        this.graph = undefined;
      }
      if (!this.graph) {
        this.updateUi("⛔ Invalid workflow found in dropped item.");
      } else {
        this.loadGraphData(this.graph);
      }
    }
  }

  private async loadGraphData(graphData: SerializedGraph) {
    this.graphResults = await fixBadLinks(graphData);
    this.updateUi();
  }

  private async saveFixedWorkflow() {
    if (!this.graphFinalResults) {
      this.updateUi("⛔ Save w/o final graph patched.");
      return false;
    }

    let filename: string|null = (this.file as File).name || 'workflow.json';
    let filenames = filename.split('.');
    filenames.pop();
    filename = filenames.join('.');
    filename += '_fixed.json';
    filename = prompt("Save workflow as:", filename);
    if (!filename) return false;
    if (!filename.toLowerCase().endsWith(".json")) {
      filename += ".json";
    }
    const json = JSON.stringify(this.graphFinalResults.graph, null, 2);
    const blob = new Blob([json], {type: "application/json"});
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.download = filename;
    anchor.href = url;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    await wait();
    anchor.click();
    await wait();
    anchor.remove();
    window.URL.revokeObjectURL(url);
    return true;
  }
}

