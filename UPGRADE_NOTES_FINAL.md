# SiraChat – consolidated media upgrade

Applied to the supplied `sirachat(4).zip` source.

## Included source changes
- Multi-file media selection is preserved in the media caption modal and all selected items remain available until send.
- All selected items are shown as thumbnails/preview items and can be removed individually.
- File sending uses concurrent `Promise.all` uploads through the existing upload manager.
- The media modal now supports image editing with a freely resizable crop rectangle, freehand pen strokes, text, and rotation; edited images are rendered to JPEG before sending.
- Video files have an inline preview in the pre-send media panel.
- Camera capture is available directly from the media modal and adds the captured image to the same multi-file queue.
- Upload cancellation and download cancellation use AbortController / the existing upload cancellation manager.
- Voice recording now selects a browser-supported MediaRecorder MIME type, records in short chunks, reports microphone permission failures, and keeps the real duration in a ref so the sent voice duration is not stuck at zero.
- Inline video messages are rendered with a visible poster frame/browser preview before opening the full media viewer.
- Existing image pinch zoom / pan in MediaViewer is retained.
- Existing desktop mouse-glow chat background preset is retained; it follows the pointer with a large blurred radial glow and no hard boundary.

## Important build note
The execution environment used to prepare this archive did not have the project's npm dependencies available locally and the network install timed out. Therefore `npm run build` could not be completed in this environment. The source archive itself is provided so the normal deployment environment can run `npm ci` followed by `npm run build`.
