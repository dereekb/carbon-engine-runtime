// Source: blueexposure/include/BlueTypes.h:216-262 (Be::VARTYPE)

/**
 * Carbon's storage-type identifiers, including reserved gaps and sentinels.
 * Python entries retain their native identities; declaring them does not
 * provide Python value handling in JavaScript.
 *
 * Carbon: Be::VARTYPE (blueexposure/include/BlueTypes.h:216-262)
 */
export const VARTYPE = Object.freeze({
  INVALID: 0,
  LONG: 1,
  FLOAT: 2,
  DOUBLE: 3,
  BOOL: 4,
  IROOT: 5,
  IROOTPTR: 6,
  CHARARRAY: 7,
  CSTRING: 8,
  INT64: 9,
  PYOBJECT: 10,
  PYOBJECTPTR: 11,
  REFERENCE: 12,
  WCSTRING: 13,
  WREFERENCE: 14,
  FLOATARRAY: 15,
  DOUBLEARRAY: 16,
  INTARRAY: 17,
  ROTREFERENCE: 20,
  IROOTWEAKREF: 21,
  _PYPROPERTY: 22,
  STDSTRING: 23,
  STDWSTRING: 24,
  BINARYBLOCK: 25,
  BYTE: 31,
  SHORT: 32,
  SCRIPTCALLBACK: 33,
  SHAREDSTRING: 34,
  SHAREDSTRINGW: 35,
  ULONG: 36,
  UINT64: 37,
  VARTYPE_MAX: 37,
  VARTYPE_FORCELONG: 0xFFFFFFFF
});
