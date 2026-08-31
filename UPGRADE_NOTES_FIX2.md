# SiraChat media fix 2

Applied fixes:
- Restored circular download progress in MediaViewer with real streamed-byte progress when content-length is available.
- Download button becomes a square stop control while downloading; clicking again aborts the transfer.
- Reworked free crop editor to support 8 independent resize handles (corners + edges) plus moving the crop rectangle.
- Drawing now uses functional state updates so rapid pointer movement does not lose strokes.
- Editor image is rendered directly in the full-screen editing surface and cannot intercept pointer input.
- Existing multi-file preview/send behavior remains intact.

Build note: this environment could not complete dependency installation because npm network access timed out, so no successful production build is claimed here.
