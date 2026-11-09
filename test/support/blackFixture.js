// Black files written by hand, for tests that pin what Carbon's reader reads: the header, the narrow and
// wide string tables, and objects as reference, size, class and members (BlackReader.cpp).
export const concat = parts =>
{
    const bytes = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
    let offset = 0;
    for (const part of parts) { bytes.set(part, offset); offset += part.length; }
    return bytes;
};
export const bytesOf = (size, write) => { const bytes = new Uint8Array(size); write(new DataView(bytes.buffer)); return bytes; };
export const u8 = value => Uint8Array.of(value);
export const u16 = value => bytesOf(2, view => view.setUint16(0, value, true));
export const i32 = value => bytesOf(4, view => view.setInt32(0, value, true));
export const u32 = value => bytesOf(4, view => view.setUint32(0, value, true));
export const f32 = value => bytesOf(4, view => view.setFloat32(0, value, true));
export const i64 = value => bytesOf(8, view => view.setBigInt64(0, value, true));
export const floats = values => concat(values.map(f32));

/** Writes Black files by hand: Carbon's reader is what these tests pin, not a writer. */
export class Fixture
{
    strings = [];
    wide = [];

    S(value)
    {
        if (!this.strings.includes(value)) this.strings.push(value);
        return u16(this.strings.indexOf(value));
    }

    W(value)
    {
        if (!this.wide.includes(value)) this.wide.push(value);
        return u16(this.wide.indexOf(value));
    }

    /** An object: `Object(0)` is null, `Object(n)` a reference to one already written. */
    Object(reference, className, fields = [])
    {
        if (className === undefined) return u32(reference);
        const body = this.Embedded(className, fields);
        return concat([ u32(reference), body ]);
    }

    /** An object written inside its owner: no reference, a size, a class, its members. */
    Embedded(className, fields = [])
    {
        const body = concat([ this.S(className), ...fields.map(([ name, value ]) => concat([ this.S(name), value ])) ]);
        return concat([ u32(body.length), body ]);
    }

    List(items)
    {
        return concat([ i32(items.length), ...items ]);
    }

    Finish(root)
    {
        const table = (count, data) => concat([ u32(data.length + 2), u16(count), data ]);
        const narrow = concat(this.strings.flatMap(value => [ new TextEncoder().encode(value), u8(0) ]));
        const wide = concat(this.wide.flatMap(value => [ ...Array.from(value, char => u16(char.charCodeAt(0))), u16(0) ]));
        return concat([ u32(0xb1acf11e), u32(1), table(this.strings.length, narrow), table(this.wide.length, wide), root ]);
    }
}
