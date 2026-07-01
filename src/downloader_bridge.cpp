#include "downloader_bridge.h"
#include <QDir>
#include <QFileInfo>
#include <QFile>
#include <QProcess>
#include <QRegularExpression>
#include <QStandardPaths>
#include <QJsonDocument>
#include <QJsonArray>
#include <QJsonObject>
#include <QDateTime>
#include <QTextStream>
#include <QCoreApplication>
#include <QDebug>

static QString safeDownloadDir(const QString &requestedDir)
{
    QString dir = requestedDir.trimmed();
    if (dir.isEmpty() || dir.contains("C:/Users/windows", Qt::CaseInsensitive) || dir.contains("C:\\Users\\windows", Qt::CaseInsensitive)) {
        QString base = QStandardPaths::writableLocation(QStandardPaths::MusicLocation);
        if (base.isEmpty())
            base = QStandardPaths::writableLocation(QStandardPaths::AppDataLocation);
        if (base.isEmpty())
            base = QDir::homePath();
        dir = QDir(base).filePath("LavaLyrics");
    }

    QDir().mkpath(dir);
    QFile probe(QDir(dir).filePath(".write_test"));
    if (!probe.open(QIODevice::WriteOnly)) {
        QString fallback = QDir(QStandardPaths::writableLocation(QStandardPaths::AppDataLocation)).filePath("downloads");
        if (fallback.isEmpty())
            fallback = QDir(QDir::homePath()).filePath("LavaLyrics");
        QDir().mkpath(fallback);
        return fallback;
    }
    probe.close();
    probe.remove();
    return dir;
}

static void appendDownloaderLog(const QString &context, const QString &message)
{
    QString logDir = QDir(QCoreApplication::applicationDirPath()).filePath("../logs");
    QDir().mkpath(logDir);
    QFile file(QDir(logDir).filePath("downloader_errors.log"));
    if (!file.open(QIODevice::Append | QIODevice::Text))
        return;

    QTextStream out(&file);
    out << "---- " << QDateTime::currentDateTime().toString(Qt::ISODate) << " [" << context << "] ----\n";
    out << message << "\n\n";
}

DownloaderBridge::DownloaderBridge(QObject *parent)
    : QObject(parent)
    , m_process(new QProcess(this))
    , m_isDownloading(false)
    , m_progress(0)
{
    connect(m_process, &QProcess::readyReadStandardOutput, this, &DownloaderBridge::onProcessOutput);
    connect(m_process, &QProcess::readyReadStandardError, this, &DownloaderBridge::onProcessOutput);
    connect(m_process, QOverload<int, QProcess::ExitStatus>::of(&QProcess::finished),
            this, &DownloaderBridge::onProcessFinished);
    connect(m_process, &QProcess::errorOccurred, this, &DownloaderBridge::onProcessError);
}

DownloaderBridge::~DownloaderBridge()
{
    if (m_process->state() != QProcess::NotRunning)
        m_process->kill();
}

bool DownloaderBridge::isDownloading() const { return m_isDownloading; }
int DownloaderBridge::progress() const { return m_progress; }
QString DownloaderBridge::statusMessage() const { return m_statusMessage; }
QString DownloaderBridge::pythonPath() const { return m_pythonPath; }
void DownloaderBridge::setPythonPath(const QString &path) { m_pythonPath = path; }

QString DownloaderBridge::detectPython()
{
    QStringList candidates = {"python", "python3", "py"};
    for (const QString &cmd : candidates) {
        QProcess probe;
        probe.start(cmd, {"--version"});
        probe.waitForFinished(3000);
        if (probe.exitCode() == 0) {
            m_pythonPath = cmd;
            return cmd;
        }
    }
    return QString();
}

