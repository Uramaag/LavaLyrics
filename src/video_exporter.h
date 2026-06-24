#ifndef VIDEO_EXPORTER_H
#define VIDEO_EXPORTER_H

#include <QObject>
#include <QString>
#include <QVariantMap>
#include <QVariantList>
#include <QThread>
#include <QSize>

class VideoExporter : public QObject
{
    Q_OBJECT
    Q_PROPERTY(double progress   READ progress   NOTIFY progressChanged)
    Q_PROPERTY(bool   isRunning  READ isRunning  NOTIFY isRunningChanged)
    Q_PROPERTY(QString statusMsg READ statusMsg  NOTIFY statusMsgChanged)

public:
    explicit VideoExporter(QObject *parent = nullptr);
    ~VideoExporter();

    double  progress()  const;
    bool    isRunning() const;
    QString statusMsg() const;

    // exportSettings keys: resolution ("1080x1920"), fps (int), bitrate ("6000k"), format ("mp4")
    // tracks: { audioPath, videoClips: [{path, start, duration}], lyricsData: [{timeMs, text}] }
    Q_INVOKABLE bool startExport(const QString &outputPath,
                                  const QVariantMap &exportSettings,
                                  const QVariantMap &tracks);
    Q_INVOKABLE void cancelExport();

signals:
    void progressChanged();
    void isRunningChanged();
    void statusMsgChanged();
    void exportCompleted(const QString &outputPath);
    void exportFailed(const QString &error);

private:
    double   m_progress;
    bool     m_isRunning;
    QString  m_statusMsg;
    bool     m_cancelRequested;
    QThread *m_workerThread;

    void setStatus(const QString &msg);
    void runExport(const QString &outputPath,
                   const QVariantMap &settings,
                   const QVariantMap &tracks);
};

#endif // VIDEO_EXPORTER_H
