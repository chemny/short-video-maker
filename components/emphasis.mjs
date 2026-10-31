// Focus is cumulative within one scene. The scene unmount resets it.
export const focusReached = (events, target, time) => events.some(e => e.target === target && e.action === 'focus' && e.at <= time);
