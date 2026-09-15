<p align="center">
  <img src="Logo.png" alt="Telegram Bot Expert Installer" width="160">
</p>

<h1 align="center">Telegram Bot Expert Installer</h1>

<p align="center">
  Install · Webhook · Polling · Dashboard · Health · Languages
</p>

<p align="center">
  <a href="https://foxnext.net">Website</a> •
  <a href="https://foxnext.net/en/download.html">Download</a> •
  <a href="https://github.com/BlackFoxGroup/VPS-to-VPN">VPS to VPN</a> •
  <a href="https://github.com/BlackFoxGroup/blackfox-config-builder">Black Fox Config Builder</a> •
  <a href="https://github.com/BlackFoxGroup/smart-support-bot">Smart Support Bot</a> •
  <a href="https://t.me/blackFoxVPNN">Telegram</a>
</p>

<div dir="rtl">

اکسپرت **Telegram Bot Expert Installer** به‌صورت رایگان و متن‌باز (**Open Source**) در اختیار عموم قرار گرفته است تا همه بتوانند آزادانه از آن استفاده کنند و در توسعه و بهبود آن مشارکت داشته باشند.

این برنامه یک نصب‌کننده و مدیر گرافیکی است. کاربر عادی می‌تواند بدون دانش Linux و بدون کار با Terminal، ربات تلگرام را روی VPS نصب، اجرا، مدیریت و در صورت نیاز حذف کند.

دو مسیر نصب وجود دارد:

- **Webhook** برای سرور با دامنه و HTTPS
- **Polling** برای ساده‌ترین نصب، بدون دامنه و SSL

⭐ اگر این پروژه برای شما مفید است، لطفاً با **Star ⭐ در GitHub** از ادامه این مسیر و توسعه پروژه حمایت کنید. حمایت شما انگیزه‌ای برای ادامه و ساخت پروژه‌های بهتر است.

🦊 همچنین خوشحالیم که به خانواده **Black Fox** پیوسته‌اید. 💖  
امیدواریم در کنار هم بتوانیم پروژه‌های کاربردی و متن‌باز بیشتری توسعه دهیم.

🚀 در کنار Telegram Bot Expert Installer، می‌توانید از سایر پروژه‌های **Black Fox** نیز دیدن کنید و از آن‌ها استفاده کنید.

**از همراهی و حمایت شما سپاسگزاریم. 🙏**

</div>

---

# English

**Telegram Bot Expert Installer** is a free, open-source desktop Expert. It lets you install and manage a Telegram bot on a Linux VPS from Windows through a browser. You do not need to copy Linux commands or work in a terminal.

## What it does

- Connects to the VPS over SSH (password or SSH key)
- Detects the OS and prepares the server
- Installs project dependencies (Python, Node.js, Go, PHP, or Docker)
- Creates a systemd service so the bot starts after reboot
- Supports **Webhook** (domain + HTTPS + Nginx) and **Polling** (no domain required)
- Shows dashboard, logs, health checks, backup, restore, and uninstall

