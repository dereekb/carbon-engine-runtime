/**
 * Placeholder for the JavaScript struct value handler.
 *
 * This is a type handler, not a trait or a new Carbon VARTYPE. It is
 * disconnected from existing readers, writers and values operations.
 *
 * @cjs No single Carbon donor: reserves the future shared value-handler boundary.
 * @notImplemented Embedded-struct population and value extraction; operation signatures remain under review.
 */
export class CjsStructType
{
  // Future: take over the embedded-struct population and value extraction
  // currently implemented by DictReader/DictWriter and the values service.
  // Preserve their shared-reference and lifecycle contracts during migration;
  // this placeholder does not delegate to them or replace them yet.

  /** Stable identity for the future handler. */
  static className = "CjsStructType";
}
