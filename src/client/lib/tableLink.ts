import { ROOM_CODE_LENGTH, ROOM_CODE_CHARSET } from "@shared/constants";

/** The query parameter a table invite carries: https://example.com/?table=6326 */
export const TABLE_PARAM = "table";

/** The link a QR code or shared invite points at. */
export function tableLink(origin: string, roomCode: string): string {
  const url = new URL("/", origin);
  url.searchParams.set(TABLE_PARAM, roomCode);
  return url.toString();
}

/** The table number from an invite link's query string, if it is a well-formed one. */
export function readTableParam(search: string): string | null {
  const raw = new URLSearchParams(search).get(TABLE_PARAM)?.trim().toUpperCase();
  if (!raw || raw.length !== ROOM_CODE_LENGTH) return null;
  return [...raw].every((ch) => ROOM_CODE_CHARSET.includes(ch)) ? raw : null;
}

/**
 * Takes the table number out of the address bar once it has been used, so a refresh or a
 * home-screen bookmark doesn't keep dropping the player back into that invite.
 */
export function clearTableParam(): void {
  const url = new URL(window.location.href);
  if (!url.searchParams.has(TABLE_PARAM)) return;
  url.searchParams.delete(TABLE_PARAM);
  history.replaceState(history.state, "", url.pathname + url.search + url.hash);
}
