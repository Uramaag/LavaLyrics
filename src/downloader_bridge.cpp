#include "downloader_bridge.h"
#include <QDir>
#include <QFileInfo>
#include <QStringList>
#include <QStandardPaths>
#include <QProcess>
#include <QRegularExpression>
#include <QDebug>

DownloaderBridge::DownloaderBridge(QObject *parent)
    : QObject(parent)
    , m_process(new QProcess(this))
    , m_isDownloading(false)
    , m_progress(0)
{
    connect(m_process, &QProcess::readyReadStandardOutput, this, &DownloaderBridge::onProcessOutput);
    connect(m_process, &QProcess::readyReadStandardError,  this, &DownloaderBridge::onProcessOutput);
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
int  DownloaderBridge::progress() const      { return m_progress; }
QString DownloaderBridge::statusMessage() const { return m_statusMessage; }
QString DownloaderBridge::pythonPath() const  { return m_pythonPath; }
void DownloaderBridge::setPythonPath(const QString &path) { m_pythonPath = path; }

QString DownloaderBridge::detectPython()
{
    QStringList candidates = {"python", "python3", "py"};
    for (const QString &cmd : candidates) {
        QProcess probe;
        probe.start(cmd, {"--version"});
        probe.waitForFinished(3000);
        if (probe.exitCode() == 0) {
            qDebug() << "[DownloaderBridge] Detected Python:" << cmd;
            m_pythonPath = cmd;
            return cmd;
        }
    }
    return QString();
}

void DownloaderBridge::downloadFromUrl(const QString &url, const QString &outputDir)
{
    if (m_isDownloading) return;

    m_outputDir = outputDir;
    QDir().mkpath(outputDir);

    QString python = m_pythonPath.isEmpty() ? detectPython() : m_pythonPath;
    if (python.isEmpty()) {
        emit downloadFailed("Python no encontrado. Instala Python 3.x.");
        return;
    }

    // Inline Python script to run yt-dlp and fetch lyrics
    QString script = buildYtdlpScript(url, outputDir);

    m_isDownloading = true;
    m_progress = 0;
    emit isDownloadingChanged();
    setStatus("Iniciando descarga...");

    m_process->start(python, {"-c", script});
}

void DownloaderBridge::downloadSpotify(const QString &spotifyUrl, const QString &outputDir)
{
    if (m_isDownloading) return;

    m_outputDir = outputDir;
    QDir().mkpath(outputDir);

    QString python = m_pythonPath.isEmpty() ? detectPython() : m_pythonPath;
    if (python.isEmpty()) {
        emit downloadFailed("Python no encontrado.");
        return;
    }

    QString script = buildSpotdlScript(spotifyUrl, outputDir);

    m_isDownloading = true;
    m_progress = 0;
    emit isDownloadingChanged();
    setStatus("Iniciando descarga de Spotify...");

    m_process->start(python, {"-c", script});
}

void DownloaderBridge::cancel()
{
    if (m_isDownloading) {
        m_process->kill();
        m_isDownloading = false;
        m_progress = 0;
        emit isDownloadingChanged();
        emit progressChanged();
        setStatus("Descarga cancelada");
    }
}

void DownloaderBridge::onProcessOutput()
{
    QString out = QString::fromUtf8(m_process->readAllStandardOutput());
    QString err = QString::fromUtf8(m_process->readAllStandardError());
    QString combined = out + err;

    const QStringList lines = combined.split('\n', Qt::SkipEmptyParts);
    for (const QString &line : lines) {
        qDebug() << "[Downloader]" << line.trimmed();
        parseProgressLine(line.trimmed());
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

        // Search for output files in m_outputDir
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

        emit downloadCompleted(audioFile, lyricsFile);
    } else {
        setStatus("Error en la descarga (código " + QString::number(exitCode) + ")");
        emit downloadFailed("Proceso terminó con código: " + QString::number(exitCode));
    }
}

void DownloaderBridge::onProcessError(QProcess::ProcessError error)
{
    m_isDownloading = false;
    emit isDownloadingChanged();
    QString msg = "Error de proceso: " + QString::number(error);
    setStatus(msg);
    emit downloadFailed(msg);
}

void DownloaderBridge::setStatus(const QString &msg)
{
    m_statusMessage = msg;
    emit statusMessageChanged();
}

void DownloaderBridge::parseProgressLine(const QString &line)
{
    // yt-dlp progress: "[download]  45.2% of ..."
    static QRegularExpression pctRe(R"(\[download\]\s+([\d.]+)%)");
    QRegularExpressionMatch m = pctRe.match(line);
    if (m.hasMatch()) {
        int pct = qBound(0, (int)m.captured(1).toDouble(), 99);
        if (pct != m_progress) {
            m_progress = pct;
            emit progressChanged();
        }
    }

    // Status messages
    if (line.contains("[download]")) setStatus(line.mid(line.indexOf(']') + 2).trimmed());
    else if (line.contains("[spotdl]") || line.contains("Downloading")) setStatus(line.trimmed());
    else if (line.contains("Merging") || line.contains("ffmpeg")) setStatus("Procesando audio...");
    else if (line.contains("ERROR") || line.contains("error")) {
        setStatus("Error: " + line);
    }
}

QString DownloaderBridge::buildYtdlpScript(const QString &url, const QString &outputDir)
{
    // Python script that downloads audio with yt-dlp and fetches lyrics from lrclib.net
    QString escaped_dir = outputDir;
    escaped_dir.replace("\\", "\\\\");

    return QString(R"(
import sys, os, json, urllib.request, subprocess

url = "%1"
out_dir = r"%2"
os.makedirs(out_dir, exist_ok=True)

print("[download] Iniciando con yt-dlp...", flush=True)

# Download audio with yt-dlp
result = subprocess.run([
    sys.executable, "-m", "yt_dlp",
    "--extract-audio",
    "--audio-format", "mp3",
    "--audio-quality", "0",
    "--output", os.path.join(out_dir, "%(title)s.%(ext)s"),
    "--write-info-json",
    "--no-playlist",
    url
], capture_output=False, text=True)

# Try to fetch lyrics from lrclib.net using metadata
info_files = [f for f in os.listdir(out_dir) if f.endswith('.info.json')]
if info_files:
    with open(os.path.join(out_dir, info_files[0])) as f:
        info = json.load(f)
    artist = info.get('artist', info.get('uploader', ''))
    title  = info.get('track', info.get('title', ''))
    duration = int(info.get('duration', 0))

    print(f"[spotdl] Buscando letras: {artist} - {title}", flush=True)

    try:
        params = urllib.parse.urlencode({'artist_name': artist, 'track_name': title, 'duration': duration})
        req = urllib.request.urlopen(f"https://lrclib.net/api/get?{params}", timeout=10)
        data = json.loads(req.read())
        if data.get('syncedLyrics'):
            lrc_path = os.path.join(out_dir, "lyrics.lrc")
            with open(lrc_path, 'w', encoding='utf-8') as lf:
                lf.write(data['syncedLyrics'])
            print(f"[spotdl] Letras guardadas en {lrc_path}", flush=True)
    except Exception as e:
        print(f"[spotdl] No se encontraron letras: {e}", flush=True)

import urllib.parse
sys.exit(result.returncode)
)").arg(url).arg(escaped_dir);
}

QString DownloaderBridge::buildSpotdlScript(const QString &url, const QString &outputDir)
{
    QString escaped_dir = outputDir;
    escaped_dir.replace("\\", "\\\\");

    return QString(R"(
import sys, os, subprocess

url = "%1"
out_dir = r"%2"
os.makedirs(out_dir, exist_ok=True)

print("[spotdl] Descargando desde Spotify...", flush=True)

result = subprocess.run([
    sys.executable, "-m", "spotdl",
    "--output", os.path.join(out_dir, "{title}"),
    "--format", "mp3",
    "--lyrics", "synced",
    url
], text=True)

sys.exit(result.returncode)
)").arg(url).arg(escaped_dir);
}
