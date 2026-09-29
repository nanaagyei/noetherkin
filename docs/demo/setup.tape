# Noetherkin terminal demo. Regenerate from the repository root:
#
#   vhs docs/demo/setup.tape
#
# Machine state the recording assumes:
#   - macOS or Linux with Node.js 24+, npm, git and bash, and VHS 0.12+ (which brings ttyd and ffmpeg).
#   - Claude Code installed and signed in. Role judgments (the onboarding baseline and the design review) are real
#     model calls through Claude Code, so each render differs in wording. Nothing is scripted or faked.
#   - The Codex CLI also on PATH. setup asks one skills question per detected agent, and this tape answers two.
#   - No other process using /tmp/noetherkin-demo, which docs/demo/prepare.sh deletes and recreates.
#
# The tape installs a tarball packed from this checkout. To record a published release instead, run
#   NOETHERKIN_TGZ=https://github.com/nanaagyei/noetherkin/releases/latest/download/noetherkin.tgz vhs docs/demo/setup.tape
# Everything is written under /tmp/noetherkin-demo: a private npm prefix, the learner folder and its project-level
# skills. The global npm prefix and ~/.claude/skills are never touched. The learner's design is docs/demo/design.md.

Output docs/assets/noetherkin-demo.gif
Output "/tmp/noetherkin-demo-recording.mp4"

Set Shell "bash"
Set FontSize 16
Set Width 1280
Set Height 760
Set Padding 24
Set Framerate 24
Set TypingSpeed 28ms
Set Theme "Catppuccin Mocha"
Set WindowBar Colorful

Hide
Type "bash docs/demo/prepare.sh && export NPM_CONFIG_PREFIX=/tmp/noetherkin-demo/npm NOETHERKIN_ROLE_ADAPTER=claude PS1='$ ' && export PATH=/tmp/noetherkin-demo/npm/bin:$PATH && cd /tmp/noetherkin-demo && clear"
Enter
Wait@300s /^\$$/
Show

Type "npm install -g ./noetherkin.tgz"
Sleep 400ms
Enter
Wait@180s /^\$$/
Sleep 1s

Type "cd ada && noetherkin setup --target ."
Sleep 400ms
Enter
Wait@60s /Claude Code in \.\?/
Sleep 1s
Enter
Wait@60s /Codex in \.\?/
Sleep 800ms
Enter
Wait@30s /Press Enter/
Sleep 800ms
Enter
Wait@30s /Your name:/
Type "Ada"
Enter
Wait@30s /get better at\?/
Type "Build accessible, well-tested UI components"
Enter
Wait@30s /0-7/
Sleep 1s
Type "3"
Enter
Wait@30s /Type "initialize"/
Sleep 2s
Type "initialize"
Enter
Wait@30s /Track to follow/
Sleep 1s
Type "frontend-engineering"
Enter
Wait@30s /Type "select"/
Sleep 1500ms
Type "select"
Enter
Wait@30s /Onboard now\?/
Sleep 1s
Enter
Wait@30s /Type "onboard"/
Sleep 1500ms
Type "onboard"
Enter
Wait@300s /^\$$/
Sleep 5s

Type "clear"
Enter
Type "noetherkin project select accessible-data-table --source accessible-data-table"
Sleep 400ms
Enter
Wait@60s /^\$$/
Sleep 3s

Type "noetherkin next"
Sleep 400ms
Enter
Wait@60s /^\$$/
Sleep 5s

Type "clear"
Enter
Type "noetherkin next"
Sleep 400ms
Enter
Wait@60s /^\$$/
Sleep 2s

Type "clear"
Enter
Type "cat design.md"
Sleep 400ms
Enter
Sleep 5s
Type "noetherkin task submit-design --file design.md"
Sleep 400ms
Enter
Wait@300s /^\$$/
Sleep 8s