Website: [foxnext.net](https://foxnext.net)  
Download page: [foxnext.net/en/download.html](https://foxnext.net/en/download.html)  
Source: [github.com/BlackFoxGroup/telegram-bot-expert-installer](https://github.com/BlackFoxGroup/telegram-bot-expert-installer)

## Download

Download the Expert source ZIP from GitHub:

[telegram-bot-expert-installer.zip](https://github.com/BlackFoxGroup/telegram-bot-expert-installer/raw/main/downloads/telegram-bot-expert-installer.zip)

The ZIP contains the Expert source only. It does not contain passwords, tokens, SSH keys, or session files.

## Easy install from Terminal (Windows)

Install [Node.js LTS](https://nodejs.org), open PowerShell, then run:

```powershell
irm https://raw.githubusercontent.com/BlackFoxGroup/telegram-bot-expert-installer/main/deploy/install-expert.ps1 | iex
```

The script downloads the Expert, installs packages, builds the app, and opens `http://127.0.0.1:4780/`.
The local copy is stored in `%LOCALAPPDATA%\TelegramBotExpert`.

## Requirements

- Windows 10 or 11
- [Node.js](https://nodejs.org) 20 or newer (LTS)
- A Linux VPS (Ubuntu, Debian, AlmaLinux, or Rocky Linux)
- A Telegram bot token from `@BotFather`

## Run

1. Download this repository as ZIP, or clone it.
2. Extract the folder.
3. Double-click `Start-Expert.bat`.
4. The Expert opens at `http://127.0.0.1:4780/`.

The first run may take a few minutes (`npm install` and `npm run build`). Keep the black window open while the Expert is running.

```text
Start-Expert.bat
```

## Languages

Persian · English · Russian · Chinese

## License and credit

Telegram Bot Expert Installer is maintained by [Black Fox Group](https://github.com/BlackFoxGroup).

---

# فارسی

اکسپرت **Telegram Bot Expert Installer** یک برنامه رایگان و متن‌باز است. با آن می‌توانید ربات تلگرام را از ویندوز، از طریق مرورگر، روی VPS لینوکس نصب و مدیریت کنید. نیازی به کپی دستور Linux یا کار با Terminal نیست.

## کارهایی که انجام می‌دهد

- اتصال به VPS با SSH (رمز یا کلید)
- تشخیص سیستم‌عامل و آماده‌سازی سرور
- نصب وابستگی‌های پروژه (Python، Node.js، Go، PHP یا Docker)
- ساخت سرویس systemd تا ربات بعد از روشن شدن سرور خودکار اجرا شود
- پشتیبانی از **Webhook** (دامنه و HTTPS) و **Polling** (بدون دامنه)
- داشبورد، لاگ، بررسی سلامت، پشتیبان، بازگردانی و حذف نصب

وب‌سایت: [foxnext.net](https://foxnext.net)  
صفحه دانلود: [foxnext.net/en/download.html](https://foxnext.net/en/download.html)  
سورس: [github.com/BlackFoxGroup/telegram-bot-expert-installer](https://github.com/BlackFoxGroup/telegram-bot-expert-installer)

## دانلود

سورس اکسپرت را از گیت‌هاب به‌صورت ZIP بگیرید:

[telegram-bot-expert-installer.zip](https://github.com/BlackFoxGroup/telegram-bot-expert-installer/raw/main/downloads/telegram-bot-expert-installer.zip)

این فایل فقط سورس اکسپرت است. رمز، توکن، کلید SSH و فایل نشست داخل آن نیست.

## نصب آسان از ترمینال (ویندوز)

ابتدا [Node.js LTS](https://nodejs.org) را نصب کنید. سپس PowerShell را باز کنید و این دستور را بزنید:

```powershell
irm https://raw.githubusercontent.com/BlackFoxGroup/telegram-bot-expert-installer/main/deploy/install-expert.ps1 | iex
```

اسکریپت اکسپرت را دانلود می‌کند، بسته‌ها را نصب می‌کند، برنامه را می‌سازد و صفحه را در `http://127.0.0.1:4780/` باز می‌کند.
نسخه محلی در `%LOCALAPPDATA%\TelegramBotExpert` ذخیره می‌شود.

## پیش‌نیاز

- ویندوز ۱۰ یا ۱۱
- [Node.js](https://nodejs.org) نسخه ۲۰ یا جدیدتر
- یک VPS لینوکس (اوبونتو، دبیان، AlmaLinux یا Rocky Linux)
- توکن ربات از `@BotFather`

## اجرا

۱. این مخزن را به‌صورت ZIP دانلود کنید یا کلون بگیرید.  
۲. پوشه را باز کنید.  
۳. روی `Start-Expert.bat` دوبار کلیک کنید.  
۴. برنامه در آدرس `http://127.0.0.1:4780/` باز می‌شود.

بار اول ممکن است چند دقیقه طول بکشد. تا وقتی برنامه روشن است، پنجره سیاه را نبندید.

## زبان‌ها

فارسی · انگلیسی · روسی · چینی

## سازنده

توسعه و نگهداری پروژه برعهده [Black Fox Group](https://github.com/BlackFoxGroup) است.
