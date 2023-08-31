// / <reference path="../node_modules/litegraph.js/src/litegraph.d.ts" />
// @ts-ignore
import { app } from "../../scripts/app.js";
import type {LLink, LGraph, ContextMenuItem, LGraphCanvas, SerializedLGraphNode, LGraphNode as TLGraphNode, LiteGraph as TLiteGraph, IContextMenuOptions, ContextMenu} from './typings/litegraph.js';
import { addConnectionLayoutSupport, wait } from "./utils.js";
// @ts-ignore
import { ComfyWidgets } from "../../scripts/widgets.js";
// @ts-ignore
import { BaseCollectorNode } from './base_node_collector.js';

declare const LiteGraph: typeof TLiteGraph;


/** Legacy "Combiner" */
class CollectorNode extends BaseCollectorNode {

  static override type = "Node Collector (rgthree)";
  static override title = "Node Collector (rgthree)";

  static legacyType = "Node Combiner (rgthree)";

}


/** Legacy "Combiner" */
class CombinerNode extends CollectorNode {
  static override legacyType = "Node Combiner (rgthree)";
  static override title = "‼️ Node Combiner [DEPRECATED]";

  constructor(title = CombinerNode.title) {
    super(title);

    const note = ComfyWidgets["STRING"](this, "last_seed", ["STRING", { multiline: true }], app).widget;
    note.inputEl.value = 'The Node Combiner has been renamed to Node Collector. You can right-click and select "Update to Node Collector" to attempt to automatically update.';
    note.inputEl.readOnly = true;
    note.inputEl.style.backgroundColor = '#332222';
    note.inputEl.style.fontWeight = 'bold';
    note.inputEl.style.fontStyle = 'italic';
    note.inputEl.style.opacity = '0.8';

		this.getExtraMenuOptions = (_: LGraphCanvas, options: ContextMenuItem[]) => {
      options.splice(options.length - 1, 0,
        {
          content: "‼️ Update to Node Collector",
          callback: (_value: ContextMenuItem, _options: IContextMenuOptions, _event: MouseEvent, _parentMenu: ContextMenu | undefined, _node: TLGraphNode) => {
            updateCombinerToCollector(this);
          }
        }
      );
    }
  }

  override configure(info: SerializedLGraphNode) {
    super.configure(info);
    if (this.title != CombinerNode.title && !this.title.startsWith('‼️')) {
      this.title = '‼️ ' + this.title;
    }
  }
}


/**
 * Updates a Node Combiner to a Node Collector.
 */
async function updateCombinerToCollector(node: TLGraphNode) {
  if (node.type === CollectorNode.legacyType) {
    // Create a new CollectorNode.
    const newNode = new CollectorNode();
    if (node.title != CombinerNode.title) {
      newNode.title = node.title.replace('‼️ ', '');
    }
    // Port the position, size, and properties from the old node.
    newNode.pos = [...node.pos];
    newNode.size = [...node.size];
    newNode.properties = {...node.properties};
    // We now collect the links data, inputs and outputs, of the old node since these will be
    // lost when we remove it.
    const links: any[] = [];
    for (const [index, output] of node.outputs.entries()) {
      for (const linkId of (output.links || [])) {
        const link: LLink = (app.graph as LGraph).links[linkId]!;
        if (!link) continue;
        const targetNode = app.graph.getNodeById(link.target_id);
        links.push({node: newNode, slot: index, targetNode, targetSlot: link.target_slot});
      }
    }
    for (const [index, input] of node.inputs.entries()) {
      const linkId = input.link;
      if (linkId) {
        const link: LLink = (app.graph as LGraph).links[linkId]!;
        const originNode = app.graph.getNodeById(link.origin_id);
        links.push({node: originNode, slot: link.origin_slot, targetNode: newNode, targetSlot: index});
      }
    }
    // Add the new node, remove the old node.
    app.graph.add(newNode);
    await wait();
    // Now go through and connect the other nodes up as they were.
    for (const link of links) {
      link.node.connect(link.slot, link.targetNode, link.targetSlot);
    }
    await wait();
    app.graph.remove(node);
  }
}


app.registerExtension({
	name: "rgthree.NodeCollector",
	registerCustomNodes() {
    // @ts-ignore: Fix incorrect litegraph typings.
    addConnectionLayoutSupport(CollectorNode, app, [['Left','Right'],['Right','Left']]);

		LiteGraph.registerNodeType(CollectorNode.title, CollectorNode);
    CollectorNode.category = CollectorNode._category;
	},
});


app.registerExtension({
	name: "rgthree.NodeCombiner",
	registerCustomNodes() {
    // @ts-ignore: Fix incorrect litegraph typings.
    addConnectionLayoutSupport(CombinerNode, app, [['Left','Right'],['Right','Left']]);

		LiteGraph.registerNodeType(CombinerNode.legacyType, CombinerNode);
    CombinerNode.category = CombinerNode._category;
	},
});

