// Something worth doing that nothing is waiting on, like keeping a result: it must never get in the way of the
// game it came from, so if it fails that is written down and the game goes on
export function inBackground(work: Promise<unknown>, what = "save a result"): void {
  work.catch(error => console.error(`Could not ${what}:`, error))
}
