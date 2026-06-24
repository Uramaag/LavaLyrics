#ifndef VIDEO_EXPORTER_H
#define VIDEO_EXPORTER_H

#include <QObject>
#include <QString>
#include <QVariantMap>

class VideoExporter : public QObject
{
    Q_OBJECT
    Q_PROPERTY(double progress READ progress NOTIFY progressChanged)
    Q_PROPERTY(bool isRunning READ isRunning NOTIFY isRunningChanged)

public:
    explicit VideoExporter(QObject *parent = nullptr);
    ~VideoExporter();

    double progress() const;
    bool isRunning() const;

    Q_INVOKABLE bool startExport(const QString &outputPath, const QVariantMap &exportSettings, const QVariantMap &tracks);
    Q_INVOKABLE void cancelExport();

signals:
    void progressChanged();
    void isRunningChanged();
    void exportCompleted(const QString &outputPath);
    void exportFailed(const QString &error);

private:
    double m_progress;
    bool m_isRunning;
};

#endif // VIDEO_EXPORTER_H
