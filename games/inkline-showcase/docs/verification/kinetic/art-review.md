# Independent art direction review

Historical record: Release 1.2. Current release checks are in the quality correction reports.

Review target: local Inkline build at port 5197.

The review used Chromium at speed 1 with full motion. It used a 1440 by 900 viewport and a 390 by 844 viewport. Combat used an unarmed standard figure. The figure moved to the first target before the attack. Overview used its normal automatic showcase loop. The browser closed after capture.

The normal speed samples are in [sequence.json](art-review/sequence.json). The sample times are about 0.12 seconds for windup, 0.28 seconds before contact, 0.37 seconds at contact, and 0.55 seconds in recovery. The stage also ran at normal speed for the overview samples in [samples.json](art-review/samples.json).

The top three visible quality gaps are:

1. **The attacker has little body weight during contact.** In [combat-desktop-contact.png](art-review/combat-desktop-contact.png) and [combat-phone-contact.png](art-review/combat-phone-contact.png), the target recoils and the impact mark reads. The black attacker keeps an upright pelvis and fixed feet while only the arm reaches forward. The windup and recovery therefore read as arm changes on a static body. Add a small shoulder and hip follow-through in the authored punch and kick poses. Keep the root position collision-safe. Return the body to the idle line before the next action.

2. **Movement accents are too quiet at desktop scale.** The run sample reports active movement effects, but the desktop frames show only small dark marks near the feet. They can read as floor noise. The phone frames show the marks more clearly. Increase the shape separation or contrast slightly for the first frame of a stop or landing. Keep the effect below the feet and short in time so it does not compete with the contact star.

3. **The wide overview loses action detail on the phone.** [overview-desktop.png](art-review/overview-desktop.png) shows the assembly and the three figures. [overview-phone.png](art-review/overview-phone.png) keeps the full assembly, but the figures are too small for weapon or contact detail. Keep the wide composition. Make the existing camera choice or panel control provide a clear close view for one figure. Do not zoom the full assembly until it clips.

The phone shell has one separate navigation issue. [phone-ui-overview.png](art-review/phone-ui-overview.png) shows the first part of the horizontal mode strip. [phone-ui-combat.png](art-review/phone-ui-combat.png) starts at District, Combat, and Parkour after Combat is selected. There is no visible scroll cue. Keep the selected mode in view and add a small edge cue or compact mode selector so users can find Overview and the other modes.

The combat action is readable after these limits. The target moves back at contact, the impact star sits at the chest, and the trail ends before recovery. The phone frame keeps the player and target clear above the input panel. The overview remains a useful assembly view when the user needs the full district context.

The local audit page produced one favicon 404 during browser capture. The runtime state had no load error, page error, or scene error.
