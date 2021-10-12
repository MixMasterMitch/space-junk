export function memcpy<T extends Float32Array>(src: T, srcOffset: number, dst: T, dstOffset: number, length: number): T {
    const srcSubArray = srcOffset ? src.subarray(srcOffset, length && srcOffset + length) : src;
    dst.set(srcSubArray, dstOffset);
    return dst;
}

export function isEqual(a: ArrayLike<number>, b: ArrayLike<number>): boolean {
    if (a.length !== b.length) {
        return false;
    }
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) {
            return false;
        }
    }
    return true;
}
