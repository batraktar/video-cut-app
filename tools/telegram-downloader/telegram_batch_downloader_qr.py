import asyncio
import csv
import json
import logging
import os
import queue
import re
import sys
import threading
import time
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import customtkinter as ctk
import qrcode
from PIL import Image
from openpyxl import Workbook, load_workbook
from telethon import TelegramClient
from telethon.errors import (
    ChannelPrivateError,
    PasswordHashInvalidError,
    PhoneCodeInvalidError,
    PhoneNumberInvalidError,
    RPCError,
    SessionPasswordNeededError,
)


def qr_box_size(matrix_size: int, display_size: int = 320) -> int:
    if matrix_size < 1 or display_size < 1:
        raise ValueError("matrix_size and display_size must be positive")
    return max(3, display_size // matrix_size)


def should_emit_progress(now: float, last_emit: float, received: int, total_bytes: Optional[int], interval: float = 0.2) -> bool:
    return now - last_emit >= interval or bool(total_bytes and received >= total_bytes)


def append_xlsx_rows(path: Path, rows) -> None:
    rows = list(rows)
    if not rows:
        return
    if path.exists():
        workbook = load_workbook(path)
        sheet = workbook.active
    else:
        workbook = Workbook()
        sheet = workbook.active
        sheet.title = "links"
        sheet.append(["timestamp", "link", "status", "filename", "detail"])
    for row in rows:
        sheet.append(list(row))
    workbook.save(path)
    workbook.close()

# Як отримати API_ID та API_HASH:
# 1) Перейдіть на https://my.telegram.org
# 2) Увійдіть у свій акаунт Telegram
# 3) Оберіть "API development tools" і створіть застосунок
# 4) Скопіюйте API_ID та API_HASH у поля нижче

APP_DIR = Path(sys.executable).resolve().parent if getattr(sys, "frozen", False) else Path(__file__).resolve().parent
BASE_DIR = APP_DIR / "Telegram Uploads"
SESSION_FILE = APP_DIR / "telegram_session"
API_CONFIG_FILE = APP_DIR / "telegram_api.json"
LINK_PATTERN = re.compile(r"https?://t\.me/(?:s/)?(c/)?([A-Za-z0-9_]+)/([0-9]+)")
GLOBAL_MAP_MD = BASE_DIR / "links_map.md"
GLOBAL_MAP_CSV = BASE_DIR / "links_map.csv"
GLOBAL_MAP_XLSX = BASE_DIR / "links_map.xlsx"

def load_api_credentials() -> Tuple[str, str]:
    try:
        saved = json.loads(API_CONFIG_FILE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        saved = {}
    api_id = saved.get("api_id", "") if isinstance(saved, dict) else ""
    api_hash = saved.get("api_hash", "") if isinstance(saved, dict) else ""
    return str(api_id), str(api_hash)


def save_api_credentials(api_id: str, api_hash: str) -> None:
    descriptor = os.open(API_CONFIG_FILE, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(descriptor, "w", encoding="utf-8") as config_file:
        os.chmod(API_CONFIG_FILE, 0o600)
        json.dump({"api_id": api_id, "api_hash": api_hash}, config_file)


SAVED_API_ID, SAVED_API_HASH = load_api_credentials()
DEFAULT_API_ID = os.getenv("TELEGRAM_API_ID", SAVED_API_ID)
DEFAULT_API_HASH = os.getenv("TELEGRAM_API_HASH", SAVED_API_HASH)

logging.basicConfig(level=logging.WARNING)
logging.getLogger("telethon").setLevel(logging.ERROR)


class DownloadStopped(Exception):
    pass


@dataclass
class LinkInfo:
    raw: str
    entity: object
    message_id: int


def parse_links(text: str) -> tuple[List[LinkInfo], int, int]:
    results: List[LinkInfo] = []
    seen = set()
    total = 0
    duplicates = 0

    for match in LINK_PATTERN.finditer(text or ""):
        is_private = bool(match.group(1))
        channel_part = match.group(2)
        message_id = int(match.group(3))
        if is_private:
            # t.me/c/<channel_id>/<message_id> -> entity = -100<channel_id>
            entity = int(f"-100{channel_part}")
        else:
            entity = channel_part

        key = (entity, message_id)
        if key in seen:
            duplicates += 1
            continue
        seen.add(key)
        total += 1
        results.append(LinkInfo(raw=match.group(0), entity=entity, message_id=message_id))
    return results, total, duplicates


def normalize_status(value: str) -> str:
    return (value or "").strip().lower()


def link_key_from_url(url: str) -> Optional[tuple[object, int]]:
    match = LINK_PATTERN.search(url or "")
    if not match:
        return None
    is_private = bool(match.group(1))
    channel_part = match.group(2)
    message_id = int(match.group(3))
    entity = int(f"-100{channel_part}") if is_private else channel_part
    return (entity, message_id)


class PromptDialog(ctk.CTkToplevel):
    def __init__(self, master: ctk.CTk, prompt: str, title: str, is_password: bool = False) -> None:
        super().__init__(master)
        self.title(title)
        self.resizable(False, False)
        self.result = ""

        self.grid_columnconfigure(0, weight=1)

        label = ctk.CTkLabel(self, text=prompt)
        label.grid(row=0, column=0, padx=20, pady=(20, 10), sticky="w")

        self.entry = ctk.CTkEntry(self, width=320)
        if is_password:
            self.entry.configure(show="*")
        self.entry.grid(row=1, column=0, padx=20, pady=(0, 10), sticky="ew")
        self.entry.focus()

        ok_button = ctk.CTkButton(self, text="OK", command=self._on_ok)
        ok_button.grid(row=2, column=0, padx=20, pady=(0, 20), sticky="e")

        self.bind("<Return>", lambda _: self._on_ok())
        self.protocol("WM_DELETE_WINDOW", self._on_close)
        self.grab_set()

    def _on_ok(self) -> None:
        self.result = self.entry.get().strip()
        self.destroy()

    def _on_close(self) -> None:
        self.result = ""
        self.destroy()


class QRLoginDialog(ctk.CTkToplevel):
    def __init__(self, master: ctk.CTk, on_phone_login) -> None:
        super().__init__(master)
        self.title("Telegram QR авторизація")
        self.resizable(False, False)
        self._qr_image = None

        self.grid_columnconfigure(0, weight=1)

        title = ctk.CTkLabel(self, text="Скануйте QR-код у Telegram", font=ctk.CTkFont(size=18, weight="bold"))
        title.grid(row=0, column=0, padx=20, pady=(20, 8), sticky="ew")

        instruction = ctk.CTkLabel(
            self,
            text=(
                "Telegram на телефоні → Settings/Налаштування → Devices/Пристрої "
                "→ Link Desktop Device/Підключити пристрій"
            ),
            wraplength=360,
            justify="center",
        )
        instruction.grid(row=1, column=0, padx=20, pady=(0, 12), sticky="ew")

        self.qr_label = ctk.CTkLabel(self, text="Генерація QR-коду...")
        self.qr_label.grid(row=2, column=0, padx=20, pady=10)

        self.expires_label = ctk.CTkLabel(self, text="")
        self.expires_label.grid(row=3, column=0, padx=20, pady=(0, 10), sticky="ew")

        self.phone_login_button = ctk.CTkButton(
            self, text="Не сканується? Увійти за номером телефону", command=on_phone_login
        )
        self.phone_login_button.grid(row=4, column=0, padx=20, pady=(0, 20), sticky="ew")

        self.protocol("WM_DELETE_WINDOW", self._on_close)
        self.grab_set()

    def _on_close(self) -> None:
        # Закриття вікна не зупиняє авторизацію. Для зупинки натисніть "Стоп" у головному вікні.
        self.withdraw()

    def update_qr(self, url: str, expires_text: str = "") -> None:
        qr = qrcode.QRCode(
            version=None,
            error_correction=qrcode.constants.ERROR_CORRECT_M,
            box_size=1,
            border=4,
        )
        qr.add_data(url)
        qr.make(fit=True)
        qr.box_size = qr_box_size(len(qr.get_matrix()))
        image: Image.Image = qr.make_image(fill_color="black", back_color="white").convert("RGB")

        self._qr_image = ctk.CTkImage(light_image=image, dark_image=image, size=image.size)
        self.qr_label.configure(image=self._qr_image, text="")
        self.expires_label.configure(text=f"QR активний до: {expires_text}" if expires_text else "")
        self.deiconify()
        self.lift()
        self.focus()


class TelegramBatchDownloader(ctk.CTk):
    def __init__(self) -> None:
        super().__init__()
        ctk.set_appearance_mode("System")
        ctk.set_default_color_theme("blue")

        self.title("Telegram Batch Downloader")
        self.geometry("900x650")
        self.minsize(800, 600)

        self._queue: "queue.Queue[dict]" = queue.Queue()
        self._worker: Optional[threading.Thread] = None
        self._running = False
        self._pause_event = threading.Event()
        self._stop_event = threading.Event()
        self._paused = False
        self._mapping_lock = threading.Lock()
        self._pending_global_xlsx_rows: List[List[str]] = []
        self._global_seen_keys: set[tuple[object, int]] = set()
        self._qr_dialog: Optional[QRLoginDialog] = None
        self._phone_login_async_event: Optional[asyncio.Event] = None
        self._auth_loop: Optional[asyncio.AbstractEventLoop] = None

        self._build_ui()
        self.after(150, self._process_queue)

    def _build_ui(self) -> None:
        self.grid_columnconfigure(0, weight=1)
        self.grid_rowconfigure(3, weight=1)

        header = ctk.CTkLabel(self, text="Telegram Batch Downloader", font=ctk.CTkFont(size=22, weight="bold"))
        header.grid(row=0, column=0, padx=20, pady=(20, 10), sticky="w")

        settings = ctk.CTkFrame(self)
        settings.grid(row=1, column=0, padx=20, pady=(0, 10), sticky="ew")
        settings.grid_columnconfigure((1, 3), weight=1)

        ctk.CTkLabel(settings, text="API_ID").grid(row=0, column=0, padx=10, pady=10, sticky="w")
        self.api_id_entry = ctk.CTkEntry(settings)
        self.api_id_entry.grid(row=0, column=1, padx=10, pady=10, sticky="ew")
        self.api_id_entry.insert(0, DEFAULT_API_ID)
        self.api_id_entry.bind("<FocusOut>", self._save_api_credentials)

        ctk.CTkLabel(settings, text="API_HASH").grid(row=0, column=2, padx=10, pady=10, sticky="w")
        self.api_hash_entry = ctk.CTkEntry(settings)
        self.api_hash_entry.grid(row=0, column=3, padx=10, pady=10, sticky="ew")
        self.api_hash_entry.insert(0, DEFAULT_API_HASH)
        self.api_hash_entry.bind("<FocusOut>", self._save_api_credentials)

        ctk.CTkLabel(settings, text="Паралельно").grid(row=1, column=0, padx=10, pady=(0, 10), sticky="w")
        self.parallel_entry = ctk.CTkEntry(settings, width=80)
        self.parallel_entry.grid(row=1, column=1, padx=10, pady=(0, 10), sticky="w")
        self.parallel_entry.insert(0, "2")

        qr_note = ctk.CTkLabel(settings, text="Вхід через QR-код або номер телефону")
        qr_note.grid(row=1, column=2, columnspan=2, padx=10, pady=(0, 10), sticky="w")

        actions = ctk.CTkFrame(self, fg_color="transparent")
        actions.grid(row=2, column=0, padx=20, pady=(0, 10), sticky="ew")
        actions.grid_columnconfigure(0, weight=1)

        buttons = ctk.CTkFrame(actions, fg_color="transparent")
        buttons.grid(row=0, column=0, padx=0, pady=(0, 10), sticky="w")

        self.start_button = ctk.CTkButton(buttons, text="Paste & Download", command=self._on_start)
        self.start_button.grid(row=0, column=0, padx=(0, 10))

        self.pause_button = ctk.CTkButton(buttons, text="Пауза", command=self._on_pause, state="disabled")
        self.pause_button.grid(row=0, column=1, padx=(0, 10))

        self.stop_button = ctk.CTkButton(buttons, text="Стоп", command=self._on_stop, state="disabled")
        self.stop_button.grid(row=0, column=2)

        self.progress = ctk.CTkProgressBar(actions)
        self.progress.grid(row=1, column=0, padx=0, pady=(0, 6), sticky="ew")
        self.progress.set(0.0)

        self.status_label = ctk.CTkLabel(actions, text="Готово до роботи")
        self.status_label.grid(row=2, column=0, padx=0, pady=(0, 6), sticky="w")

        self.file_progress = ctk.CTkProgressBar(actions)
        self.file_progress.grid(row=3, column=0, padx=0, pady=(0, 6), sticky="ew")
        self.file_progress.set(0.0)

        self.file_status_label = ctk.CTkLabel(actions, text="Файл: —")
        self.file_status_label.grid(row=4, column=0, padx=0, pady=(0, 10), sticky="w")

        log_frame = ctk.CTkFrame(self)
        log_frame.grid(row=3, column=0, padx=20, pady=(0, 20), sticky="nsew")
        log_frame.grid_rowconfigure(0, weight=1)
        log_frame.grid_columnconfigure(0, weight=1)

        self.log_box = ctk.CTkTextbox(log_frame, wrap="word")
        self.log_box.grid(row=0, column=0, sticky="nsew")
        self.log_box.configure(state="disabled")

    def _on_start(self) -> None:
        if self._running:
            return

        clipboard_text = self._get_clipboard_text()
        links, total_count, duplicates_count = parse_links(clipboard_text)
        if not links:
            self._append_log("[WARN] У буфері обміну не знайдено Telegram-посилань.")
            return

        api_id_raw = self.api_id_entry.get().strip()
        api_hash = self.api_hash_entry.get().strip()
        parallel_raw = self.parallel_entry.get().strip()

        if not api_id_raw.isdigit() or not api_hash:
            self._append_log("[ERR] Заповніть API_ID та API_HASH.")
            return
        if not parallel_raw.isdigit() or int(parallel_raw) < 1:
            self._append_log("[ERR] Поле 'Паралельно' має бути числом >= 1.")
            return

        api_id = int(api_id_raw)
        try:
            save_api_credentials(api_id_raw, api_hash)
        except OSError as error:
            self._append_log(f"[ERR] Не вдалося зберегти API-дані: {error}")
            return
        max_parallel = int(parallel_raw)
        if max_parallel > 3:
            max_parallel = 3
            self._append_log("[INFO] Паралельність обмежена до 3 для стабільної роботи.")
        out_dir = self._prepare_output_dir()
        self._append_log(f"[INFO] Створено папку: {out_dir}")

        self._stop_event.clear()
        self._pause_event.clear()
        self._paused = False
        self.pause_button.configure(text="Пауза")

        self._set_running(True)
        self.progress.set(0.0)
        self.status_label.configure(text=f"Обробка {total_count} посилань")
        if duplicates_count:
            self._append_log(
                f"[INFO] Дублікатів: {duplicates_count}. Повтори не завантажуються вдруге, але збережуться у таблиці."
            )

        self._worker = threading.Thread(
            target=self._run_worker,
            args=(links, api_id, api_hash, out_dir, max_parallel),
            daemon=True,
        )
        self._worker.start()

    def _save_api_credentials(self, _event=None) -> None:
        api_id = self.api_id_entry.get().strip()
        api_hash = self.api_hash_entry.get().strip()
        if api_id.isdigit() and api_hash:
            try:
                save_api_credentials(api_id, api_hash)
            except OSError as error:
                self._append_log(f"[ERR] Не вдалося зберегти API-дані: {error}")

    def _on_pause(self) -> None:
        if not self._running:
            return
        if not self._paused:
            self._paused = True
            self._pause_event.set()
            self.pause_button.configure(text="Продовжити")
            self.status_label.configure(text="Пауза")
            self._append_log("[INFO] Пауза")
        else:
            self._paused = False
            self._pause_event.clear()
            self.pause_button.configure(text="Пауза")
            self.status_label.configure(text="Продовження...")
            self._append_log("[INFO] Продовжено")

    def _on_stop(self) -> None:
        if not self._running:
            return
        self._stop_event.set()
        self._pause_event.clear()
        self._paused = False
        self.pause_button.configure(text="Пауза")
        self.status_label.configure(text="Зупинка...")
        self._append_log("[INFO] Зупинка за запитом користувача.")

    def _get_clipboard_text(self) -> str:
        try:
            return self.clipboard_get()
        except Exception:
            return ""

    def _prepare_output_dir(self) -> Path:
        BASE_DIR.mkdir(parents=True, exist_ok=True)
        self._ensure_global_map_headers()
        stamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
        out_dir = BASE_DIR / stamp
        out_dir.mkdir(parents=True, exist_ok=True)
        return out_dir

    def _run_worker(self, links: List[LinkInfo], api_id: int, api_hash: str, out_dir: Path, max_parallel: int) -> None:
        try:
            asyncio.run(self._download_batch(links, api_id, api_hash, out_dir, max_parallel))
        except Exception as exc:
            self._queue.put({"type": "log", "message": f"[ERR] Загальна помилка: {exc}"})
        finally:
            self._phone_login_async_event = None
            self._auth_loop = None
            self._queue.put({"type": "qr_close"})
            self._queue.put({"type": "done", "stopped": self._stop_event.is_set()})

    async def _download_batch(self, links: List[LinkInfo], api_id: int, api_hash: str, out_dir: Path, max_parallel: int) -> None:
        client = TelegramClient(str(SESSION_FILE), api_id, api_hash)
        await client.connect()
        map_path = out_dir / "links_map.md"
        self._write_mapping_header(map_path)
        global_seen = self._load_global_history()
        self._global_seen_keys = set(global_seen)
        cache: Dict[Tuple[object, int], asyncio.Future] = {}
        cache_lock = asyncio.Lock()
        counter_lock = asyncio.Lock()
        total = len(links)
        completed = 0
        semaphore = asyncio.Semaphore(max_parallel)
        with self._mapping_lock:
            self._pending_global_xlsx_rows.clear()
        try:
            await self._ensure_authorized_qr(client)

            pending_links: List[LinkInfo] = []
            skipped = 0
            for link in links:
                key = (link.entity, link.message_id)
                if key in global_seen:
                    self._record_mapping(map_path, link.raw, "already_listed", "", "Already in global list")
                    skipped += 1
                    completed += 1
                    self._queue.put({"type": "progress", "current": completed, "total": total})
                else:
                    pending_links.append(link)
            if skipped:
                self._queue.put({"type": "log", "message": f"[INFO] Пропущено: {skipped}"})

            async def process_link(link: LinkInfo) -> None:
                nonlocal completed

                if self._stop_event.is_set():
                    return
                async with semaphore:
                    if self._stop_event.is_set():
                        return

                    await self._wait_if_paused()
                    if self._stop_event.is_set():
                        return

                    self._queue.put({"type": "file_start", "link": link.raw})

                    key = (link.entity, link.message_id)
                    loop = asyncio.get_running_loop()
                    async with cache_lock:
                        future = cache.get(key)
                        if future is None:
                            future = loop.create_future()
                            cache[key] = future
                            owner = True
                        else:
                            owner = False

                    if not owner:
                        status, filename, detail = await future
                        dup_detail = "duplicate"
                        if detail:
                            dup_detail = f"duplicate; {detail}"
                        self._record_mapping(map_path, link.raw, status, filename, dup_detail)
                    else:
                        status = "error"
                        filename = ""
                        detail = ""
                        try:
                            start_time = time.monotonic()
                            last_emit = 0.0

                            def progress_callback(received: int, total_bytes: Optional[int]) -> None:
                                nonlocal last_emit
                                if self._stop_event.is_set():
                                    raise DownloadStopped()
                                while self._pause_event.is_set():
                                    if self._stop_event.is_set():
                                        raise DownloadStopped()
                                    time.sleep(0.2)

                                now = time.monotonic()
                                if not should_emit_progress(now, last_emit, received, total_bytes):
                                    return
                                last_emit = now

                                elapsed = max(now - start_time, 0.001)
                                speed = received / elapsed
                                percent = None
                                if total_bytes:
                                    percent = int(received * 100 / total_bytes)

                                self._queue.put(
                                    {
                                        "type": "file_progress",
                                        "received": received,
                                        "total": total_bytes,
                                        "percent": percent,
                                        "speed": speed,
                                    }
                                )

                            message = await client.get_messages(link.entity, ids=link.message_id)
                            if not message or not message.media:
                                self._queue.put({"type": "log", "message": "[SKIP] Немає медіа"})
                                status = "no_media"
                                filename = ""
                                detail = "No media found"
                                self._record_mapping(map_path, link.raw, status, filename, detail)
                            else:
                                saved_path = await message.download_media(
                                    file=str(out_dir),
                                    progress_callback=progress_callback,
                                )
                                filename = Path(saved_path).name if saved_path else ""
                                status = "downloaded"
                                detail = ""
                                self._record_mapping(map_path, link.raw, status, filename, detail)
                        except DownloadStopped:
                            status = "stopped"
                            filename = ""
                            detail = "Stopped by user"
                            self._record_mapping(map_path, link.raw, status, filename, detail)
                            self._stop_event.set()
                        except ChannelPrivateError:
                            self._queue.put({"type": "log", "message": "[ERR] Доступ заборонено (приватний канал)"})
                            status = "error"
                            filename = ""
                            detail = "Private channel"
                            self._record_mapping(map_path, link.raw, status, filename, detail)
                        except RPCError as exc:
                            self._queue.put({"type": "log", "message": f"[ERR] Telegram API: {exc.__class__.__name__}"})
                            status = "error"
                            filename = ""
                            detail = exc.__class__.__name__
                            self._record_mapping(map_path, link.raw, status, filename, detail)
                        except Exception as exc:
                            self._queue.put({"type": "log", "message": f"[ERR] Невідома помилка: {exc}"})
                            status = "error"
                            filename = ""
                            detail = str(exc)
                            self._record_mapping(map_path, link.raw, status, filename, detail)
                        finally:
                            if not future.done():
                                future.set_result((status, filename, detail))

                    if not self._stop_event.is_set():
                        async with counter_lock:
                            completed += 1
                            self._queue.put({"type": "progress", "current": completed, "total": total})

            for offset in range(0, len(pending_links), max_parallel):
                batch = pending_links[offset:offset + max_parallel]
                await asyncio.gather(*(process_link(link) for link in batch), return_exceptions=True)
                if self._stop_event.is_set():
                    break
        finally:
            try:
                await asyncio.to_thread(self._flush_global_xlsx_rows)
            finally:
                await client.disconnect()

    async def _ensure_authorized_qr(self, client: TelegramClient) -> None:
        if await client.is_user_authorized():
            self._queue.put({"type": "log", "message": "[INFO] Уже авторизовано через збережену сесію."})
            return

        self._queue.put({"type": "log", "message": "[INFO] Створюю QR-код для входу."})
        qr_login = await client.qr_login()
        phone_login_event = asyncio.Event()
        self._auth_loop = asyncio.get_running_loop()
        self._phone_login_async_event = phone_login_event

        while not self._stop_event.is_set():
            expires_text = self._format_datetime(qr_login.expires)
            self._queue.put({"type": "qr_show", "url": qr_login.url, "expires": expires_text})
            self._queue.put({"type": "log", "message": "[INFO] QR-код показано. Скануйте його з Telegram на телефоні."})

            wait_task = asyncio.create_task(qr_login.wait(timeout=self._qr_wait_timeout(qr_login.expires)))
            phone_task = asyncio.create_task(phone_login_event.wait())
            done, _ = await asyncio.wait((wait_task, phone_task), return_when=asyncio.FIRST_COMPLETED)

            if phone_task in done and wait_task not in done:
                wait_task.cancel()
                await asyncio.gather(wait_task, return_exceptions=True)
                self._queue.put({"type": "qr_close"})
                await self._ensure_authorized_phone(client)
                self._phone_login_async_event = None
                self._auth_loop = None
                return

            phone_task.cancel()
            await asyncio.gather(phone_task, return_exceptions=True)
            try:
                user = wait_task.result()
                name = " ".join(part for part in [getattr(user, "first_name", ""), getattr(user, "last_name", "")] if part).strip()
                self._queue.put({"type": "qr_close"})
                self._queue.put({"type": "log", "message": f"[OK] Авторизовано{f' як {name}' if name else ''}."})
                self._phone_login_async_event = None
                self._auth_loop = None
                return
            except asyncio.TimeoutError:
                if self._stop_event.is_set():
                    break
                if self._qr_is_expired(qr_login.expires):
                    self._queue.put({"type": "log", "message": "[INFO] QR-код протерміновано. Оновлюю..."})
                    await qr_login.recreate()
                continue
            except SessionPasswordNeededError:
                self._queue.put({"type": "qr_close"})
                await self._handle_password(client)
                self._phone_login_async_event = None
                self._auth_loop = None
                return
            except RPCError as exc:
                self._queue.put({"type": "qr_close"})
                raise ValueError(f"Telegram API під час QR-авторизації: {exc.__class__.__name__}") from exc

        self._phone_login_async_event = None
        self._auth_loop = None
        raise DownloadStopped("Авторизацію зупинено користувачем.")

    def _request_phone_login(self) -> None:
        event = self._phone_login_async_event
        if event is not None and self._auth_loop is not None and self._auth_loop.is_running():
            self._auth_loop.call_soon_threadsafe(event.set)

    async def _ensure_authorized_phone(self, client: TelegramClient) -> None:
        phone = await self._request_input("Введіть номер телефону у міжнародному форматі (+380...)", "phone")
        if not phone:
            raise ValueError("Номер телефону не введено.")
        try:
            await client.send_code_request(phone)
        except PhoneNumberInvalidError as exc:
            raise ValueError("Невірний номер телефону.") from exc

        code = await self._request_input("Введіть код, який Telegram надіслав у застосунок", "code")
        for _ in range(3):
            try:
                await client.sign_in(phone=phone, code=code)
                self._queue.put({"type": "log", "message": "[OK] Авторизовано за номером телефону."})
                return
            except PhoneCodeInvalidError:
                code = await self._request_input("Невірний код. Введіть код ще раз", "code")
            except SessionPasswordNeededError:
                await self._handle_password(client)
                return
        raise ValueError("Перевищено кількість спроб для коду підтвердження.")

    def _qr_wait_timeout(self, expires: datetime) -> float:
        now = datetime.now(expires.tzinfo) if expires.tzinfo else datetime.now()
        seconds_left = (expires - now).total_seconds()
        if seconds_left <= 0:
            return 1.0
        return max(1.0, min(30.0, seconds_left))

    def _qr_is_expired(self, expires: datetime) -> bool:
        now = datetime.now(expires.tzinfo) if expires.tzinfo else datetime.now()
        return now >= expires

    def _format_datetime(self, value: datetime) -> str:
        try:
            return value.strftime("%H:%M:%S")
        except Exception:
            return str(value)

    async def _wait_if_paused(self) -> None:
        while self._pause_event.is_set():
            if self._stop_event.is_set():
                return
            await asyncio.sleep(0.2)

    async def _handle_password(self, client: TelegramClient) -> None:
        password = await self._request_password("Введіть пароль 2FA")
        for _ in range(3):
            try:
                await client.sign_in(password=password)
                return
            except PasswordHashInvalidError:
                password = await self._request_password("Невірний пароль. Спробуйте ще раз")
        raise ValueError("Перевищено кількість спроб для пароля 2FA.")

    async def _request_password(self, prompt: str) -> str:
        return await self._request_input(prompt, "password")

    async def _request_input(self, prompt: str, kind: str) -> str:
        event = threading.Event()
        holder: dict = {}
        self._queue.put({
            "type": "input_request",
            "prompt": prompt,
            "kind": kind,
            "event": event,
            "holder": holder,
        })
        loop = asyncio.get_running_loop()
        await loop.run_in_executor(None, event.wait)
        return str(holder.get("value", "")).strip()

    def _process_queue(self) -> None:
        for _ in range(200):
            try:
                msg = self._queue.get_nowait()
            except queue.Empty:
                break
            msg_type = msg.get("type")

            if msg_type == "log":
                self._append_log(msg.get("message", ""))
            elif msg_type == "progress":
                current = msg.get("current", 0)
                total = msg.get("total", 1)
                ratio = current / total if total else 0.0
                self.progress.set(ratio)
                self.status_label.configure(text=f"Прогрес: {current}/{total}")
            elif msg_type == "file_start":
                link = msg.get("link", "")
                self.file_progress.set(0.0)
                self.file_status_label.configure(text=f"Файл: {link}")
            elif msg_type == "file_progress":
                total_bytes = msg.get("total")
                received = msg.get("received", 0)
                percent = msg.get("percent")
                speed = msg.get("speed", 0.0)
                if total_bytes:
                    self.file_progress.set(min(max(received / total_bytes, 0.0), 1.0))
                else:
                    self.file_progress.set(0.0)
                percent_text = f"{percent}%" if percent is not None else "—"
                self.file_status_label.configure(text=f"Файл: {percent_text} | {self._format_speed(speed)}")
            elif msg_type == "qr_show":
                self._show_or_update_qr(msg.get("url", ""), msg.get("expires", ""))
            elif msg_type == "qr_close":
                self._close_qr_dialog()
            elif msg_type == "done":
                self._set_running(False)
                if msg.get("stopped"):
                    self.status_label.configure(text="Зупинено")
                else:
                    self.status_label.configure(text="Готово")
            elif msg_type == "input_request":
                value = self._prompt_user(msg.get("prompt", ""), msg.get("kind", "password"))
                msg.get("holder", {})["value"] = value
                msg.get("event").set()

        self.after(150, self._process_queue)

    def _show_or_update_qr(self, url: str, expires: str) -> None:
        if not url:
            return
        if self._qr_dialog is None or not self._qr_dialog.winfo_exists():
            self._qr_dialog = QRLoginDialog(self, self._request_phone_login)
        self._qr_dialog.update_qr(url, expires)

    def _close_qr_dialog(self) -> None:
        if self._qr_dialog is not None and self._qr_dialog.winfo_exists():
            self._qr_dialog.destroy()
        self._qr_dialog = None

    def _prompt_user(self, prompt: str, kind: str) -> str:
        dialog = PromptDialog(self, prompt, "Авторизація", is_password=(kind == "password"))
        self.wait_window(dialog)
        return dialog.result or ""

    def _append_log(self, text: str) -> None:
        self.log_box.configure(state="normal")
        self.log_box.insert("end", text + "\n")
        line_count = int(self.log_box.index("end-1c").split(".")[0])
        if line_count > 500:
            self.log_box.delete("1.0", f"{line_count - 500}.0")
        self.log_box.see("end")
        self.log_box.configure(state="disabled")

    def _format_speed(self, bytes_per_sec: float) -> str:
        if not bytes_per_sec or bytes_per_sec < 0:
            return "0 B/s"
        units = ["B/s", "KB/s", "MB/s", "GB/s"]
        value = float(bytes_per_sec)
        idx = 0
        while value >= 1024 and idx < len(units) - 1:
            value /= 1024
            idx += 1
        return f"{value:.2f} {units[idx]}"

    def _write_mapping_header(self, path: Path) -> None:
        with path.open("w", encoding="utf-8") as file:
            file.write("| link | status | filename | detail |\n")
            file.write("| --- | --- | --- | --- |\n")

    def _append_mapping(self, path: Path, link: str, status: str, filename: str, detail: str) -> None:
        def sanitize(value: str) -> str:
            return (value or "").replace("|", "\\|").replace("\n", " ").strip()

        line = f"| {sanitize(link)} | {sanitize(status)} | {sanitize(filename)} | {sanitize(detail)} |\n"
        with path.open("a", encoding="utf-8") as file:
            file.write(line)

    def _write_csv_header(self, path: Path) -> None:
        with path.open("w", newline="", encoding="utf-8") as file:
            writer = csv.writer(file)
            writer.writerow(["timestamp", "link", "status", "filename", "detail"])

    def _append_csv(self, path: Path, link: str, status: str, filename: str, detail: str) -> None:
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        with path.open("a", newline="", encoding="utf-8") as file:
            writer = csv.writer(file)
            writer.writerow([timestamp, link, status, filename, detail])

    def _write_xlsx_header(self, path: Path) -> None:
        workbook = Workbook()
        sheet = workbook.active
        sheet.title = "links"
        sheet.append(["timestamp", "link", "status", "filename", "detail"])
        workbook.save(path)

    def _ensure_global_map_headers(self) -> None:
        if not GLOBAL_MAP_MD.exists():
            self._write_mapping_header(GLOBAL_MAP_MD)
        if not GLOBAL_MAP_CSV.exists():
            self._write_csv_header(GLOBAL_MAP_CSV)
        if not GLOBAL_MAP_XLSX.exists():
            self._write_xlsx_header(GLOBAL_MAP_XLSX)

    def _append_global_mapping(self, link: str, status: str, filename: str, detail: str) -> None:
        self._ensure_global_map_headers()
        self._append_mapping(GLOBAL_MAP_MD, link, status, filename, detail)
        self._append_csv(GLOBAL_MAP_CSV, link, status, filename, detail)
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        self._pending_global_xlsx_rows.append([timestamp, link, status, filename, detail])

    def _flush_global_xlsx_rows(self) -> None:
        with self._mapping_lock:
            rows, self._pending_global_xlsx_rows = self._pending_global_xlsx_rows, []
        if not rows:
            return
        try:
            append_xlsx_rows(GLOBAL_MAP_XLSX, rows)
        except Exception as exc:
            self._queue.put({"type": "log", "message": f"[ERR] Не вдалося оновити links_map.xlsx: {exc}"})

    def _record_mapping(self, map_path: Path, link: str, status: str, filename: str, detail: str) -> None:
        with self._mapping_lock:
            self._append_mapping(map_path, link, status, filename, detail)
            key = link_key_from_url(link)
            if key and key not in self._global_seen_keys:
                self._append_global_mapping(link, status, filename, detail)
                self._global_seen_keys.add(key)

    def _load_global_history(self) -> set[tuple[object, int]]:
        seen_keys: set[tuple[object, int]] = set()

        if GLOBAL_MAP_CSV.exists():
            with GLOBAL_MAP_CSV.open("r", newline="", encoding="utf-8") as file:
                reader = csv.DictReader(file)
                for row in reader:
                    link = (row.get("link") or "").strip()
                    key = link_key_from_url(link)
                    if key:
                        seen_keys.add(key)

        if GLOBAL_MAP_MD.exists():
            text = GLOBAL_MAP_MD.read_text(encoding="utf-8", errors="ignore")
            text = text.replace("\\n", "\n")
            for match in LINK_PATTERN.finditer(text):
                key = link_key_from_url(match.group(0))
                if key:
                    seen_keys.add(key)

        if GLOBAL_MAP_XLSX.exists():
            try:
                workbook = load_workbook(GLOBAL_MAP_XLSX)
                sheet = workbook.active
                for row in sheet.iter_rows(min_row=2, values_only=True):
                    link = row[1] if row and len(row) > 1 else ""
                    key = link_key_from_url(str(link or ""))
                    if key:
                        seen_keys.add(key)
            except Exception:
                pass

        return seen_keys

    def _set_running(self, running: bool) -> None:
        self._running = running
        if running:
            self.start_button.configure(state="disabled")
            self.pause_button.configure(state="normal")
            self.stop_button.configure(state="normal")
        else:
            self.start_button.configure(state="normal")
            self.pause_button.configure(state="disabled", text="Пауза")
            self.stop_button.configure(state="disabled")
            self.file_progress.set(0.0)
            self.file_status_label.configure(text="Файл: —")


if __name__ == "__main__":
    app = TelegramBatchDownloader()
    app.mainloop()