void DownloaderBridge::downloadFromUrl(const QString &url, const QString &outputDir)
{
    if (m_isDownloading) return;

    m_outputDir = safeDownloadDir(outputDir);
    m_processLog.clear();
    m_currentSource = "yt-dlp";
    QDir().mkpath(m_outputDir);

    QString python = m_pythonPath.isEmpty() ? detectPython() : m_pythonPath;
    if (python.isEmpty()) {
        QString msg = "[python] Python no encontrado. Instala Python 3.x o agrega python.exe al PATH.";
        appendDownloaderLog("download", msg);
        emit downloadFailed(msg);
        return;
    }

    QString script = buildYtdlpScript(url, m_outputDir);

    m_isDownloading = true;
    m_progress = 0;
    emit isDownloadingChanged();
    emit progressChanged();
    setStatus("Iniciando descarga con yt-dlp...");

    m_process->start(python, {"-c", script});
}

void DownloaderBridge::downloadSpotify(const QString &spotifyUrl, const QString &outputDir)
{
    if (m_isDownloading) return;

    m_outputDir = safeDownloadDir(outputDir);
    m_processLog.clear();
    m_currentSource = "spotdl";
    QDir().mkpath(m_outputDir);

    QString python = m_pythonPath.isEmpty() ? detectPython() : m_pythonPath;
    if (python.isEmpty()) {
        QString msg = "[python] Python no encontrado. Instala Python 3.x o agrega python.exe al PATH.";
        appendDownloaderLog("spotify", msg);
        emit downloadFailed(msg);
        return;
    }

    QString script = buildSpotdlScript(spotifyUrl, m_outputDir);

    m_isDownloading = true;
    m_progress = 0;
    emit isDownloadingChanged();
    emit progressChanged();
    setStatus("Iniciando descarga de Spotify...");

    m_process->start(python, {"-c", script});
}

void DownloaderBridge::searchSongs(const QString &query)
{
    QString q = query.trimmed();
    if (q.isEmpty()) {
        emit searchCompleted(QVariantList());
        return;
    }

    QString python = m_pythonPath.isEmpty() ? detectPython() : m_pythonPath;
    if (python.isEmpty()) {
        QString msg = "[python] Python no encontrado. No se puede buscar canciones.";
        appendDownloaderLog("search", msg);
        emit searchFailed(msg);
        return;
    }

    emit searchStarted();
    QString script = buildSearchScript(q);

    QProcess *searchProc = new QProcess(this);
    connect(searchProc, QOverload<int, QProcess::ExitStatus>::of(&QProcess::finished),
            this, [this, searchProc](int exitCode, QProcess::ExitStatus) {
        QString out = QString::fromUtf8(searchProc->readAllStandardOutput());
        QString err = QString::fromUtf8(searchProc->readAllStandardError());
        searchProc->deleteLater();

        if (exitCode != 0) {
            QString msg = QString("[search] Codigo %1\n%2").arg(exitCode).arg((out + err).trimmed().right(2000));
            appendDownloaderLog("search", msg);
            emit searchFailed(msg);
            return;
        }

        int start = out.indexOf("LAVALYRICS_JSON_BEGIN");
        int end = out.indexOf("LAVALYRICS_JSON_END");
        if (start < 0 || end < 0 || end <= start) {
            QString msg = "[search] La busqueda no devolvio JSON valido.\n" + (out + err).trimmed().right(2000);
            appendDownloaderLog("search", msg);
            emit searchFailed(msg);
            return;
        }

        QString jsonText = out.mid(start + QString("LAVALYRICS_JSON_BEGIN").size(),
                                   end - (start + QString("LAVALYRICS_JSON_BEGIN").size())).trimmed();
        QJsonParseError parseError;
        QJsonDocument doc = QJsonDocument::fromJson(jsonText.toUtf8(), &parseError);
        if (parseError.error != QJsonParseError::NoError || !doc.isArray()) {
            QString msg = "[search] JSON invalido: " + parseError.errorString() + "\n" + jsonText.left(1000);
            appendDownloaderLog("search", msg);
            emit searchFailed(msg);
            return;
        }

        QVariantList results;
        for (const QJsonValue &value : doc.array())
            results.append(value.toObject().toVariantMap());
        emit searchCompleted(results);
    });
    connect(searchProc, &QProcess::errorOccurred, this, [this, searchProc](QProcess::ProcessError error) {
        QString msg = "[search] QProcess error=" + QString::number(error);
        appendDownloaderLog("search", msg);
        emit searchFailed(msg);
        searchProc->deleteLater();
    });

    searchProc->start(python, {"-c", script});
}

