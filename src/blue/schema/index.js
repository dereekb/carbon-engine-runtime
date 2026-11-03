import { CJS_CLASS_NAME, CjsSchema } from "./CjsSchema.js";

/** Decorators grouped by vocabulary ownership; stored schema records are unchanged. */
const { meta, type } = CjsSchema;

export { CJS_CLASS_NAME, CjsSchema, CjsSchema as schema, meta, type };
export * from "./types/carbonTypes.js";
export * from "./hydration.js";
