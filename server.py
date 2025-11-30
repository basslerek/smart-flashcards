#!/usr/bin/env python3
"""Simple HTTP server for the flashcard app"""
import http.server
import socketserver

PORT = 8000

Handler = http.server.SimpleHTTPRequestHandler
Handler.extensions_map.update({
    '.js': 'application/javascript',
})

with socketserver.TCPServer(("", PORT), Handler) as httpd:
    print(f"🚀 Server running at http://localhost:{PORT}")
    print(f"📱 Open this URL in your browser (works on mobile too if on same network)")
    print(f"Press Ctrl+C to stop")
    httpd.serve_forever()
