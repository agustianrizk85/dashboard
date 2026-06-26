/**
 * No-op in the unified dashboard. The standalone app scaled a fixed
 * 1920×1080 #canvas via the document root, which would resize the WHOLE
 * unified shell. Sizing is owned by the unified shell, so this does nothing.
 * The signature is preserved so existing imports keep working.
 */
export function useScale(_elementId = "canvas") {
  void _elementId;
}
