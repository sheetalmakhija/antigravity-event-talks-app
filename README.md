# Google Cloud BigQuery Release Notes Explorer

A modern, real-time dashboard built to fetch, parse, search, filter, and share Google Cloud BigQuery release updates. The application utilizes a Python Flask backend and a responsive glassmorphic frontend built with plain vanilla HTML, JS, and CSS.

---

## 🚀 Key Features

* **Granular Update Splitter**: Slices aggregated daily updates into individual, easy-to-read cards categorized by update type.
* **Sleek Glassmorphic Interface**: Features custom neon accent scrollbars, frosted-glass panels (`backdrop-filter`), hover micro-animations, and glow effects.
* **Instant Search & Category Filters**: Matches keywords in titles, descriptions, and dates. Includes filter tags for *Features*, *Changes*, *Breaking*, *Announcements*, and *Issues*.
* **Dashboard Statistics**: Tracks release counts (total, features, and breaking changes) in real time.
* **Integrated Tweet Composer**: Composer mimicking a Twitter card. Auto-generates summary updates and handles Twitter's strict 280-character constraints (automatically truncating the text body to fit links and hashtags).
* **In-Memory Caching**: Bypasses slow network calls on routine page reloads and offers on-demand cache refresh.

---

## 🛠️ Tech Stack

* **Backend**: Python 3, Flask, Requests, BeautifulSoup4
* **Frontend**: Vanilla HTML5, Vanilla CSS3 (Custom Variables, Flexbox, Grid), Vanilla ES6+ JavaScript
* **Database/Cache**: In-memory Python caching
* **Mermaid Integration**: Architectural visualization markdown support

---

## 📁 Project Structure

```text
bq-releases-notes/
├── app.py                  # Flask application & Atom feed parser
├── requirements.txt        # Backend dependencies
├── .gitignore              # Files ignored in Git
├── README.md               # Project documentation
├── templates/
│   └── index.html          # Semantic HTML structure & Tweet layout
└── static/
    ├── css/
    │   └── style.css       # Layout grids, glassmorphism tokens, and tags
    └── js/
        └── main.js         # State management, filter controller, and tweet composer
```

---

## ⚙️ Installation & Setup

Follow these steps to run the application locally:

### 1. Clone the Repository
```bash
git clone https://github.com/sheetalmakhija/antigravity-event-talks-app.git
cd bq-releases-notes
```

### 2. Create and Activate a Virtual Environment
**On Windows (PowerShell):**
```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
```

**On macOS/Linux:**
```bash
python3 -m venv venv
source venv/bin/activate
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

### 4. Run the Flask Server
```bash
python app.py
```
By default, the server will start in debug mode on **`http://127.0.0.1:5000`**.

---

## 🧪 API Reference

* **`GET /`**: Serves the main frontend dashboard.
* **`GET /api/releases`**: Returns parsed release entries from the cache.
* **`GET /api/releases?refresh=true`**: Bypasses the cache, issues a live request to Google Cloud's RSS feed, updates cache, and returns the fresh JSON payload.

---

## 📝 License

This project is licensed under the MIT License.
