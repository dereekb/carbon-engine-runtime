import { meta } from "#schema";
import { CjsBlueGraph } from "../../blue/formats/graph/CjsBlueGraph.js";
import { EveStation2 } from "../../trinity/eve/spaceObject/EveStation2.js";
import { TnySpaceObject } from "./TnySpaceObject.js";

/** A station or structure (EveStation2). Ours, after ccpwgl's TnyStationary. */
@meta.define({ className: "TnyStationary" })
@meta.exposureChainTo(TnySpaceObject)
export class TnyStationary extends TnySpaceObject
{
    static wrappedClass = EveStation2;
}

CjsBlueGraph.define(TnyStationary, "TnyStationary");
