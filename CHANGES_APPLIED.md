# Final requested changes applied

- Saved Messages opens from the main chat list using the same selected-chat route as Settings.
- Folder delete controls removed from the main chat list; deletion remains in Settings > Chat Folder Management.
- Long-press folder reordering added; All Chats remains the fixed first tab.
- Upload cancellation uses AbortController/XHR abort and removes the optimistic upload item.
- Download cancellation uses AbortController; clicking the progress control again stops the download and shows a square stop control.
- MediaViewer download can also be cancelled with the square stop control.
- Desktop interactive mouse-glow background remains available as a built-in preset and uses a large blurred gradient with smooth movement.
- Image caption editor keeps multi-file sending, camera capture, preview, rotation, text, and free-aspect crop handles; crop coordinate calculation uses the actual editor bounds.
- Caption input now uses a textarea; Enter inserts a newline and Ctrl/Cmd+Enter sends.
