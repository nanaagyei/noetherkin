#!/usr/bin/env bash
# Hidden preparation for docs/demo/setup.tape. Builds an isolated demo directory so the recording touches
# nothing else: a private npm prefix, a learner folder, and the example design the learner submits.
set -euo pipefail
demo=/tmp/noetherkin-demo
rm -rf "$demo" && mkdir -p "$demo/ada"
if [[ -n "${NOETHERKIN_TGZ:-}" ]]; then
  # A release recording: NOETHERKIN_TGZ=https://github.com/nanaagyei/noetherkin/releases/latest/download/noetherkin.tgz
  if [[ "$NOETHERKIN_TGZ" == http* ]]; then curl -fsSL -o "$demo/noetherkin.tgz" "$NOETHERKIN_TGZ"; else cp "$NOETHERKIN_TGZ" "$demo/noetherkin.tgz"; fi
else
  # Default: the current checkout, packed exactly as a release would be.
  npm pack --silent --pack-destination "$demo" >/dev/null && mv "$demo"/noetherkin-*.tgz "$demo/noetherkin.tgz"
fi
cp docs/demo/design.md "$demo/ada/design.md"
