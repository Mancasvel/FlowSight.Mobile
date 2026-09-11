type QueuedWork<T> = () => Promise<T>;

let chain: Promise<unknown> = Promise.resolve();

export function runLocalInference<T>(work: QueuedWork<T>): Promise<T> {
  const run = chain.then(work, work);
  chain = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}
