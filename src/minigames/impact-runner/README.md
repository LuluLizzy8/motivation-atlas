# Impact Runner

Motivator: Sensation. Author: @alexhekmat.

## Mechanic

Clear line-drawn trash bins with a jumping stick figure on an automatically scrolling course.
Choose **Start run**, then use **Space**, **Up arrow**, or the **Jump** button
(mouse or touch). Keyboard shortcuts work while the game controls have focus.
You can only jump from the ground. Touching a trash bin ends the run immediately;
survive 90 seconds to finish. Restart whenever you want. Cleared bins keep moving until they leave the screen. The course repeats at
a steady speed, with the same bin spacing on every run.

The **Sensation effects and animations** checkbox switches exaggerated visual feedback
on and off: an alternating running stride, a tucked-leg jump pose, flames on
takeoff and when clearing a bin, and a burst on landing. Airborne flames point
below the runner while rising and return above its feet while falling. With effects off,
the figure keeps a plain fixed pose as it moves through the same jump arc.
Change it during play or between runs. Speed, jump height, collisions, and score
are identical in both settings. A hidden browser tab pauses progression.

## Dynamic

Players time repeated jumps to avoid trash bins. With effects enabled, each jump
and clearance produces an extra visual response. My design hypothesis is that
this feedback encourages repetition and makes successful jumps more satisfying;
it may instead distract some players. This is an interpretation to test, not a
dynamic established by the cited sources.

For my playtest, a friend who is not in the class played first with effects off
and then with effects on. After trying both, he said he would always choose the
version with effects and animations. This supports a preference for repeating
the enhanced version, but I did not measure changes in jump timing, performance,
or how long he kept playing. His stated preference is not evidence of increased
long-term play.

## Aesthetic

The intended feeling is sensation: energetic, satisfying movement. Does the
same jump feel more powerful with flames? Was the feedback exciting, distracting,
or irrelevant? Did switching the mechanic change your actions or feelings?
The player’s report tests the intended effect; excitement is not guaranteed.

With effects off, my friend's first remark was that it was just like the Google
Dino game. With effects on, he described it as more engaging and a little more
stimulating to watch, even though the game itself was very simple. He said he
would always choose this version over the one without effects and animations.
For this player, the added sensory feedback made the same basic game more
appealing, supporting the intended Sensation contrast. This is one player's
immediate response; it does not establish that everyone will prefer the effects
or that they will increase engagement over time.

## Sources

Exact excerpts from the course note, **Sensation, thrill, and destruction**:

- “Sensation, "game as sense-pleasure" (Hunicke et al. 2004, p. 2); the paper names no dynamics for it.”
- “Animation that adds urgency, like Bookworm's burning letters (Lazzaro 2004b, sec. 1b).”
- “Guns, explosions, gore, and destructible environments (Quantic Foundry reference sheet, p. 15), and tools to "blow things up" (p. 8).”

The animation and explosion examples inform the visual-feedback mechanic here;
this game does not reproduce Bookworm’s urgency rule or simulate destruction.

**Codex suggestion and my decision:** I asked Codex whether the player should
move with left/right arrow keys or whether I should make an auto-scrolling
runner like the Google Dino game. Codex recommended the auto-scrolling runner
to keep the controls simple and focus attention on the visual-feedback toggle.
I accepted that suggestion because it fit the scope of this Motivation Atlas
project: a small game demonstrating one mechanic of one motivator.

**Playtest evidence:** The Dynamic and Aesthetic observations above come from
my friend's playtest and feedback, as reported by me. The comparison to the
Google Dino game records his reaction, rather than a claim from the course note.

## Credits

**AI Disclaimer:** Codex created the game based on my ideas and created the README
with my input, including my design decisions and playtest feedback. I worked
with Codex to shape both to fit the scope of this Motivation Atlas project.

Original rules, SVG stick figure, trash bins, and effects made for this project with
Codex. Uses the Atlas DOM helpers and copied minigame template. No external art,
sound, libraries, or network requests are used by the minigame.
