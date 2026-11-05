import { meta, type } from "#schema";
import { CjsPaperDollComponent } from "./CjsPaperDollComponent.js";
import { PaperDollLayer, PaperDollPass } from "./paperDollOrder.js";

/** Application-owned facial-hair settings; edits invalidate the doll's update pass. */
@meta.define("CjsPaperDollBeard")
export class CjsPaperDollBeard extends CjsPaperDollComponent
{

    @meta.mapAttribute(meta.READWRITE | meta.PERSIST | meta.NOTIFY)
    @type.boolean
    @meta.ui.description("Beard")
    enabled = true;

    @meta.mapAttribute(meta.READWRITE | meta.PERSIST | meta.NOTIFY)
    @type.string
    @meta.ui.description("Style")
    option = "";

    static layer = PaperDollLayer.BEARD;

    static passes = PaperDollPass.HEAD;

    static category = "beard";

}
