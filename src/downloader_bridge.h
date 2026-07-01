#ifndef DOWNLOADER_BRIDGE_H
#define DOWNLOADER_BRIDGE_H

#include <QObject>
#include <QString>
#include <QProcess>
#include <QVariantMap>
#include <QVariantList>

class DownloaderBridge : public QObject
{
    Q_OBJECT
    Q_PROPERTY(bool isDownloading READ isDownloading NOTIFY isDownloadingChanged)
    Q_PROPERTY(int progress READ progress NOTIFY progressChanged)
    Q_PROPERTY(QString statusMessage READ statusMessage NOTIFY statusMessageChanged)
    Q_PROPERTY(QString pythonPath READ pythonPath WRITE setPythonPath)

public:
    explicit DownloaderBridge(QObject *parent = nullptr);
    ~DownloaderBridge();

    bool isDownloading() const;
    int progress() const;
    QString statusMessage() const;
    QString pythonPath() const;
    void setPythonPath(const QString &path);

    Q_INVOKABLE void downloadFromUrl(const QString &url, const QString &outputDir);
    Q_INVOKABLE void downloadSpotify(const QString &spotifyUrl, const QString &outputDir);
    Q_INVOKABLE void searchSongs(const QString &query);
    Q_INVOKABLE void cancel();
    Q_INVOKABLE QString detectPython();

signals:
    void isDownloadingChanged();
    void progressChanged();
    void statusMessageChanged();
    void downloadCompleted(const QString &audioPath, const QString &lyricsPath);
    void downloadFailed(const QString &error);
    void searchStarted();
    void searchCompleted(const QVariantList &results);
    void searchFailed(const QString &error);

private slots:
    void onProcessOutput();
    void onProcessFinished(int exitCode, QProcess::ExitStatus status);
    void onProcessError(QProcess::ProcessError error);

private:
    QProcess *m_process;
    bool m_isDownloading;
    int m_progress;
    QString m_statusMessage;
    QString m_pythonPath;
    QString m_outputDir;
    QString m_lastAudioPath;
    QString m_lastLyricsPath;
    QString m_processLog;
    QString m_currentSource;

    void setStatus(const QString &msg);
    void parseProgressLine(const QString &line);
    QString buildYtdlpScript(const QString &url, const QString &outputDir);
    QString buildSpotdlScript(const QString &url, const QString &outputDir);
    QString buildSearchScript(const QString &query);
};

#endif // DOWNLOADER_BRIDGE_H