void DownloaderBridge::cancel()
{
    if (!m_isDownloading) return;
    m_process->kill();
    m_isDownloading = false;
    m_progress = 0;
    emit isDownloadingChanged();
    emit progressChanged();
    setStatus("Descarga cancelada");
}

void DownloaderBridge::onProcessOutput()
{
    QString combined = QString::fromUtf8(m_process->readAllStandardOutput())
                     + QString::fromUtf8(m_process->readAllStandardError());

    const QStringList lines = combined.split('\n', Qt::SkipEmptyParts);
    for (const QString &line : lines) {
        QString clean = line.trimmed();
        qDebug() << "[Downloader]" << clean;
        if (!clean.isEmpty()) {
            m_processLog += clean + "\n";
            if (m_processLog.size() > 6000)
                m_processLog = m_processLog.right(6000);
        }
        parseProgressLine(clean);
    }
}

void DownloaderBridge::onProcessFinished(int exitCode, QProcess::ExitStatus)
{
    m_isDownloading = false;
    emit isDownloadingChanged();

    if (exitCode == 0) {
        m_progress = 100;
        emit progressChanged();
        setStatus("Descarga completada");

        QDir dir(m_outputDir);
        QStringList audioExts = {"*.mp3", "*.m4a", "*.flac", "*.opus", "*.wav"};
        QStringList lyricsExts = {"*.lrc", "*.json"};

        QString audioFile, lyricsFile;
        for (const QString &ext : audioExts) {
            QStringList found = dir.entryList({ext}, QDir::Files, QDir::Time);
            if (!found.isEmpty()) { audioFile = dir.filePath(found.first()); break; }
        }
        for (const QString &ext : lyricsExts) {
            QStringList found = dir.entryList({ext}, QDir::Files, QDir::Time);
            if (!found.isEmpty()) { lyricsFile = dir.filePath(found.first()); break; }
        }

        if (audioFile.isEmpty()) {
            QString msg = QString("[%1] El proceso termino sin error, pero no genero audio en: %2\n%3")
                              .arg(m_currentSource.isEmpty() ? "download" : m_currentSource)
                              .arg(m_outputDir)
                              .arg(m_processLog.trimmed().right(1200));
            setStatus(msg);
            appendDownloaderLog("download", msg);
            emit downloadFailed(msg);
            return;
        }

        emit downloadCompleted(audioFile, lyricsFile);
        return;
    }

    QString detail = m_processLog.trimmed();
    if (detail.isEmpty())
        detail = "El proceso no devolvio salida. Revisa Python, red, permisos o dependencias.";

    QString msg = QString("[%1] Descarga fallida. Codigo %2.\n%3")
                      .arg(m_currentSource.isEmpty() ? "download" : m_currentSource)
                      .arg(exitCode)
                      .arg(detail.right(1200));
    setStatus(msg);
    appendDownloaderLog("download", msg);
    emit downloadFailed(msg);
}

void DownloaderBridge::onProcessError(QProcess::ProcessError error)
{
    m_isDownloading = false;
    emit isDownloadingChanged();
    QString msg = "Error de proceso QProcess=" + QString::number(error);
    if (!m_processLog.trimmed().isEmpty())
        msg += "\n" + m_processLog.trimmed().right(1200);
    setStatus(msg);
    appendDownloaderLog("process", msg);
    emit downloadFailed(msg);
}

void DownloaderBridge::setStatus(const QString &msg)
{
    m_statusMessage = msg;
    emit statusMessageChanged();
}

