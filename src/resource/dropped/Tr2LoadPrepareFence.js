// Source: trinity/trinity/Resources/Tr2LoadPrepareFence.h
// Dropped reference shape. BlueResMan.Wait replaces this native two-queue fence.
// Verify fields against format-carbon resources/Tr2LoadPrepareFence.json.
import { CjsSchema, type } from "#schema";

/**
 * Dropped reference shape; BlueResMan.Wait polls the two queues directly.
 * @adapted No runtime destructor: this class is not exported or acquired. Native Resources/Tr2LoadPrepareFence.cpp:15-18,33-48 cancels two callback IDs and clears onPrepared; Wait creates neither fence callbacks nor those IDs.
 */
export class Tr2LoadPrepareFence
{

  /** m_resourceLoadCbId (CcpAtomic<uint32_t>) */
  resourceLoadCbId = 0;

  /** m_resourcePrepCbId (CcpAtomic<uint32_t>) */
  resourcePrepCbId = 0;

  /** m_reached (bool) */
  reached = true;

}

CjsSchema.define(Tr2LoadPrepareFence, {
  className: "Tr2LoadPrepareFence",
  fields: {
    resourceLoadCbId: type.unknown,
    resourcePrepCbId: type.unknown,
    reached: type.boolean
  }
});
