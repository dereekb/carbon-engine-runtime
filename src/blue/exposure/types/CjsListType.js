/**
 * Placeholder for the JavaScript list value handler.
 *
 * This is a type handler, not a trait or a new Carbon VARTYPE. It is
 * disconnected from existing readers, writers and values operations.
 *
 * @cjs No single Carbon donor: reserves the future shared value-handler boundary.
 * @notImplemented List traversal, element population and collection options; operation signatures remain under review.
 */
export class CjsListType
{
  // Future: take over the list traversal, element population and collection options
  // currently implemented by DictReader/DictWriter and the values service.
  // Preserve their shared-reference and lifecycle contracts during migration;
  // this placeholder does not delegate to them or replace them yet.

  /** Stable identity for the future handler. */
  static className = "CjsListType";
}