void DownloaderBridge::parseProgressLine(const QString &line)
{
    static QRegularExpression pctRe(R"(\[download\]\s+([\d.]+)%)");
    QRegularExpressionMatch m = pctRe.match(line);
    if (m.hasMatch()) {
        int pct = qBound(0, static_cast<int>(m.captured(1).toDouble()), 99);
        if (pct != m_progress) {
            m_progress = pct;
            emit progressChanged();
        }
    }

    if (line.contains("[download]")) setStatus(line.mid(line.indexOf(']') + 2).trimmed());
    else if (line.contains("[lavalyrics]") || line.contains("[spotdl]") || line.contains("Downloading")) setStatus(line.trimmed());
    else if (line.contains("Merging") || line.contains("ffmpeg")) setStatus("Procesando audio...");
    else if (line.contains("ERROR", Qt::CaseInsensitive) || line.contains("Traceback")) setStatus("Error: " + line);
}

QString DownloaderBridge::buildYtdlpScript(const QString &url, const QString &outputDir)
{
    QString escapedDir = outputDir;
    escapedDir.replace("\\", "\\\\");
    QString escapedUrl = url;
    escapedUrl.replace("\\", "\\\\").replace("\"", "\\\"");

    return QString(R"(
import sys, os, json, traceback, urllib.request, urllib.parse, re

raw_query = "%1".strip()
out_dir = r"%2"
os.makedirs(out_dir, exist_ok=True)

try:
    import yt_dlp
except Exception:
    print("[lavalyrics] ERROR_IMPORT_YTDLP: no se pudo importar yt_dlp", flush=True)
    traceback.print_exc()
    sys.exit(10)

try:
    is_url = raw_query.startswith(("http://", "https://"))
    target = raw_query if is_url else "ytsearch1:" + raw_query
    print(f"[lavalyrics] Fuente: yt-dlp | target={target}", flush=True)

    ydl_opts = {
        "format": "bestaudio/best",
        "outtmpl": os.path.join(out_dir, "%(title).180s.%(ext)s"),
        "noplaylist": True,
        "quiet": False,
        "no_warnings": False,
        "postprocessors": [{
            "key": "FFmpegExtractAudio",
            "preferredcodec": "mp3",
            "preferredquality": "0",
        }],
    }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(target, download=True)
        if "entries" in info and info["entries"]:
            info = info["entries"][0]

    artist = info.get("artist") or info.get("uploader") or ""
    title = info.get("track") or info.get("title") or raw_query
    duration = int(info.get("duration") or 0)
    print(f"[lavalyrics] Audio descargado: {artist} - {title}", flush=True)

    try:
        params = urllib.parse.urlencode({"artist_name": artist, "track_name": title, "duration": duration})
        req = urllib.request.urlopen(f"https://lrclib.net/api/get?{params}", timeout=10)
        data = json.loads(req.read())
        if data.get("syncedLyrics"):
            lrc_path = os.path.join(out_dir, "lyrics.lrc")
            with open(lrc_path, "w", encoding="utf-8") as lf:
                lf.write(data["syncedLyrics"])
            print(f"[lavalyrics] Lyrics sincronizadas: {lrc_path}", flush=True)
        else:
            print("[lavalyrics] Sin lyrics sincronizadas en LRCLIB.", flush=True)
    except Exception as lyric_error:
        print(f"[lavalyrics] WARN_LYRICS: {type(lyric_error).__name__}: {lyric_error}", flush=True)

    sys.exit(0)
except Exception as e:
    print(f"[lavalyrics] ERROR_DOWNLOAD: {type(e).__name__}: {e}", flush=True)
    traceback.print_exc()
    sys.exit(20)
)").arg(escapedUrl).arg(escapedDir);
}

QString DownloaderBridge::buildSpotdlScript(const QString &url, const QString &outputDir)
{
    QString escapedDir = outputDir;
    escapedDir.replace("\\", "\\\\");
    QString escapedUrl = url;
    escapedUrl.replace("\\", "\\\\").replace("\"", "\\\"");

    return QString(R"(
import sys, os, subprocess, traceback

url = "%1"
out_dir = r"%2"
os.makedirs(out_dir, exist_ok=True)

try:
    print("[spotdl] Descargando desde Spotify...", flush=True)
    result = subprocess.run([
        sys.executable, "-m", "spotdl",
        "--output", os.path.join(out_dir, "{title}"),
        "--format", "mp3",
        "--lyrics", "synced",
        url
    ], text=True)
    sys.exit(result.returncode)
except Exception as e:
    print(f"[spotdl] ERROR_DOWNLOAD: {type(e).__name__}: {e}", flush=True)
    traceback.print_exc()
    sys.exit(30)
)").arg(escapedUrl).arg(escapedDir);
}

