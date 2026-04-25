let nextModalZIndex = 1000;

export function acquireModalZIndex() {
  const zIndex = nextModalZIndex;
  nextModalZIndex += 2;
  return zIndex;
}
