# Record the review tour

Start the demo on port 5197. Use a headless Playwright CLI browser.

```sh
playwright-cli -s=inkline-tour open http://localhost:5197
playwright-cli -s=inkline-tour run-code --filename=docs/verification/recording/art-tour.js
playwright-cli -s=inkline-tour --raw eval 'JSON.stringify(window.__inklineTour)' > docs/verification/recording/metadata.json
ffmpeg -y -i public/review/inkline-tour.webm -c:v libx264 -preset fast -crf 20 -pix_fmt yuv420p -movflags +faststart -an public/review/inkline-tour.mp4
python3 scripts/finalize-review.py
playwright-cli -s=inkline-tour close
```

The capture script uses the app controls and normal keyboard input. It waits for the completed parkour route. It records chapter times and screenshots. It does not change the game simulation or replace the models with concept art.

The capture script contains an output path near its start. Set this path to the local app before recording from a different checkout.

After the production build starts on port 4197, run `check-review.js` through the same CLI. It checks video metadata, chapter seeking, and the phone layout.

Use Vite preview for this playback check. It supports HTTP byte-range requests. The temporary Python recording server does not support those requests and can prevent chapter seeking in a large MP4 before the complete file loads.

## Comparison and phone films

Run `kinetic-compare.js` with the saved baseline on port 5298 and the current audit build on port 5297. Run `phone-tour.js` and `phone-review.js` with the production app on port 4197. The phone film uses the on-screen controls at 390 by 844 pixels. It is a desktop browser recording. It does not measure an Android device.

Save `window.__phoneTour` to `phone-metadata.json`. Convert each WebM to H.264 with `yuv420p` and `+faststart`. Keep the recorded playback timing. Run `python3 scripts/check-secondary-videos.py` to decode both complete MP4 files, compare their durations with the WebM originals, and make frame sheets. Run `python3 scripts/check-review-video.py` for the main tour. Then check the review page.

## Complete clip review

Run `python3 scripts/build-motion-review.py` to publish the final three motion recordings and their 85-clip list. The script converts and fully decodes each MP4. The main review links to `motion-library.html`. The review page check verifies all three videos and its phone layout.
