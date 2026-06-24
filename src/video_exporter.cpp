#include "video_exporter.h"
#include <QDebug>
#include <QProcess>
#include <QDir>
#include <QFileInfo>
#include <QTemporaryDir>
#include <QImage>
#include <QPainter>
#include <QFont>
#include <QFontMetrics>
#include <QRegularExpression>

VideoExporter::VideoExporter(QObject *parent)
    : QObject(parent)
    , m_progress(0.0)
    , m_isRunning(false)
    , m_cancelRequested(false)
    , m_workerThread(nullptr)
{
}

VideoExporter::~VideoExporter()
{
    cancelExport();
    if (m_workerThread) {
        m_workerThread->quit();
        m_workerThread->wait(5000);
    }
}

double  VideoExporter::progress()  const { return m_progress; }
bool    VideoExporter::isRunning() const { return m_isRunning; }
QString VideoExporter::statusMsg() const { return m_statusMsg; }

bool VideoExporter::startExport(const QString &outputPath,
                                 const QVariantMap &exportSettings,
                                 const QVariantMap &tracks)
{
    if (m_isRunning) {
        qWarning() << "[VideoExporter] Already running";
        return false;
    }

    qDebug() << "[VideoExporter] Starting export to:" << outputPath;

    m_isRunning       = true;
    m_cancelRequested = false;
    m_progress        = 0.0;
    emit isRunningChanged();
    emit progressChanged();
    setStatus("Preparando exportación...");

    // Capture locals for lambda
    QString outPath   = outputPath;
    QVariantMap sets  = exportSettings;
    QVariantMap trks  = tracks;

    m_workerThread = QThread::create([this, outPath, sets, trks]() {
        runExport(outPath, sets, trks);
    });

    connect(m_workerThread, &QThread::finished, m_workerThread, &QObject::deleteLater);
    m_workerThread->start();
    return true;
}

void VideoExporter::cancelExport()
{
    if (m_isRunning) {
        m_cancelRequested = true;
        qDebug() << "[VideoExporter] Cancel requested";
    }
}

void VideoExporter::setStatus(const QString &msg)
{
    m_statusMsg = msg;
    emit statusMsgChanged();
}

