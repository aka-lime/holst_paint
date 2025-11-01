export function extractSessionId(pathname) {
    const match = pathname.match(/\/session\/([^/]+)/);
    return match && match[1] ? decodeURIComponent(match[1]) : null;
}
