/**
 * Process an array of items with a concurrency limit to prevent overwhelming the system.
 * @param items Array of items to process
 * @param fn Async function to process each item
 * @param limit Maximum number of concurrent operations (default: 3)
 * @returns Array of results in the same order as input
 */
export async function pLimit<T, R>(
    items: T[],
    fn: (item: T, index: number) => Promise<R>,
    limit: number = 3
): Promise<R[]> {
    const results: R[] = [];
    const executing: Set<Promise<void>> = new Set();

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const promise = fn(item, i).then(result => {
            results[i] = result;
        });

        // Wrap promise to remove itself from executing set upon completion
        const p = promise.then(() => {
            executing.delete(p);
        });

        executing.add(p);

        if (executing.size >= limit) {
            await Promise.race(executing);
        }
    }

    await Promise.all(executing);
    return results;
}
