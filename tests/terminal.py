"""Exercise the real CLI terminal controller in an isolated test workspace.

This harness supplies test consent only, never consent for a user's workspace.
"""
import json
import os
import pty
import select
import subprocess
import sys
import time

node, executable, workspace, answer, *extra = sys.argv[1:]
mode = extra[0] if extra else "init"
if mode == "onboard":
    command = [node, executable, "onboard", "--workspace", workspace,
               "--constraint", "Java 17 available", "--codex-bin", extra[1], "--json"]
    marker = b'Type "onboard"'
elif mode == "handoff":
    command = [node, executable, "adapter-handoff", "--workspace", workspace, "--handoff", extra[1], "--json"]
    marker = b'to approve: '
elif mode == "track":
    command = [node, executable, "track", "select", "backend-engineering", "--workspace", workspace, "--json"]
    marker = b'Type "select"'
else:
    command = [node, executable, "init", "--workspace", workspace, "--name", "Test learner",
               "--goal", "Understand initialization", "--assistance-max", "3", "--json"]
    marker = b'Type "initialize"'
master, slave = pty.openpty()
process = subprocess.Popen(
    command,
    stdin=slave, stderr=slave, stdout=subprocess.PIPE,
)
os.close(slave)
transcript = b""
deadline = time.monotonic() + 15
sent = False
try:
    while process.poll() is None and time.monotonic() < deadline:
        ready, _, _ = select.select([master], [], [], 0.1)
        if ready:
            try:
                transcript += os.read(master, 65536)
            except OSError:
                break
        if not sent and marker in transcript:
            os.write(master, (answer + "\n").encode())
            sent = True
    if process.poll() is None:
        process.wait(timeout=max(1, deadline - time.monotonic()))
    output = process.stdout.read().decode()
    print(json.dumps({"exit": process.returncode, "prompt_seen": sent,
                      "output": json.loads(output), "terminal": transcript.decode(errors="replace")}))
finally:
    if process.poll() is None:
        process.kill()
        process.wait()
    os.close(master)
