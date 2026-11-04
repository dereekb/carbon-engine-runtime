const STAGE_NAMES = new Set([ "vertex", "pixel", "compute" ]);
// Structurally valid DXBC stage kinds that the WGSL packager cannot lower yet:
// there is no WGSL geometry/hull/domain stage. These fail closed as unsupported
// rather than being misreported as malformed records.
const KNOWN_UNSUPPORTED_STAGE_NAMES = new Set([ "geometry", "hull", "domain" ]);

export { normalizeEffectPermutation, validateResolvedPermutation } from "../../../format/effect/effectPermutationSelection.js";

function validateStageRecords(stages)
{
    if (!Array.isArray(stages))
    {
        throw new TypeError("Effect analysis stages must be an array");
    }

    const keys = new Set();

    for (const [ index, stage ] of stages.entries())
    {
        const expected = `${stage?.techniqueName}.pass${stage?.passIndex}.${stage?.stageName}`;

        if (!stage || typeof stage.techniqueName !== "string" || !stage.techniqueName
            || !Number.isInteger(stage.passIndex) || stage.passIndex < 0
            || stage.key !== expected)
        {
            throw new Error(`Effect analysis stage ${index} is malformed`);
        }

        if (!STAGE_NAMES.has(stage.stageName))
        {
            if (KNOWN_UNSUPPORTED_STAGE_NAMES.has(stage.stageName))
            {
                throw new Error(
                    `WGSL effect stage ${expected} kind ${stage.stageName} is not supported`
                );
            }

            throw new Error(`Effect analysis stage ${index} is malformed`);
        }

        if (keys.has(stage.key))
        {
            throw new Error(`Effect analysis contains duplicate stage ${stage.key}`);
        }

        keys.add(stage.key);
    }

    const stagesByPass = new Map();
    for (const stage of stages)
    {
        const passKey = `${stage.techniqueName}.pass${stage.passIndex}`;
        if (!stagesByPass.has(passKey)) stagesByPass.set(passKey, []);
        stagesByPass.get(passKey).push(stage.stageName);
    }
    for (const [ passKey, stageNames ] of stagesByPass)
    {
        if (stageNames.includes("compute")
            && (stageNames.length !== 1 || stageNames[0] !== "compute"))
        {
            throw new Error(`WGSL effect pass ${passKey} cannot mix compute and render stages`);
        }
    }
}

/**
 * Select complete analysis stages for WGSL emission.
 *
 * @param {object[]} stages Complete analysis stage list.
 * @param {object|null} selection Optional technique/pass/stage assertion.
 * @returns {object[]} Selected stage records in analysis order.
 */
export function selectEffectStages(stages, selection)
{
    validateStageRecords(stages);

    if (!selection)
    {
        return stages.slice();
    }

    const techniqueName = String(selection.techniqueName ?? "");
    const passIndex = selection.passIndex ?? null;
    const stageNames = Array.isArray(selection.stageNames) ? selection.stageNames : [];
    const techniqueStages = stages.filter((stage) => stage.techniqueName === techniqueName);

    if (!techniqueStages.length)
    {
        throw new Error(`Unknown effect technique ${techniqueName}`);
    }

    const selected = passIndex === null
        ? techniqueStages
        : techniqueStages.filter((stage) => stage.passIndex === passIndex);

    if (!selected.length)
    {
        throw new Error(`Unknown effect pass ${techniqueName}.pass${passIndex}`);
    }

    if (stageNames.length)
    {
        const requested = new Set(stageNames);
        const actual = new Set(selected.map((stage) => stage.stageName));
        const missing = stageNames.filter((stageName) => !actual.has(stageName));
        const unexpected = Array.from(actual).filter((stageName) => !requested.has(stageName));

        if (missing.length || unexpected.length)
        {
            throw new Error(
                `Stage assertion for ${techniqueName}.pass${passIndex} is incomplete: `
                + `missing ${missing.join(",") || "none"}; unlisted ${unexpected.join(",") || "none"}`
            );
        }
    }

    return selected;
}

/**
 * Build explicit selection provenance for Carbon WebGPU metadata.
 *
 * @param {object|null} selection Optional technique/pass/stage assertion.
 * @param {object[]} selectedStages Selected analysis stage records.
 * @returns {object|null} Selection metadata.
 */
export function buildWgslSelectionMetadata(selection, selectedStages)
{
    if (!selection)
    {
        return null;
    }

    const selectedStageNames = Array.from(new Set(selectedStages.map((stage) => stage.stageName)));

    return {
        mode: "explicit",
        completePasses: true,
        techniqueName: selection.techniqueName,
        passIndex: selection.passIndex ?? null,
        requestedStageNames: selection.stageNames?.length ? selectedStageNames : [],
        selectedStageKeys: selectedStages.map((stage) => stage.key)
    };
}
