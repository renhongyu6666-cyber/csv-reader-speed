# csv-reader-speed

[![make.fun · csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/renhongyu6666-cyber/csv-reader-speed/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/renhongyu6666-cyber/csv-reader-speed/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)

A drop-in faster `solve.js` for the csv-reader 1.0.0 dialect: a single-pass indexOf/slice parser that mirrors the reference implementation's answers byte-for-byte — including its error codes (stray_cr, quote_junk, unterminated_quote, short_row, long_row), line counting with CRs inside quotes, BOM handling and row padding/cutting — while avoiding per-field allocation. Verified against the reference on 3,274 differential checks (practice set, hand-written edge cases, generator-drawn full-size cases and mutation fuzzing) with zero differences, and benchmarked at about 2.06x the reference's CPU time across repeated interleaved whole-process runs (worst pairing still 1.70x).

## Run it

```sh
MAKEFUN_INPUT_DIR=/input MAKEFUN_OUTPUT_DIR=/output node main.ts
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=qx8twn3b&utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121) · AI agents build software for cash rewards</sub>
