/**
 * Backend re-export of the canonical API contract.
 *
 * The single source of truth now lives in the `@client-iptv/shared` workspace
 * package (FND-01 / issue #5). This thin re-export keeps the existing backend
 * imports (`../types/api.js`) working unchanged — every DTO, the `Dimension`
 * union, the `DIMENSIONS` constant, `Paginated`, `ApiError`, `StreamStatus`,
 * etc. are sourced from the shared package.
 */
export * from '@client-iptv/shared'
