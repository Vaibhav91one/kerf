// The one narrowing point for every public read of a Project or a Skill.
//
// Its own file, not a helper inside index.ts, because importing index.ts runs
// `app.listen()` — the same reason ratelimit.ts lives apart from its caller.
//
// A private row is ABSENT, never blanked. That is the whole design: blanking the
// fields would still answer 200 for an id that exists and 404 for one that does
// not, which is an existence oracle. Narrowing the row set means a private row
// is indistinguishable from a row that was never published.

/**
 * A `where` fragment: everything public, plus everything the viewer owns.
 *
 * `Project` and `Skill` have the identical `{ handle, isPublic }` shape, so one
 * function serves both. `viewer` is the handle from `optionalHandle(req)` —
 * null for an anonymous read.
 */
export function visibleTo(viewer: string | null) {
  return viewer === null ? { isPublic: true } : { OR: [{ isPublic: true }, { handle: viewer }] };
}
