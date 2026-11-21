// Array.isArray narrows to unknown[], not TypeScript's any[], so an element
// read from outside data stays unknown until it's narrowed
// (CODING_STANDARDS.md, TypeScript: outside data enters as unknown). With
// any[], an element reached typed code unchecked, which no-unsafe-* lint
// misses when it flows into an unknown parameter: #262's comments read did.
// A value already typed keeps its own array type (a ContentValue union's
// readonly ContentValue[]); only what isn't typed as one becomes unknown[].
// This overload is the one TypeScript picks: an augmentation's members come
// before the lib's. tests/unit/array-is-array.test.ts holds both.
interface ArrayConstructor {
  isArray<T>(
    arg: T
  ): arg is [Extract<T, readonly unknown[]>] extends [never]
    ? T & unknown[]
    : Extract<T, readonly unknown[]>;
}
