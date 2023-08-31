import { app } from "../../scripts/app.js";
import { BaseNodeModeChanger } from "./base_node_mode_changer.js";
const MODE_BYPASS = 4;
const MODE_ALWAYS = 0;
class BypasserNode extends BaseNodeModeChanger {
    constructor(title = BypasserNode.title) {
        super(title);
        this.modeOn = MODE_ALWAYS;
        this.modeOff = MODE_BYPASS;
    }
}
BypasserNode.title = "Fast Bypasser (rgthree)";
app.registerExtension({
    name: "rgthree.Bypasser",
    registerCustomNodes() {
        BypasserNode.setUp(BypasserNode);
    },
    loadedGraphNode(node) {
        if (node.type == BypasserNode.title) {
            node._tempWidth = node.size[0];
        }
    }
});
