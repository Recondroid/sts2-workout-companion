"""Slay the Spire 2 Workout Companion -- tiny static file server.

Zero dependencies: uses only the Python standard library, so it runs on any
machine with stock Python 3.7+. Serves the files next to this script and opens
your default browser. Stop it with Ctrl-C.
"""

import functools
import os
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

HOST = "127.0.0.1"
PREFERRED_PORT = 8000
# Try a handful of ports in case the preferred one is busy.
PORT_RANGE = range(PREFERRED_PORT, PREFERRED_PORT + 20)


def main() -> None:
    here = os.path.dirname(os.path.abspath(__file__))
    handler = functools.partial(SimpleHTTPRequestHandler, directory=here)

    httpd = None
    for port in PORT_RANGE:
        try:
            httpd = ThreadingHTTPServer((HOST, port), handler)
            break
        except OSError:
            continue

    if httpd is None:
        raise SystemExit(
            f"Could not bind to any port in {PORT_RANGE.start}-{PORT_RANGE.stop - 1}. "
            "Close whatever is using them and try again."
        )

    url = f"http://{HOST}:{httpd.server_address[1]}"
    print(f"Slay the Spire 2 Workout Companion running at {url}")
    print("Opening your browser... (press Ctrl-C here to stop)")
    webbrowser.open(url)

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down. Bye!")
    finally:
        httpd.server_close()


if __name__ == "__main__":
    main()
