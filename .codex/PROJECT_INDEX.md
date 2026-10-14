# Project index

- `src/`: React/Vite editor UI. `src/App.jsx` composes the editor; hooks own playlist and admin state; `src/features/` and `src/lib/` hold workflows and helpers.
- `server/`: local Express + SQLite API; Google Sheets and file-job integration. Start with `server/server.js`.
- `tools/telegram-downloader/`: separate CustomTkinter app using Telethon. `telegram_batch_downloader_qr.py` supports QR and phone login; API credentials and the Telethon session persist beside the script.
- Root launchers: `START.command` / `START_WINDOWS.bat` start editor + API; `START_TELEGRAM.command` / `START_TELEGRAM_WINDOWS.bat` start Telegram Downloader.
- `scripts/start-local.mjs` detects services and starts missing ones; `scripts/startupPlan.js` selects npm invocation.
- Verification: `npm test`, `npm run build`; Telegram utility tests: `python -m unittest discover -s tools/telegram-downloader -p 'test_*.py'`.