QString DownloaderBridge::buildSearchScript(const QString &query)
{
    QString escapedQuery = query;
    escapedQuery.replace("\\", "\\\\").replace("\"", "\\\"");

    return QString(R"(
import sys, json, traceback, urllib.request, urllib.parse, re

query = "%1".strip()

def fmt_duration(seconds):
    try:
        seconds = int(seconds or 0)
        if seconds <= 0:
            return ""
        return f"{seconds // 60}:{seconds % 60:02d}"
    except Exception:
        return ""

def norm(s):
    return re.sub(r"[^a-z0-9]+", " ", (s or "").lower()).strip()

try:
    import yt_dlp
except Exception:
    print("LAVALYRICS_JSON_BEGIN")
    print("[]")
    print("LAVALYRICS_JSON_END")
    print("[search] yt_dlp no esta instalado", file=sys.stderr)
    sys.exit(0)

try:
    lyric_keys = set()
    try:
        url = "https://lrclib.net/api/search?q=" + urllib.parse.quote(query)
        with urllib.request.urlopen(url, timeout=8) as resp:
            data = json.loads(resp.read().decode("utf-8", errors="replace"))
        for item in data[:20]:
            if item.get("syncedLyrics"):
                lyric_keys.add((norm(item.get("trackName")), norm(item.get("artistName"))))
    except Exception as e:
        print(f"[search] WARN_LRCLIB {type(e).__name__}: {e}", file=sys.stderr)

    ydl_opts = {
        "quiet": True,
        "extract_flat": True,
        "skip_download": True,
        "noplaylist": True,
    }
    entries = []
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info("ytsearch8:" + query, download=False)
        entries = info.get("entries") or []

    results = []
    seen = set()
    for item in entries:
        if not item:
            continue
        raw_title = item.get("title") or query
        artist = item.get("channel") or item.get("uploader") or "Artista por detectar"
        title = raw_title
        if " - " in raw_title:
            left, right = raw_title.split(" - ", 1)
            artist = left.strip() or artist
            title = re.sub(r"\s*[\(\[].*?(official|lyrics|audio|video).*?[\)\]]", "", right, flags=re.I).strip() or right.strip()

        key = (norm(title), norm(artist))
        if key in seen:
            continue
        seen.add(key)

        has_lyrics = key in lyric_keys or any(k[0] == key[0] and (k[1] in key[1] or key[1] in k[1]) for k in lyric_keys)
        video_id = item.get("id") or ""
        webpage_url = item.get("url") or item.get("webpage_url") or ""
        if video_id and not webpage_url.startswith("http"):
            webpage_url = "https://www.youtube.com/watch?v=" + video_id

        results.append({
            "title": title,
            "artist": artist,
            "source": "YouTube Music" if item.get("ie_key") == "Youtube" else "YouTube",
            "icon": "YT",
            "duration": fmt_duration(item.get("duration")) or "No disponible",
            "hasLyrics": bool(has_lyrics),
            "downloaded": False,
            "url": webpage_url or query,
            "thumbnail": item.get("thumbnail") or "",
        })

    results.sort(key=lambda r: (not r["hasLyrics"], r["title"].lower()))
    print("LAVALYRICS_JSON_BEGIN")
    print(json.dumps(results, ensure_ascii=True))
    print("LAVALYRICS_JSON_END")
except Exception as e:
    print("LAVALYRICS_JSON_BEGIN")
    print("[]")
    print("LAVALYRICS_JSON_END")
    print(f"[search] ERROR_SEARCH {type(e).__name__}: {e}", file=sys.stderr)
    traceback.print_exc()
    sys.exit(1)
)").arg(escapedQuery);
}
