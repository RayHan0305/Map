const contextKey = 'beiki-album-context';
const backParam = 'album-return';

function contexts() {
  try {
    const entries = JSON.parse(sessionStorage.getItem(contextKey) ?? '[]');
    return Array.isArray(entries) ? entries : [];
  } catch {
    return [];
  }
}

export function rememberAlbumContext(context) {
  const token = crypto.randomUUID?.() ?? Date.now().toString(36) + Math.random().toString(36).slice(2);
  try {
    sessionStorage.setItem(contextKey, JSON.stringify([...contexts().slice(-19), { token, context }]));
    history.replaceState({ ...history.state, albumReturn: token }, '');
    return token;
  } catch {
    return null;
  }
}

export function readAlbumContext(token) {
  return token ? contexts().find((entry) => entry.token === token)?.context : null;
}

export function returnToken() {
  return history.state?.albumReturn ?? new URLSearchParams(location.search).get(backParam);
}

export function albumHref(id, token) {
  const params = new URLSearchParams({ id });
  if (token) params.set(backParam, token);
  return './album.html?' + params;
}

export function mapHref(token) {
  return token ? './?' + new URLSearchParams({ [backParam]: token }) : './';
}