// ─────────────────────────────────────────────────────────────────────────────
//  Core export logic — runs in worker thread
//  Strategy: use ffmpeg CLI (which is bundled with spotdl/yt-dlp environment)
//  This avoids needing FFmpeg dev headers at compile time.
// ─────────────────────────────────────────────────────────────────────────────
void VideoExporter::runExport(const QString &outputPath,
                               const QVariantMap &settings,
                               const QVariantMap &tracks)
{
    QTemporaryDir tmpDir;
    if (!tmpDir.isValid()) {
        emit exportFailed("No se pudo crear directorio temporal");
        m_isRunning = false;
        emit isRunningChanged();
        return;
    }

    QString audioPath  = tracks.value("audioPath").toString();
    auto    lyricsData = tracks.value("lyricsData").toList();  // [{timeMs, text}]
    auto    videoClips = tracks.value("videoClips").toList();  // [{path, start, duration}]

    QString resolution = settings.value("resolution", "1080x1920").toString();
    int     fps        = settings.value("fps", 30).toInt();
    QString bitrate    = settings.value("bitrate", "6000k").toString();
    QString format     = settings.value("format", "mp4").toString();

    // Parse resolution
    QStringList resParts = resolution.split('x');
    int vidW = resParts.value(0, "1080").toInt();
    int vidH = resParts.value(1, "1920").toInt();

    setStatus("Generando frames de letras...");
    m_progress = 5.0;
    emit progressChanged();

    // ── Step 1: Generate subtitle (ASS) file from lyrics ─────────────────────
    QString assPath = tmpDir.filePath("lyrics.ass");
    {
        QFile assFile(assPath);
        if (assFile.open(QIODevice::WriteOnly | QIODevice::Text)) {
            QTextStream out(&assFile);
            out << "[Script Info]\n";
            out << "ScriptType: v4.00+\n";
            out << QString("PlayResX: %1\n").arg(vidW);
            out << QString("PlayResY: %1\n").arg(vidH);
            out << "WrapStyle: 0\n\n";

            out << "[V4+ Styles]\n";
            out << "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, "
                   "Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, "
                   "Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n";
            // Main (current) line — white, large, centered
            out << QString("Style: Main,Montserrat,72,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,"
                           "1,0,0,0,100,100,0,0,1,4,2,5,%1,%1,%2,1\n")
                       .arg(vidW * 6 / 100)
                       .arg(vidH * 40 / 100);
            // Prev/Next — smaller, gray
            out << QString("Style: Sub,Montserrat,48,&H00AAAAAA,&H000000FF,&H00000000,&H80000000,"
                           "0,0,0,0,100,100,0,0,1,2,1,5,%1,%1,%2,1\n\n")
                       .arg(vidW * 6 / 100)
                       .arg(vidH * 40 / 100);

            out << "[Events]\n";
            out << "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n";

            auto toAssTime = [](double ms) -> QString {
                int totalMs  = (int)ms;
                int h        = totalMs / 3600000;
                int m        = (totalMs % 3600000) / 60000;
                int s        = (totalMs % 60000)   / 1000;
                int cs       = (totalMs % 1000)    / 10;
                return QString("%1:%2:%3.%4")
                    .arg(h).arg(m, 2, 10, QChar('0'))
                    .arg(s, 2, 10, QChar('0')).arg(cs, 2, 10, QChar('0'));
            };

            for (int i = 0; i < lyricsData.size(); ++i) {
                if (m_cancelRequested) break;
                QVariantMap line = lyricsData[i].toMap();
                double startMs   = line["timeMs"].toDouble();
                double endMs     = (i + 1 < lyricsData.size())
                                   ? lyricsData[i + 1].toMap()["timeMs"].toDouble()
                                   : startMs + 4000;
                QString text     = line["text"].toString();
                // Escape special ASS characters
                text.replace("\\", "\\\\").replace("{", "\\{").replace("}", "\\}");

                out << QString("Dialogue: 0,%1,%2,Main,,0,0,0,,%3\n")
                           .arg(toAssTime(startMs))
                           .arg(toAssTime(endMs))
                           .arg(text);
            }
        }
    }

    if (m_cancelRequested) goto cleanup;
    m_progress = 15.0;
    emit progressChanged();
    setStatus("Buscando FFmpeg...");

    // ── Step 2: Find ffmpeg executable ───────────────────────────────────────
    {
        QString ffmpegExe;
        QStringList candidates = {
            "ffmpeg",
            QDir::homePath() + "/AppData/Local/Programs/Python/Python311/Scripts/ffmpeg.exe",
            QDir::homePath() + "/.spotdl/ffmpeg.exe",
            QDir::homePath() + "/AppData/Roaming/spotdl/ffmpeg.exe",
        };

        // Search in PATH
        QProcess which;
        which.start("where", {"ffmpeg"});
        which.waitForFinished(3000);
        QString wherePath = QString::fromUtf8(which.readAllStandardOutput()).trimmed().split('\n').first().trimmed();
        if (!wherePath.isEmpty() && QFileInfo::exists(wherePath))
            candidates.prepend(wherePath);

        // Also search Python Scripts dirs
        QProcess pyPath;
        pyPath.start("python", {"-c", "import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())"});
        pyPath.waitForFinished(5000);
        QString pyFFmpeg = QString::fromUtf8(pyPath.readAllStandardOutput()).trimmed();
        if (!pyFFmpeg.isEmpty() && QFileInfo::exists(pyFFmpeg))
            candidates.prepend(pyFFmpeg);

        for (const QString &c : candidates) {
            if (QFileInfo::exists(c) || c == "ffmpeg") {
                ffmpegExe = c;
                break;
            }
        }

        if (ffmpegExe.isEmpty()) {
            emit exportFailed("FFmpeg no encontrado. Instala spotdl o imageio-ffmpeg para habilitar la exportación.");
            m_isRunning = false;
            emit isRunningChanged();
            return;
        }

        if (m_cancelRequested) goto cleanup;
        m_progress = 20.0;
        emit progressChanged();
        setStatus("Construyendo video...");

        // ── Step 3: Build ffmpeg command ─────────────────────────────────────
        // Input: loop background color + audio + ASS subtitles
        // Output: H.264 MP4, 9:16
        QStringList args;

        // Background: solid dark color looped for audio duration
        args << "-f" << "lavfi"
             << "-i" << QString("color=c=0x0a0a0a:s=%1x%2:r=%3").arg(vidW).arg(vidH).arg(fps);

        // Audio input
        if (!audioPath.isEmpty() && QFileInfo::exists(audioPath)) {
            args << "-i" << audioPath;
        }

        // Video filter: burn ASS subtitles
        QString vf = QString("ass='%1'").arg(assPath.replace("\\", "/").replace("'", "'\\''"));
        args << "-vf" << vf;

        // Map streams
        args << "-map" << "0:v";
        if (!audioPath.isEmpty() && QFileInfo::exists(audioPath))
            args << "-map" << "1:a";

        // Codec settings
        args << "-c:v"   << "libx264"
             << "-preset" << "fast"
             << "-crf"    << "23"
             << "-b:v"    << bitrate
             << "-r"      << QString::number(fps)
             << "-pix_fmt" << "yuv420p";

        if (!audioPath.isEmpty() && QFileInfo::exists(audioPath))
            args << "-c:a" << "aac" << "-b:a" << "192k";

        // Shortest flag (stop when audio ends)
        args << "-shortest"
             << "-y"          // overwrite
             << outputPath;

        qDebug() << "[VideoExporter] ffmpeg args:" << args.join(' ');

        QProcess ffmpegProc;
        ffmpegProc.setProcessChannelMode(QProcess::MergedChannels);
        ffmpegProc.start(ffmpegExe, args);

        // Parse ffmpeg progress
        static QRegularExpression timeRe(R"(time=(\d+):(\d+):(\d+\.?\d*))");
        double totalSecs = 0;

        // Read audio duration for progress calculation
        if (!audioPath.isEmpty()) {
            QProcess probe;
            probe.start(ffmpegExe, {"-i", audioPath, "-f", "null", "-"});
            probe.waitForFinished(10000);
            QString probeOut = QString::fromUtf8(probe.readAll());
            QRegularExpression durRe(R"(Duration:\s*(\d+):(\d+):(\d+\.?\d*))");
            auto dm = durRe.match(probeOut);
            if (dm.hasMatch())
                totalSecs = dm.captured(1).toDouble() * 3600
                          + dm.captured(2).toDouble() * 60
                          + dm.captured(3).toDouble();
        }
        if (totalSecs <= 0) totalSecs = 180.0;

        while (ffmpegProc.state() != QProcess::NotRunning) {
            if (m_cancelRequested) {
                ffmpegProc.kill();
                break;
            }
            ffmpegProc.waitForReadyRead(500);
            QString out = QString::fromUtf8(ffmpegProc.readAll());
            auto m2 = timeRe.match(out);
            if (m2.hasMatch()) {
                double doneSecs = m2.captured(1).toDouble() * 3600
                                + m2.captured(2).toDouble() * 60
                                + m2.captured(3).toDouble();
                double pct = 20.0 + 75.0 * qMin(doneSecs / totalSecs, 1.0);
                m_progress = pct;
                emit progressChanged();
                setStatus(QString("Exportando... %1%").arg((int)pct));
            }
        }

        ffmpegProc.waitForFinished(5000);
        int exitCode = ffmpegProc.exitCode();

        if (m_cancelRequested) {
            setStatus("Exportación cancelada");
            emit exportFailed("Cancelado por el usuario");
        } else if (exitCode == 0) {
            m_progress = 100.0;
            emit progressChanged();
            setStatus("¡Exportación completada!");
            qDebug() << "[VideoExporter] Done:" << outputPath;
            emit exportCompleted(outputPath);
        } else {
            QString errMsg = QString::fromUtf8(ffmpegProc.readAll());
            emit exportFailed("ffmpeg error (código " + QString::number(exitCode) + "): " + errMsg.right(300));
        }
    }

cleanup:
    m_isRunning = false;
    emit isRunningChanged();
}
